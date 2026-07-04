import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ALL_HANDS, makeEmptyGrid, generateSuits, getRngCorrectAction, getTopFrequencyActions, stackMatchesRange,
  focusWeight, weightedPick,
} from '../utils/hands'
import type {
  BrushState, BuildRound, BuildRoundResult, BuildSession, HandData, HandHistoryEntry, PokerPosition, PositionConfig,
  Range, Scenario, SessionGrid, SessionStats, Slot, StackGrid, TableSize, TrainingSession, Page, CurrentUser, DeviceSession,
} from '../types'
import {
  POS_6MAX, POS_8MAX, SLOTS_6MAX, SLOTS_8MAX,
} from '../types'
import { validateRanges } from '../utils/validateRanges'
import { addBreadcrumb, captureMessage, captureError } from '../utils/sentry'
import { enqueue, flush } from '../utils/eventQueue'
import { decodeRanges, encodeRanges } from '../utils/sparseGrid'
import { scoreBuild } from '../utils/buildScore'
import { DEFAULT_RANGES } from '../data/defaultRanges'
import { t, setLangDict, type Lang } from '../i18n'
import adminRangesRaw from '../data/adminRanges.json'

const RANGES_KEY        = 'fbr-ranges-v1'
const HISTORY_KEY       = 'fbr-training-history-v1'
const HAND_PERF_KEY     = 'pfp-hand-perf-v1'
const ADMIN_VERSION_KEY = 'admin-ranges-version'
const DELETED_ADMIN_KEY = 'fbr-deleted-admin-ids'
const TEAM_VERSION_KEY  = 'team-ranges-version'
const TEAM_IDS_KEY      = 'pfp-team-range-ids'

function loadTeamRangeIds(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAM_IDS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : []
  } catch { return [] }
}

function loadDeletedAdminIds(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_ADMIN_KEY) ?? '[]')) }
  catch { return new Set() }
}

function addDeletedAdminId(id: number) {
  const ids = loadDeletedAdminIds()
  ids.add(id)
  localStorage.setItem(DELETED_ADMIN_KEY, JSON.stringify([...ids]))
}

type HandPerfMap = Record<string, Record<string, { c: number; t: number }>>

const adminPayload  = adminRangesRaw as unknown as { version: number; ranges: Range[] }
const ADMIN_VERSION = adminPayload.version ?? 0
const ADMIN_RANGES  = adminPayload.ranges ?? []

const SEEDED_DEFAULTS: Range[] = (() => {
  // decodeRanges aceita o adminRanges.json em formato denso (atual) ou esparso (após o próximo publish)
  if (ADMIN_RANGES.length === 0) return decodeRanges(DEFAULT_RANGES)
  const adminIds = new Set(ADMIN_RANGES.map(r => r.id))
  return decodeRanges([...ADMIN_RANGES, ...DEFAULT_RANGES.filter(r => !adminIds.has(r.id))])
})()

function loadRanges(): Range[] {
  try {
    // decodeRanges torna formato esparso e denso transparentes ao restante do app
    const saved: Range[] = decodeRanges(JSON.parse(localStorage.getItem(RANGES_KEY) ?? '[]') ?? [])
    const seenVersion = Number(localStorage.getItem(ADMIN_VERSION_KEY) ?? '0')
    const deletedIds = loadDeletedAdminIds()

    if (ADMIN_VERSION > seenVersion) {
      // Nova versão publicada: sobrescreve ranges do admin, preserva ranges do usuário
      // Ranges que o admin deletou explicitamente não são reinjeitados
      const adminIds = new Set(SEEDED_DEFAULTS.map(r => r.id))
      const userRanges = saved.filter(r => !adminIds.has(r.id))
      const toSeed = SEEDED_DEFAULTS.filter(r => !deletedIds.has(r.id))
      const merged = [...toSeed, ...userRanges]
      saveRanges(merged)
      localStorage.setItem(ADMIN_VERSION_KEY, String(ADMIN_VERSION))
      // Versão nova publicada: limpa a lista de deletados (admin decidiu manter esses ranges)
      localStorage.removeItem(DELETED_ADMIN_KEY)
      return merged
    }

    // Versão já vista: injeta apenas ranges ausentes sem sobrescrever edições locais
    const existingIds = new Set(saved.map(r => r.id))
    const missing = SEEDED_DEFAULTS.filter(r => !existingIds.has(r.id) && !deletedIds.has(r.id))
    if (missing.length > 0) {
      const merged = [...missing, ...saved]
      saveRanges(merged)
      return merged
    }
    return saved
  } catch { return [...SEEDED_DEFAULTS] }
}

function loadRangesValidated(): Range[] {
  const ranges = loadRanges()
  const problems = validateRanges(ranges)
  if (problems.length > 0) {
    console.warn(`[validateRanges] ${problems.length} problema(s) nos ranges:\n` + problems.join('\n'))
    captureMessage(`validateRanges: ${problems.length} problema(s) nos ranges no load`, 'warning')
  }
  return ranges
}

// Reporter ligado ao store na criação; sinaliza falha de cota sem que os
// helpers de save (fora do escopo do store) precisem acessar set/get.
let storageErrorReporter: ((blocked: boolean) => void) | null = null

function trySave(fn: () => void) {
  try {
    fn()
    storageErrorReporter?.(false)
  } catch {
    storageErrorReporter?.(true)
  }
}

function saveRanges(ranges: Range[]) {
  trySave(() => localStorage.setItem(RANGES_KEY, JSON.stringify(encodeRanges(ranges))))
}

function loadHistory(): TrainingSession[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') ?? [] }
  catch { return [] }
}

function saveHistory(sessions: TrainingSession[]) {
  trySave(() => localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions)))
}

const BUILD_HISTORY_KEY = 'pfp-build-history-v1'

function loadBuildHistory(): BuildSession[] {
  try { return JSON.parse(localStorage.getItem(BUILD_HISTORY_KEY) ?? '[]') ?? [] }
  catch { return [] }
}

function saveBuildHistory(sessions: BuildSession[]) {
  trySave(() => localStorage.setItem(BUILD_HISTORY_KEY, JSON.stringify(sessions)))
}

// Upsert por id: a sessão em andamento é gravada no histórico a cada resposta
// (nada se perde se o usuário fechar sem encerrar) e atualizada in-place depois.
function upsertSession<T extends { id: number }>(list: T[], item: T): T[] {
  const idx = list.findIndex(s => s.id === item.id)
  return idx >= 0 ? [...list.slice(0, idx), item, ...list.slice(idx + 1)] : [...list, item]
}

function makeBuildSession(id: number, rounds: BuildRound[], results: BuildRoundResult[]): BuildSession {
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length
  return {
    id,
    timestamp: id,
    rangeNames: [...new Set(rounds.map(r => r.rangeName))],
    rounds: results.map(r => ({ label: r.label, score: Math.round(r.score * 10) / 10, attempt: r.attempt })),
    avgScore: Math.round(avg * 10) / 10,
  }
}

function loadHandPerf(): HandPerfMap {
  try { return JSON.parse(localStorage.getItem(HAND_PERF_KEY) ?? '{}') ?? {} }
  catch { return {} }
}

function saveHandPerf(perf: HandPerfMap) {
  trySave(() => localStorage.setItem(HAND_PERF_KEY, JSON.stringify(perf)))
}

interface AppState {
  // ── Navigation ──────────────────────────────────────────────────────────────
  page: Page
  darkMode: boolean
  lang: Lang
  activeCategory: string | null
  setPage: (p: Page) => void
  toggleDarkMode: () => void
  setLang: (lang: Lang) => void
  setActiveCategory: (key: string | null) => void

  // ── Persistent data ─────────────────────────────────────────────────────────
  ranges: Range[]
  trainingHistory: TrainingSession[]
  storageBlocked: boolean

  // ── Backup ──────────────────────────────────────────────────────────────────
  exportData: () => string
  resetLocalData: () => void

  // ── Table config (shared for editor + drill display) ────────────────────────
  currentTableSize: TableSize
  activePositions: PokerPosition[]
  activeSlots: Slot[]
  currentAnte: number
  setTableFormat: (size: TableSize) => void

  // ── Range editor ─────────────────────────────────────────────────────────────
  rangeData: { id: number | null; name: string; grid: Record<string, HandData>; positions: string[]; tableSize: TableSize; stackRange: string; prereqRangeId?: number }
  selectedEditorPositions: string[]
  brush: BrushState

  setBrush: (field: keyof BrushState, value: number | string) => void
  applyBrush: (hand: string) => void
  applyBrushToHands: (hands: string[]) => void
  clearHands: (hands: string[]) => void
  clearHand: (hand: string) => void
  resetGrid: () => void
  setRangeName: (name: string) => void
  setStackRange: (val: string) => void
  setEditorPrereq: (prereqId: number | null) => void
  toggleEditorPosition: (label: string) => void
  loadRangeForEdit: (id: number) => void

  // ── Table editor ─────────────────────────────────────────────────────────────
  currentScenario: Record<string, PositionConfig>
  tempScenarios: Scenario[]
  currentHeroRaiseSize: number
  currentHasStraddle: boolean

  setupNewRange: (size: TableSize, hasStraddle: boolean, ante: number) => void
  initTableConfig: () => void
  updateHero: (pid: string) => void
  updateRole: (pid: string, role: string) => void
  updateBet: (pid: string, val: number) => void
  updateStack: (pid: string, val: number) => void
  setCurrentAnte: (val: number) => void
  setHeroRaiseSize: (val: number) => void
  setAllStacks: (val: number) => void
  addScenarioToBuffer: (pot: string, summary: string) => void
  updateScenarioInBuffer: (idx: number, pot: string, summary: string) => void
  removeScenario: (idx: number) => void
  loadScenarioFromBuffer: (idx: number) => void
  finalizeRange: (primaryName?: string) => void
  sessionGrids: SessionGrid[]
  pushGridToSession: () => void
  updateSessionGrid: (idx: number, sg: SessionGrid) => void
  removeSessionGrid: (idx: number) => void

  // ── Hand performance (heatmap) ────────────────────────────────────────────────
  handPerformance: HandPerfMap
  clearHandPerformance: (rangeId: number) => void

  // ── Saved ranges management ──────────────────────────────────────────────────
  deleteRange: (id: number) => void
  setRangePrereq: (rangeId: number, prereqId: number | null) => void
  rangesFilter: string
  setRangesFilter: (f: string) => void

  // ── Drill ────────────────────────────────────────────────────────────────────
  selectedDrillRangeIds: number[]
  drillExcludedHands: string[]
  activeDrillRange: Range | null
  activeDrillStackRange: string
  activeDrillStackGridIdx: number
  activeHand: string
  sessionStats: SessionStats
  handHistory: HandHistoryEntry[]
  currentRng: number
  correctActionForCurrentHand: string
  correctActionsForCurrentHand: string[]
  currentHandSuits: [string, string]
  sessionStartTime: number
  sessionUuid: string

  useRngForFrequency: boolean
  setUseRng: (val: boolean) => void
  acceptAnyFreq: boolean
  setAcceptAnyFreq: (val: boolean) => void
  focusErrors: boolean
  setFocusErrors: (val: boolean) => void
  sessionHandPerf: HandPerfMap
  sessionSeverity: { grave: number; impreciso: number }

  toggleDrillRange: (id: number) => void
  clearDrillRanges: () => void
  setDrillExcluded: (hands: string[]) => void
  toggleDrillHand: (hand: string) => void
  setAllDrillHands: (included: boolean) => void
  startDrillSession: () => void
  nextDrillHand: () => boolean
  checkDrillAnswer: (action: string) => { correct: boolean; message: string; severity?: 'grave' | 'impreciso' }
  stopDrill: () => void
  incrementConsults: () => void

  // ── Montar Range (exercício) ─────────────────────────────────────────────────
  buildSelectedRangeIds: number[]
  buildRounds: BuildRound[]
  buildRoundIdx: number
  buildResults: BuildRoundResult[]
  buildLastResult: { score: number; perHand: Record<string, number>; userGrid: Record<string, HandData> } | null
  buildSessionUuid: string
  buildSessionId: number
  buildConfirmed: boolean
  buildAttempt: number
  buildHistory: BuildSession[]
  toggleBuildRange: (id: number) => void
  startBuildSession: () => boolean
  confirmBuildSession: () => void
  submitBuildRound: () => void
  retryBuildRound: () => void
  nextBuildRound: () => void
  stopBuildSession: () => void

  // ── Auth ──────────────────────────────────────────────────────────────────────
  userMode: 'visitor' | 'admin' | null
  adminToken: { token: string; expiresAt: number } | null
  logout: () => void

  // ── Conta (opt-in, D1) ────────────────────────────────────────────────────────
  currentUser: CurrentUser | null
  authToken: string | null
  justSignedUp: boolean
  authLogin: (username: string, password: string, turnstileToken?: string | null) => Promise<{ ok: boolean; error?: string }>
  authSignup: (username: string, password: string, teamCode: string, name: string, email: string, turnstileToken?: string | null) => Promise<{ ok: boolean; error?: string }>
  authLogout: () => Promise<void>
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>
  listDevices: () => Promise<{ ok: boolean; devices?: DeviceSession[]; error?: string }>
  revokeDevice: (id: number) => Promise<{ ok: boolean; error?: string }>
  revokeOtherDevices: () => Promise<{ ok: boolean; error?: string }>
  restoreSession: () => Promise<void>
  teamRangeIds: number[]
  syncTeamRanges: () => Promise<void>
  publishTeamRanges: () => Promise<{ ok: boolean; error?: string; version?: number; count?: number }>
  logConsult: (rangeId: number, rangeName: string, hand?: string) => void

  // ── Admin ─────────────────────────────────────────────────────────────────────
  adminWorkerUrl: string
  setAdminWorkerUrl: (url: string) => void
  adminLastError: string
  adminSaveRanges: (password?: string) => Promise<'ok' | 'wrong_password' | 'token_expired' | 'error' | 'invalid_token' | 'missing_token'>
}

function fireEvent(path: string, body: object, token: string | null) {
  enqueue(path, body, token)
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Navigation ────────────────────────────────────────────────────────────
      page: 'dashboard',
      darkMode: false,
      lang: 'pt',
      activeCategory: null,
      setPage: (page) => { addBreadcrumb('nav', `page → ${page}`); set({ page }) },
      toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),
      setLang: (lang) => { setLangDict(lang); addBreadcrumb('nav', `lang → ${lang}`); set({ lang }) },
      setActiveCategory: (activeCategory) => set({ activeCategory }),

      // ── Persistent data ───────────────────────────────────────────────────────
      ranges: loadRangesValidated(),
      trainingHistory: loadHistory(),
      storageBlocked: false,

      // ── Backup ──────────────────────────────────────────────────────────────
      exportData: () => {
        const { ranges, trainingHistory, handPerformance } = get()
        addBreadcrumb('data', 'export', { ranges: ranges.length, sessions: trainingHistory.length })
        return JSON.stringify({ version: 1, ranges, trainingHistory, handPerformance }, null, 2)
      },

      resetLocalData: () => {
        addBreadcrumb('data', 'reset local')
        Object.keys(localStorage)
          .filter(k => k.startsWith('fbr-') || k.startsWith('pfp-'))
          .forEach(k => localStorage.removeItem(k))
      },

      // ── Table config ──────────────────────────────────────────────────────────
      currentTableSize: 6,
      activePositions: POS_6MAX,
      activeSlots: SLOTS_6MAX,
      currentAnte: 0,

      setTableFormat: (size) => {
        const positions = size === 6 ? POS_6MAX : POS_8MAX
        const slots = size === 6 ? SLOTS_6MAX : SLOTS_8MAX
        const ante = size === 6 ? 0 : 0.5
        const { rangeData } = get()
        set({
          currentTableSize: size,
          activePositions: positions,
          activeSlots: slots,
          currentAnte: ante,
          page: 'editor',
          ...(rangeData.id === null
            ? { rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: size, stackRange: '' } }
            : {}),
        })
      },

      // ── Range editor ──────────────────────────────────────────────────────────
      rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 6, stackRange: '' },
      selectedEditorPositions: [],
      brush: { call: 0, raise: 0, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#a855f7' },

      setBrush: (field, value) => {
        const { brush } = get()
        if (field === 'raiseSize' || field === 'extraLabel' || field === 'extraColor') {
          set({ brush: { ...brush, [field]: value as string } })
          return
        }
        let v = Math.max(0, Math.min(100, Number(value)))
        if (v === 100) {
          set({ brush: { ...brush, call: field === 'call' ? 100 : 0, raise: field === 'raise' ? 100 : 0, allin: field === 'allin' ? 100 : 0, extra: field === 'extra' ? 100 : 0 } })
          return
        }
        let c = field === 'call' ? v : brush.call
        let r = field === 'raise' ? v : brush.raise
        let a = field === 'allin' ? v : brush.allin
        let e = field === 'extra' ? v : brush.extra
        const total = c + r + a + e
        if (total > 100) {
          const excess = total - 100
          const others = ([
            { t: 'call' as const, v: c },
            { t: 'raise' as const, v: r },
            { t: 'allin' as const, v: a },
            { t: 'extra' as const, v: e },
          ] as { t: 'call' | 'raise' | 'allin' | 'extra'; v: number }[])
            .filter(o => o.t !== field)
            .sort((x, y) => y.v - x.v)
          const reduce = (key: 'call' | 'raise' | 'allin' | 'extra', amt: number) => {
            if (key === 'call') c = Math.max(0, c - amt)
            else if (key === 'raise') r = Math.max(0, r - amt)
            else if (key === 'allin') a = Math.max(0, a - amt)
            else e = Math.max(0, e - amt)
          }
          if (others.length > 0) {
            reduce(others[0].t, excess)
            const rem1 = c + r + a + e - 100
            if (rem1 > 0 && others.length > 1) reduce(others[1].t, rem1)
            const rem2 = c + r + a + e - 100
            if (rem2 > 0 && others.length > 2) reduce(others[2].t, rem2)
          }
        }
        set({ brush: { ...brush, call: c, raise: r, allin: a, extra: e } })
      },

      applyBrush: (hand) => {
        const { brush, rangeData } = get()
        const total = brush.call + brush.raise + brush.allin + brush.extra
        if (total > 100) return
        const fold = 100 - total
        const newGrid = {
          ...rangeData.grid,
          [hand]: { call: brush.call, raise: brush.raise, allin: brush.allin, extra: brush.extra, fold, size: brush.raiseSize },
        }
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      applyBrushToHands: (hands) => {
        const { brush, rangeData } = get()
        const total = brush.call + brush.raise + brush.allin + brush.extra
        if (total > 100) return
        const fold = 100 - total
        const newGrid = { ...rangeData.grid }
        hands.forEach(hand => {
          newGrid[hand] = { call: brush.call, raise: brush.raise, allin: brush.allin, extra: brush.extra, fold, size: brush.raiseSize }
        })
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      clearHand: (hand) => {
        const { rangeData } = get()
        const newGrid = { ...rangeData.grid, [hand]: { fold: 100, call: 0, raise: 0, allin: 0, extra: 0, size: '' } }
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      clearHands: (hands) => {
        const { rangeData } = get()
        const newGrid = { ...rangeData.grid }
        hands.forEach(hand => { newGrid[hand] = { fold: 100, call: 0, raise: 0, allin: 0, extra: 0, size: '' } })
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      resetGrid: () => {
        const { rangeData } = get()
        set({ rangeData: { ...rangeData, grid: makeEmptyGrid() } })
      },

      setRangeName: (name) => {
        const { rangeData } = get()
        set({ rangeData: { ...rangeData, name } })
      },

      setStackRange: (val) => {
        const { rangeData } = get()
        set({ rangeData: { ...rangeData, stackRange: val } })
      },

      setEditorPrereq: (prereqId) => {
        const { rangeData } = get()
        const updated = { ...rangeData }
        if (prereqId === null) delete updated.prereqRangeId
        else updated.prereqRangeId = prereqId
        set({ rangeData: updated })
      },

      toggleEditorPosition: (label) => {
        const { selectedEditorPositions } = get()
        const next = selectedEditorPositions.includes(label) ? [] : [label]
        set({ selectedEditorPositions: next })
      },

      loadRangeForEdit: (id) => {
        const { ranges, brush } = get()
        const r = ranges.find(x => x.id === id)
        if (!r) return
        const tSize: TableSize = r.tableSize || 6
        const positions = tSize === 6 ? POS_6MAX : POS_8MAX
        const slots = tSize === 6 ? SLOTS_6MAX : SLOTS_8MAX
        const ante = r.scenarios?.[0]?.ante ?? 0
        const brushExtra = r.customAction
          ? { extraLabel: r.customAction.label, extraColor: r.customAction.color, extra: brush.extra }
          : { extraLabel: '', extraColor: '#a855f7', extra: 0 }

        if (r.stackGrids && r.stackGrids.length > 0) {
          // Load all stackGrids as session badges — editor starts empty so the user
          // sees all variants up front and clicks one to edit.
          const sessionGridsFromRange: SessionGrid[] = r.stackGrids.map(sg => ({
            name: sg.name ?? r.name,
            stackRange: sg.stackRange,
            grid: JSON.parse(JSON.stringify(sg.grid)),
            positions: [...r.positions],
          }))
          set({
            rangeData: { id: r.id, name: '', positions: r.positions, grid: makeEmptyGrid(), tableSize: tSize, stackRange: '', ...(r.prereqRangeId !== undefined ? { prereqRangeId: r.prereqRangeId } : {}) },
            tempScenarios: r.scenarios ? JSON.parse(JSON.stringify(r.scenarios)) : [],
            selectedEditorPositions: [],
            currentTableSize: tSize,
            sessionGrids: sessionGridsFromRange,
            brush: { ...brush, ...brushExtra },
            activePositions: positions,
            activeSlots: slots,
            currentAnte: ante,
            page: 'editor',
          })
        } else {
          set({
            rangeData: { id: r.id, name: r.name, positions: r.positions, grid: JSON.parse(JSON.stringify(r.grid)), tableSize: tSize, stackRange: r.stackRange ?? '', ...(r.prereqRangeId !== undefined ? { prereqRangeId: r.prereqRangeId } : {}) },
            tempScenarios: r.scenarios ? JSON.parse(JSON.stringify(r.scenarios)) : [],
            selectedEditorPositions: [...r.positions],
            currentTableSize: tSize,
            sessionGrids: [],
            brush: { ...brush, ...brushExtra },
            activePositions: positions,
            activeSlots: slots,
            currentAnte: ante,
            page: 'editor',
          })
        }
      },

      sessionRangeIds: [],

      // ── Table editor ──────────────────────────────────────────────────────────
      currentScenario: {},
      tempScenarios: [],
      currentHeroRaiseSize: 0,
      currentHasStraddle: false,

      setupNewRange: (size, hasStraddle, ante) => {
        const { brush } = get()
        const positions = size === 6 ? POS_6MAX : POS_8MAX
        const slots = size === 6 ? SLOTS_6MAX : SLOTS_8MAX
        const scenario: Record<string, PositionConfig> = {}
        positions.forEach(pos => {
          let role: PositionConfig['role'] = 'fold'
          let bet = 0
          if (pos.id === 'sb') { role = 'post'; bet = 0.5 }
          else if (pos.id === 'bb') { role = 'post'; bet = 1.0 }
          else if (pos.id === 'str' && hasStraddle) { role = 'post'; bet = 2.0 }
          scenario[pos.id] = { role, bet, isHero: false, stack: 250 }
        })
        set({
          currentTableSize: size,
          activePositions: positions,
          activeSlots: slots,
          currentAnte: ante,
          currentHasStraddle: hasStraddle,
          currentScenario: scenario,
          currentHeroRaiseSize: 0,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: size, stackRange: '' },
          tempScenarios: [],
          selectedEditorPositions: [],
          sessionGrids: [],
          brush: { ...brush, extra: 0, extraLabel: '', extraColor: '#a855f7' },
          page: 'editor',
        })
      },

      initTableConfig: () => {
        const { activePositions, currentAnte, currentHasStraddle } = get()
        const scenario: Record<string, PositionConfig> = {}
        activePositions.forEach(pos => {
          let role: PositionConfig['role'] = 'fold'
          let bet = 0
          if (pos.id === 'sb') { role = 'post'; bet = 0.5 }
          else if (pos.id === 'bb') { role = 'post'; bet = 1.0 }
          else if (pos.id === 'str' && currentHasStraddle) { role = 'post'; bet = 2.0 }
          scenario[pos.id] = { role, bet, isHero: false, stack: 250 }
        })
        set({ currentScenario: scenario, currentAnte })
      },

      updateHero: (pid) => {
        const { currentScenario, activePositions } = get()
        const next = { ...currentScenario }
        activePositions.forEach(p => { next[p.id] = { ...next[p.id], isHero: p.id === pid } })
        set({ currentScenario: next })
      },

      updateRole: (pid, role) => {
        const { currentScenario, currentTableSize } = get()
        const cur = currentScenario[pid]
        let bet = cur?.bet ?? 0

        if (role === 'post') {
          if (pid === 'sb') bet = 0.5
          else if (pid === 'bb') bet = 1.0
          else if (pid === 'str') bet = 2.0
        } else if (role === 'fold') {
          if (pid === 'sb') bet = 0.5
          else if (pid === 'bb') bet = 1.0
          else if (pid === 'str') bet = 2.0
          else bet = 0
        } else if (role === 'open') {
          bet = currentTableSize === 8 ? 6 : 2.5
        } else if (role === 'limp' || role === 'limp-fold') {
          bet = currentTableSize === 8 ? 2 : 1
        } else if (role === 'call') {
          const bets = Object.entries(currentScenario).filter(([k]) => k !== pid).map(([, d]) => d.bet)
          bet = bets.length > 0 ? Math.max(0, ...bets) : 0
        } else if (role === '3bet' || role === 'iso') {
          const bets = Object.entries(currentScenario).filter(([k]) => k !== pid).map(([, d]) => d.bet)
          const maxBet = bets.length > 0 ? Math.max(0, ...bets) : 0
          bet = parseFloat((maxBet * 3).toFixed(1))
        } else if (role === 'allin') {
          bet = cur?.stack ?? 100
        }

        set({ currentScenario: { ...currentScenario, [pid]: { ...cur, role: role as PositionConfig['role'], bet } } })
      },

      updateBet: (pid, val) => {
        const { currentScenario } = get()
        set({ currentScenario: { ...currentScenario, [pid]: { ...currentScenario[pid], bet: val } } })
      },

      updateStack: (pid, val) => {
        const { currentScenario } = get()
        set({ currentScenario: { ...currentScenario, [pid]: { ...currentScenario[pid], stack: val } } })
      },

      setCurrentAnte: (val) => set({ currentAnte: val }),

      setHeroRaiseSize: (val) => set({ currentHeroRaiseSize: val }),

      setAllStacks: (val) => {
        const { currentScenario } = get()
        const next = { ...currentScenario }
        Object.keys(next).forEach(pid => { next[pid] = { ...next[pid], stack: val } })
        set({ currentScenario: next })
      },

      addScenarioToBuffer: (pot, summary) => {
        const { currentScenario, tempScenarios, currentAnte, currentHeroRaiseSize } = get()
        const scenObj: Scenario = {
          id: Date.now(),
          data: JSON.parse(JSON.stringify(currentScenario)),
          pot,
          ante: currentAnte,
          summary,
          ...(currentHeroRaiseSize > 0 ? { heroRaiseSize: currentHeroRaiseSize } : {}),
        }
        set({ tempScenarios: [...tempScenarios, scenObj] })
      },

      updateScenarioInBuffer: (idx, pot, summary) => {
        const { tempScenarios, currentScenario, currentAnte, currentHeroRaiseSize } = get()
        const updated = tempScenarios.map((s, i) => i !== idx ? s : {
          ...s,
          data: JSON.parse(JSON.stringify(currentScenario)),
          pot,
          ante: currentAnte,
          summary,
          heroRaiseSize: currentHeroRaiseSize > 0 ? currentHeroRaiseSize : undefined,
        })
        set({ tempScenarios: updated })
      },

      removeScenario: (idx) => {
        const { tempScenarios } = get()
        set({ tempScenarios: tempScenarios.filter((_, i) => i !== idx) })
      },

      loadScenarioFromBuffer: (idx) => {
        const { tempScenarios } = get()
        const scen = tempScenarios[idx]
        if (!scen) return
        set({
          currentScenario: JSON.parse(JSON.stringify(scen.data)),
          currentHeroRaiseSize: scen.heroRaiseSize ?? 0,
          currentAnte: scen.ante,
        })
      },

      finalizeRange: (primaryName) => {
        const { rangeData, tempScenarios, ranges, currentTableSize, selectedEditorPositions, brush, sessionGrids } = get()
        const prereqId = rangeData.prereqRangeId
        const isEditing = rangeData.id !== null
        const baseId = Date.now()
        const scenarios: Scenario[] = JSON.parse(JSON.stringify(tempScenarios))
        const customAction = brush.extraLabel ? { label: brush.extraLabel, color: brush.extraColor } : undefined

        // Group all grids (session + current) by position
        type GridEntry = { name: string; stackRange: string; grid: Record<string, HandData>; positions: string[] }
        const currentEntry: GridEntry[] = selectedEditorPositions.length > 0
          ? [{ name: rangeData.name, stackRange: rangeData.stackRange, grid: JSON.parse(JSON.stringify(rangeData.grid)), positions: [...selectedEditorPositions] }]
          : []
        // Deduplicate: for each (posKey + stackRange) pair keep only the last entry
        const rawEntries: GridEntry[] = [...sessionGrids, ...currentEntry]
        const seenSlots = new Map<string, number>()
        rawEntries.forEach((g, i) => {
          const slot = [...g.positions].sort().join(',') + '|' + (g.stackRange ?? '')
          seenSlots.set(slot, i)
        })
        const allEntries: GridEntry[] = rawEntries.filter((_, i) =>
          [...seenSlots.values()].includes(i)
        ).filter(g => Object.values(g.grid).some(h => h.fold < 100))

        const groups = new Map<string, GridEntry[]>()
        allEntries.forEach(g => {
          const key = [...g.positions].sort().join(',')
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(g)
        })

        // Resolve which positions identify the "primary" range being edited.
        // Three fallbacks handle the case where the editor is empty (all grids in session).
        const primaryPositions =
          selectedEditorPositions.length > 0 ? selectedEditorPositions :
          rangeData.positions.length > 0     ? rangeData.positions :
          isEditing ? (ranges.find(r => r.id === rangeData.id)?.positions ?? []) :
          []
        const primaryKey = [...primaryPositions].sort().join(',')
        let idSeed = baseId
        const groupedRanges: Range[] = []
        groups.forEach((grids, posKey) => {
          idSeed++
          const thisId = isEditing && posKey === primaryKey ? rangeData.id! : idSeed
          const prereqSpread = prereqId !== undefined ? { prereqRangeId: prereqId } : {}
          if (grids.length === 1) {
            const g = grids[0]
            groupedRanges.push({
              id: thisId,
              name: g.name,
              positions: g.positions,
              grid: JSON.parse(JSON.stringify(g.grid)),
              scenarios,
              tableSize: currentTableSize,
              ...(customAction ? { customAction } : {}),
              ...(g.stackRange ? { stackRange: g.stackRange } : {}),
              ...prereqSpread,
            })
          } else {
            const stackGridsList: StackGrid[] = grids.map(g => ({
              stackRange: g.stackRange,
              grid: JSON.parse(JSON.stringify(g.grid)),
              name: g.name,
            }))
            groupedRanges.push({
              id: thisId,
              name: primaryName ?? grids[0].name,
              positions: grids[0].positions,
              grid: JSON.parse(JSON.stringify(grids[0].grid)),
              stackGrids: stackGridsList,
              scenarios,
              tableSize: currentTableSize,
              ...(customAction ? { customAction } : {}),
              ...prereqSpread,
            })
          }
        })

        let newRanges: Range[]
        if (isEditing) {
          const editedId = rangeData.id!
          const primary = groupedRanges.find(r => r.id === editedId)
          const extras = groupedRanges.filter(r => r.id !== editedId)
          const editedIdx = ranges.findIndex(r => r.id === editedId)
          if (editedIdx !== -1 && primary) {
            newRanges = ranges.map(r => r.id === editedId ? primary : r)
            newRanges = [...newRanges, ...extras]
          } else {
            newRanges = [...ranges, ...groupedRanges]
          }
        } else {
          newRanges = [...ranges, ...groupedRanges]
        }

        saveRanges(newRanges)
        addBreadcrumb('range', isEditing ? 'edit saved' : 'create saved', { total: newRanges.length })
        set({
          ranges: newRanges,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: currentTableSize, stackRange: '' },
          tempScenarios: [],
          selectedEditorPositions: [],
          sessionGrids: [],
          page: 'ranges',
        })
      },

      sessionGrids: [],

      pushGridToSession: () => {
        const { rangeData, selectedEditorPositions, sessionGrids } = get()
        const sg: SessionGrid = {
          name: rangeData.name,
          stackRange: rangeData.stackRange,
          grid: JSON.parse(JSON.stringify(rangeData.grid)),
          positions: [...selectedEditorPositions],
        }
        set({
          sessionGrids: [...sessionGrids, sg],
          rangeData: { ...rangeData, name: '', grid: makeEmptyGrid(), stackRange: '' },
          selectedEditorPositions: [],
        })
      },

      updateSessionGrid: (idx, sg) => {
        const { sessionGrids } = get()
        set({ sessionGrids: sessionGrids.map((s, i) => i === idx ? sg : s) })
      },

      removeSessionGrid: (idx) => {
        const { sessionGrids } = get()
        set({ sessionGrids: sessionGrids.filter((_, i) => i !== idx) })
      },

      // ── Hand performance (heatmap) ────────────────────────────────────────────
      handPerformance: loadHandPerf(),

      clearHandPerformance: (rangeId) => {
        const { handPerformance } = get()
        const next = { ...handPerformance }
        delete next[rangeId]
        const prefix = `${rangeId}|||`
        Object.keys(next).forEach(k => { if (k.startsWith(prefix)) delete next[k] })
        saveHandPerf(next)
        set({ handPerformance: next })
      },

      // ── Saved ranges management ────────────────────────────────────────────────
      deleteRange: (id) => {
        const { ranges } = get()
        const newRanges = ranges.filter(r => r.id !== id)
        saveRanges(newRanges)
        const adminIds = new Set(SEEDED_DEFAULTS.map(r => r.id))
        if (adminIds.has(id)) addDeletedAdminId(id)
        addBreadcrumb('range', 'delete', { admin: adminIds.has(id) })
        set({ ranges: newRanges })
      },
      setRangePrereq: (rangeId, prereqId) => {
        const { ranges } = get()
        const newRanges = ranges.map(r =>
          r.id === rangeId
            ? { ...r, prereqRangeId: prereqId ?? undefined }
            : r
        )
        saveRanges(newRanges)
        set({ ranges: newRanges })
      },
      rangesFilter: 'ALL',
      setRangesFilter: (f) => set({ rangesFilter: f }),

      // ── Drill ─────────────────────────────────────────────────────────────────
      useRngForFrequency: false,
      setUseRng: (val) => set({ useRngForFrequency: val }),
      acceptAnyFreq: false,
      setAcceptAnyFreq: (val) => set({ acceptAnyFreq: val }),
      focusErrors: false,
      setFocusErrors: (val) => set({ focusErrors: val }),
      sessionHandPerf: {},
      sessionSeverity: { grave: 0, impreciso: 0 },

      selectedDrillRangeIds: [],
      drillExcludedHands: [],
      activeDrillRange: null,
      activeDrillStackRange: '',
      activeDrillStackGridIdx: -1,
      activeHand: '',
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      handHistory: [],
      currentRng: 0,
      correctActionForCurrentHand: 'Fold',
      correctActionsForCurrentHand: ['Fold'],
      currentHandSuits: ['h', 's'],
      sessionStartTime: 0,
      sessionUuid: '',

      toggleDrillRange: (id) => {
        const { selectedDrillRangeIds } = get()
        const next = selectedDrillRangeIds.includes(id)
          ? selectedDrillRangeIds.filter(x => x !== id)
          : [...selectedDrillRangeIds, id]
        set({ selectedDrillRangeIds: next })
      },

      clearDrillRanges: () => set({ selectedDrillRangeIds: [] }),

      setDrillExcluded: (hands) => set({ drillExcludedHands: hands }),

      toggleDrillHand: (hand) => {
        const { drillExcludedHands } = get()
        const next = drillExcludedHands.includes(hand)
          ? drillExcludedHands.filter(h => h !== hand)
          : [...drillExcludedHands, hand]
        set({ drillExcludedHands: next })
      },

      setAllDrillHands: (included) => {
        set({ drillExcludedHands: included ? [] : [...ALL_HANDS] })
      },

      startDrillSession: () => {
        addBreadcrumb('drill', 'start', { ranges: get().selectedDrillRangeIds.length })
        const usedIds = new Set(get().trainingHistory.map(s => s.id))
        let sid = Date.now()
        while (usedIds.has(sid)) sid++
        set({
          sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
          handHistory: [],
          sessionHandPerf: {},
          sessionSeverity: { grave: 0, impreciso: 0 },
          sessionStartTime: sid,
          sessionUuid: crypto.randomUUID(),
        })
      },

      nextDrillHand: () => {
        const { ranges, selectedDrillRangeIds, drillExcludedHands } = get()

        type Candidate = {
          range: Range
          hand: string
          scenario: Record<string, PositionConfig>
          ante: number
          heroRaiseSize: number
          stackGridIdx: number
          stackRangeLabel: string
          activeGrid: Record<string, HandData>
        }

        // Two-level sampling: each selected range gets equal probability (Level 1),
        // then a (scenario, hand) pair is picked uniformly within that range (Level 2).
        // This prevents ranges with more scenarios or hands from dominating the session.
        const byRange = new Map<number, Candidate[]>()

        selectedDrillRangeIds.forEach(id => {
          const r = ranges.find(x => x.id === id)
          if (!r) return

          const pool: Candidate[] = []
          const scenarios = r.scenarios?.length > 0 ? r.scenarios : [null as null]

          scenarios.forEach(scen => {
            const newScenario: Record<string, PositionConfig> = scen?.data ?? {}
            const ante = scen?.ante ?? 0
            const heroRaiseSize = scen?.heroRaiseSize ?? 0

            let stackGridIdx = -1
            let stackRangeLabel = ''
            if (r.stackGrids && r.stackGrids.length > 0) {
              const heroStack = Object.values(newScenario).find(p => p.isHero)?.stack ?? 0
              const matched = heroStack > 0
                ? r.stackGrids.findIndex(sg => stackMatchesRange(heroStack, sg.stackRange))
                : -1
              if (heroStack > 0 && matched === -1) return
              stackGridIdx = matched !== -1 ? matched : 0
              stackRangeLabel = r.stackGrids[stackGridIdx].stackRange
            }

            const activeGrid = stackGridIdx >= 0 && r.stackGrids
              ? r.stackGrids[stackGridIdx].grid
              : r.grid

            const prereqGrid = r.prereqRangeId
              ? (() => {
                  const pr = ranges.find(x => x.id === r.prereqRangeId)
                  if (!pr) return null
                  if (pr.stackGrids && pr.stackGrids.length > 0) {
                    const heroStack = Object.values(newScenario).find(p => p.isHero)?.stack ?? 0
                    const matched = heroStack > 0
                      ? pr.stackGrids.findIndex(sg => stackMatchesRange(heroStack, sg.stackRange))
                      : -1
                    return pr.stackGrids[matched !== -1 ? matched : 0].grid
                  }
                  return pr.grid
                })()
              : null

            if (prereqGrid) {
              // Com prereq, o filtro manual de mãos (drillExcludedHands) é ignorado:
              // os candidatos vêm das mãos não-fold do prereqGrid.
              ALL_HANDS
                .filter(h => (prereqGrid[h]?.fold ?? 100) < 100)
                .forEach(hand => pool.push({ range: r, hand, scenario: newScenario, ante, heroRaiseSize, stackGridIdx, stackRangeLabel, activeGrid }))
            } else {
              ALL_HANDS
                .filter(h => !drillExcludedHands.includes(h))
                .forEach(hand => pool.push({ range: r, hand, scenario: newScenario, ante, heroRaiseSize, stackGridIdx, stackRangeLabel, activeGrid }))
            }
          })

          if (pool.length > 0) byRange.set(id, pool)
        })

        const eligibleIds = [...byRange.keys()]
        if (eligibleIds.length === 0) return false

        // Level 1: uniform range selection
        const pickedId = eligibleIds[Math.floor(Math.random() * eligibleIds.length)]
        const pool = byRange.get(pickedId)!

        // Level 2: (scenario, hand) selection within the range. Uniforme por padrão;
        // com "Focar erros" ligado, ponderado pelo desempenho acumulado do range.
        const { focusErrors, handPerformance } = get()
        let pick: Candidate
        if (focusErrors) {
          const perfMap = handPerformance[pickedId] ?? {}
          const weights = pool.map(c => focusWeight(perfMap[c.hand]))
          pick = weightedPick(pool, weights)
        } else {
          pick = pool[Math.floor(Math.random() * pool.length)]
        }
        const { range, hand, scenario: newScenario, ante: newAnte, heroRaiseSize: heroRaiseFromScen, stackGridIdx: finalStackGridIdx, stackRangeLabel, activeGrid } = pick

        const rSize: TableSize = range.tableSize || 6
        const activePos = rSize === 6 ? POS_6MAX : POS_8MAX
        const activeSlts = rSize === 6 ? SLOTS_6MAX : SLOTS_8MAX

        const rng = Math.ceil(Math.random() * 100)
        const handData = activeGrid[hand]
        const { useRngForFrequency } = get()
        const extraLabel = range.customAction?.label
        let correctAction: string
        let correctActions: string[]
        if (useRngForFrequency) {
          correctAction = getRngCorrectAction(handData, rng, extraLabel)
          correctActions = [correctAction]
        } else {
          correctActions = getTopFrequencyActions(handData, extraLabel)
          correctAction = correctActions.join(' ou ')
        }
        const suits = generateSuits(hand)

        set({
          activeDrillRange: range,
          activeDrillStackRange: stackRangeLabel,
          activeDrillStackGridIdx: finalStackGridIdx,
          activeHand: hand,
          currentScenario: newScenario,
          currentAnte: newAnte,
          activePositions: activePos,
          activeSlots: activeSlts,
          currentTableSize: rSize,
          currentRng: rng,
          correctActionForCurrentHand: correctAction,
          correctActionsForCurrentHand: correctActions,
          currentHandSuits: suits,
          currentHeroRaiseSize: heroRaiseFromScen,
        })
        return true
      },

      checkDrillAnswer: (action) => {
        const {
          activeDrillRange, activeDrillStackGridIdx, activeHand, sessionStats,
          currentRng, currentHandSuits, handHistory, useRngForFrequency, acceptAnyFreq,
        } = get()
        if (!activeDrillRange) return { correct: false, message: '' }

        const stackGrid = activeDrillStackGridIdx >= 0
          ? activeDrillRange.stackGrids?.[activeDrillStackGridIdx]
          : undefined
        const activeGrid = stackGrid?.grid ?? activeDrillRange.grid
        const d = activeGrid[activeHand]
        const extraLabel = activeDrillRange.customAction?.label

        // Recompute from grid at check time — trava de segurança contra estado desatualizado
        let correctAction: string
        let correctActions: string[]
        if (useRngForFrequency) {
          correctAction = getRngCorrectAction(d, currentRng, extraLabel)
          correctActions = [correctAction]
        } else {
          correctActions = getTopFrequencyActions(d, extraLabel)
          correctAction = correctActions.join(' ou ')
        }

        const freqOf = (act: string): number => {
          if (!d) return act === 'Fold' ? 100 : 0
          if (act === 'Fold') return d.fold ?? 0
          if (act === 'Call') return d.call ?? 0
          if (act === 'Raise') return d.raise ?? 0
          if (act === 'Allin') return d.allin ?? 0
          if (extraLabel && act === extraLabel) return d.extra ?? 0
          return 0
        }

        const isPrincipal = correctActions.includes(action)
        // Modo menos binário (RNG off): qualquer ação com frequência > 0 é aceita.
        const validNotPrincipal = !isPrincipal && !useRngForFrequency && acceptAnyFreq && freqOf(action) > 0
        const correct = isPrincipal || validNotPrincipal

        // Severidade do erro: 'grave' = ação respondida tem 0% na mão; 'impreciso' = freq > 0 mas não é a principal.
        const severity: 'grave' | 'impreciso' | undefined = correct
          ? undefined
          : (freqOf(action) > 0 ? 'impreciso' : 'grave')

        const stats = { ...sessionStats, hands: sessionStats.hands + 1 }
        if (correct) stats.correct++; else stats.errors++

        const { activeDrillStackRange: stackRange } = get()
        const rid = activeDrillRange.id
        const entry: HandHistoryEntry = {
          id: Date.now(),
          hand: activeHand,
          suits: currentHandSuits,
          actionTaken: action,
          correctAction,
          rng: currentRng,
          correct,
          rangeName: activeDrillRange.name,
          rangeId: rid,
          stackGridIdx: activeDrillStackGridIdx,
          raiseSize: d?.size,
          stackRange: stackRange || undefined,
          ...(severity ? { severity } : {}),
        }
        const accumulate = (map: HandPerfMap): HandPerfMap => {
          const prev = map[rid]?.[activeHand] ?? { c: 0, t: 0 }
          const next: HandPerfMap = {
            ...map,
            [rid]: { ...map[rid], [activeHand]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } },
          }
          if (stackRange) {
            const sk = `${rid}|||${stackRange}`
            const prevSk = map[sk]?.[activeHand] ?? { c: 0, t: 0 }
            next[sk] = { ...map[sk], [activeHand]: { c: prevSk.c + (correct ? 1 : 0), t: prevSk.t + 1 } }
          }
          return next
        }
        const { handPerformance, sessionHandPerf, sessionSeverity, sessionStartTime, trainingHistory, selectedDrillRangeIds, ranges, currentTableSize } = get()
        const newPerf = accumulate(handPerformance)
        const newSessionPerf = accumulate(sessionHandPerf)
        saveHandPerf(newPerf)

        // Grava a sessão em andamento no histórico a cada mão (upsert pelo id =
        // sessionStartTime): treinou 1 mão, ela já está salva mesmo sem encerrar.
        let newTrainingHistory = trainingHistory
        if (sessionStartTime > 0) {
          newTrainingHistory = upsertSession(trainingHistory, {
            id: sessionStartTime,
            timestamp: sessionStartTime,
            rangeNames: ranges.filter(r => selectedDrillRangeIds.includes(r.id)).map(r => r.name),
            tableSize: currentTableSize,
            hands: stats.hands,
            correct: stats.correct,
            errors: stats.errors,
            consults: stats.consults,
            durationSeconds: Math.round((Date.now() - sessionStartTime) / 1000),
            handPerf: JSON.parse(JSON.stringify(newSessionPerf)),
          })
          saveHistory(newTrainingHistory)
        }

        set({
          sessionStats: stats,
          handHistory: [...handHistory, entry].slice(-50),
          handPerformance: newPerf,
          sessionHandPerf: newSessionPerf,
          trainingHistory: newTrainingHistory,
          sessionSeverity: severity
            ? { grave: sessionSeverity.grave + (severity === 'grave' ? 1 : 0), impreciso: sessionSeverity.impreciso + (severity === 'impreciso' ? 1 : 0) }
            : sessionSeverity,
          correctActionForCurrentHand: correctAction,
          correctActionsForCurrentHand: correctActions,
        })

        fireEvent('hand', {
          rangeId: rid,
          rangeName: activeDrillRange.name,
          hand: activeHand,
          actionTaken: action,
          correctAction,
          isCorrect: correct ? 1 : 0,
          severity: severity ?? null,
          rng: useRngForFrequency ? currentRng : null,
          stackRange: stackGrid?.stackRange ?? null,
          stackGridIdx: activeDrillStackGridIdx,
          session_uuid: get().sessionUuid || null,
          client_event_id: crypto.randomUUID(),
        }, get().authToken)

        const rngTag = useRngForFrequency ? t.feedback.rngTag(currentRng) : ''
        let message: string
        if (validNotPrincipal) {
          const principalLabel = correctActions.map(a => `${a} ${freqOf(a)}%`).join(' ou ')
          message = t.feedback.valid(principalLabel)
        } else if (correct) {
          message = t.feedback.correct(action, rngTag)
        } else if (severity === 'grave') {
          message = t.feedback.blunder(action, correctAction, rngTag)
        } else {
          const principalLabel = correctActions.map(a => `${a} ${freqOf(a)}%`).join(' ou ')
          message = t.feedback.imprecise(action, freqOf(action), principalLabel, rngTag)
        }
        return { correct, message, severity }
      },

      stopDrill: () => {
        const { sessionStats, selectedDrillRangeIds, ranges, currentTableSize, sessionStartTime, trainingHistory, sessionHandPerf } = get()
        let newHistory = trainingHistory
        if (sessionStats.hands > 0) {
          // sessionHandPerf é o acumulador da sessão inteira (não limitado ao cap de 50 do histórico visual),
          // chaveado por rangeId e rangeId|||stackRange.
          const handPerf: Record<string, Record<string, { c: number; t: number }>> = JSON.parse(JSON.stringify(sessionHandPerf))
          const sid = sessionStartTime > 0 ? sessionStartTime : Date.now()
          const session: TrainingSession = {
            id: sid,
            timestamp: sid,
            rangeNames: ranges.filter(r => selectedDrillRangeIds.includes(r.id)).map(r => r.name),
            tableSize: currentTableSize,
            hands: sessionStats.hands,
            correct: sessionStats.correct,
            errors: sessionStats.errors,
            consults: sessionStats.consults,
            durationSeconds: sessionStartTime > 0 ? Math.round((Date.now() - sessionStartTime) / 1000) : 0,
            handPerf,
          }
          newHistory = upsertSession(trainingHistory, session)
          saveHistory(newHistory)
          fireEvent('session-end', {
            rangeNames: session.rangeNames,
            hands: session.hands,
            correct: session.correct,
            errors: session.errors,
            consults: session.consults,
            durationSeconds: session.durationSeconds,
            startedAt: Math.floor(sessionStartTime / 1000),
            session_uuid: get().sessionUuid || null,
          }, get().authToken)
        }
        set({
          activeDrillRange: null,
          activeDrillStackRange: '',
          activeDrillStackGridIdx: -1,
          activeHand: '',
          page: 'drill',
          trainingHistory: newHistory,
        })
      },

      logConsult: (rangeId, rangeName, hand) => {
        // increment de sessionStats.consults já acontece via incrementConsults nos call sites
        fireEvent('consult', { rangeId, rangeName, hand: hand ?? null, session_uuid: get().sessionUuid || null }, get().authToken)
      },

      incrementConsults: () => {
        const { sessionStats } = get()
        set({ sessionStats: { ...sessionStats, consults: sessionStats.consults + 1 } })
      },

      // ── Montar Range (exercício) ─────────────────────────────────────────────
      buildSelectedRangeIds: [],
      buildRounds: [],
      buildRoundIdx: 0,
      buildResults: [],
      buildLastResult: null,
      buildSessionUuid: '',
      buildSessionId: 0,
      buildConfirmed: false,
      buildAttempt: 1,
      buildHistory: loadBuildHistory(),

      toggleBuildRange: (id) => {
        const { buildSelectedRangeIds } = get()
        const next = buildSelectedRangeIds.includes(id)
          ? buildSelectedRangeIds.filter(x => x !== id)
          : [...buildSelectedRangeIds, id]
        set({ buildSelectedRangeIds: next })
      },

      startBuildSession: () => {
        const { ranges, buildSelectedRangeIds, brush, currentTableSize } = get()
        const rounds: BuildRound[] = []
        buildSelectedRangeIds.forEach(id => {
          const r = ranges.find(x => x.id === id)
          if (!r) return
          if (r.stackGrids && r.stackGrids.length > 0) {
            r.stackGrids.forEach(sg => rounds.push({
              rangeId: r.id,
              rangeName: r.name,
              stackRange: sg.stackRange,
              label: sg.stackRange ? `${sg.name ?? r.name} — ${sg.stackRange}` : (sg.name ?? r.name),
              grid: JSON.parse(JSON.stringify(sg.grid)),
              ...(r.customAction ? { customAction: r.customAction } : {}),
            }))
          } else {
            rounds.push({
              rangeId: r.id,
              rangeName: r.name,
              stackRange: r.stackRange ?? '',
              label: r.stackRange ? `${r.name} — ${r.stackRange}` : r.name,
              grid: JSON.parse(JSON.stringify(r.grid)),
              ...(r.customAction ? { customAction: r.customAction } : {}),
            })
          }
        })
        if (rounds.length === 0) return false
        addBreadcrumb('build', 'start', { rounds: rounds.length })
        const first = rounds[0]
        const usedIds = new Set(get().buildHistory.map(s => s.id))
        let sid = Date.now()
        while (usedIds.has(sid)) sid++
        set({
          buildRounds: rounds,
          buildRoundIdx: 0,
          buildResults: [],
          buildLastResult: null,
          buildSessionUuid: crypto.randomUUID(),
          buildSessionId: sid,
          buildConfirmed: false,
          buildAttempt: 1,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: currentTableSize, stackRange: '' },
          brush: {
            ...brush, call: 0, raise: 0, allin: 0, extra: 0,
            extraLabel: first.customAction?.label ?? '',
            extraColor: first.customAction?.color ?? '#a855f7',
          },
        })
        return true
      },

      confirmBuildSession: () => set({ buildConfirmed: true }),

      submitBuildRound: () => {
        const { buildRounds, buildRoundIdx, buildResults, buildLastResult, buildAttempt, rangeData, buildSessionId, buildHistory } = get()
        const round = buildRounds[buildRoundIdx]
        if (!round || buildLastResult) return
        const userGrid: Record<string, HandData> = JSON.parse(JSON.stringify(rangeData.grid))
        const { score, perHand } = scoreBuild(round.grid, userGrid)
        const newResults = [...buildResults, { roundIdx: buildRoundIdx, label: round.label, score, attempt: buildAttempt, userGrid, perHand }]
        const sid = buildSessionId || Date.now()
        const newHistory = upsertSession(buildHistory, makeBuildSession(sid, buildRounds, newResults))
        saveBuildHistory(newHistory)
        set({
          buildResults: newResults,
          buildLastResult: { score, perHand, userGrid },
          buildSessionId: sid,
          buildHistory: newHistory,
        })
        fireEvent('range-build', {
          rangeId: round.rangeId,
          rangeName: round.rangeName,
          stackRange: round.stackRange || null,
          score: Math.round(score * 10) / 10,
          attempt: buildAttempt,
          roundsTotal: buildRounds.length,
          session_uuid: get().buildSessionUuid || null,
          client_event_id: crypto.randomUUID(),
        }, get().authToken)
      },

      retryBuildRound: () => {
        const { buildRounds, buildRoundIdx, buildLastResult, buildAttempt, brush, currentTableSize } = get()
        const round = buildRounds[buildRoundIdx]
        if (!round || !buildLastResult) return
        set({
          buildLastResult: null,
          buildAttempt: buildAttempt + 1,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: currentTableSize, stackRange: '' },
          brush: {
            ...brush, call: 0, raise: 0, allin: 0, extra: 0,
            extraLabel: round.customAction?.label ?? '',
            extraColor: round.customAction?.color ?? '#a855f7',
          },
        })
      },

      nextBuildRound: () => {
        const { buildRounds, buildRoundIdx, brush, currentTableSize } = get()
        const nextIdx = buildRoundIdx + 1
        const next = buildRounds[nextIdx]
        set({
          buildRoundIdx: nextIdx,
          buildLastResult: null,
          buildAttempt: 1,
          ...(next ? {
            rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: currentTableSize, stackRange: '' },
            brush: {
              ...brush, call: 0, raise: 0, allin: 0, extra: 0,
              extraLabel: next.customAction?.label ?? '',
              extraColor: next.customAction?.color ?? '#a855f7',
            },
          } : {}),
        })
      },

      stopBuildSession: () => {
        const { buildRounds, buildResults, buildHistory, buildSessionId, currentTableSize } = get()
        let newHistory = buildHistory
        if (buildResults.length > 0) {
          const sid = buildSessionId || Date.now()
          const session = makeBuildSession(sid, buildRounds, buildResults)
          newHistory = upsertSession(buildHistory, session)
          saveBuildHistory(newHistory)
          addBreadcrumb('build', 'stop', { rounds: buildResults.length, avg: session.avgScore })
        }
        set({
          buildRounds: [],
          buildRoundIdx: 0,
          buildResults: [],
          buildLastResult: null,
          buildSessionUuid: '',
          buildSessionId: 0,
          buildConfirmed: false,
          buildAttempt: 1,
          buildHistory: newHistory,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: currentTableSize, stackRange: '' },
        })
      },

      // ── Auth ────────────────────────────────────────────────────────────────────
      userMode: null,
      adminToken: null,
      logout: () => set({ userMode: null, adminToken: null }),

      // ── Conta (opt-in, D1) ──────────────────────────────────────────────────────
      currentUser: null,
      authToken: null,
      justSignedUp: false,
      authLogin: async (username, password, turnstileToken) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, turnstileToken: turnstileToken ?? undefined }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          sessionStorage.setItem('pfp-auth-token', data.token)
          set({
            authToken: data.token,
            currentUser: { id: data.user.id, username: data.user.username, name: data.user.name ?? '', email: data.user.email ?? '', role: data.user.role, firstLogin: !!data.user.first_login },
            userMode: data.user.role === 'coach' ? 'admin' : 'visitor',
            justSignedUp: false,
          })
          addBreadcrumb('auth', 'login ok', { role: data.user.role })
          void flush(data.token)
          void get().syncTeamRanges()
          return { ok: true }
        } catch (e) { captureError(e, { area: 'auth-login' }); return { ok: false, error: t.netErrors.connection } }
      },
      authSignup: async (username, password, teamCode, name, email, turnstileToken) => {
        try {
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, teamCode, name, email, turnstileToken: turnstileToken ?? undefined }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          sessionStorage.setItem('pfp-auth-token', data.token)
          set({
            authToken: data.token,
            currentUser: { id: data.user.id, username: data.user.username, name: data.user.name ?? '', email: data.user.email ?? '', role: data.user.role, firstLogin: !!data.user.first_login },
            userMode: data.user.role === 'coach' ? 'admin' : 'visitor',
            justSignedUp: true,
          })
          return { ok: true }
        } catch (e) { captureError(e, { area: 'auth-signup' }); return { ok: false, error: t.netErrors.connection } }
      },
      authLogout: async () => {
        const { authToken } = get()
        if (authToken) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { Authorization: `Bearer ${authToken}` },
            })
          } catch { /* logout local mesmo offline */ }
        }
        sessionStorage.removeItem('pfp-auth-token')
        addBreadcrumb('auth', 'logout')
        set({ currentUser: null, authToken: null, userMode: null, adminToken: null, justSignedUp: false })
      },
      changePassword: async (newPassword) => {
        const { authToken, currentUser } = get()
        if (!authToken) return { ok: false, error: 'Não autenticado' }
        try {
          const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ newPassword }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          if (currentUser) set({ currentUser: { ...currentUser, firstLogin: false } })
          return { ok: true }
        } catch (e) { captureError(e, { area: 'change-password' }); return { ok: false, error: t.netErrors.connection } }
      },
      listDevices: async () => {
        const { authToken } = get()
        if (!authToken) return { ok: false, error: 'Não autenticado' }
        try {
          const res = await fetch('/api/me/devices', { headers: { Authorization: `Bearer ${authToken}` } })
          const data = await res.json().catch(() => null)
          if (!res.ok) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          return { ok: true, devices: data?.devices ?? [] }
        } catch (e) { captureError(e, { area: 'list-devices' }); return { ok: false, error: t.netErrors.connection } }
      },
      revokeDevice: async (id) => {
        const { authToken } = get()
        if (!authToken) return { ok: false, error: 'Não autenticado' }
        try {
          const res = await fetch('/api/me/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ action: 'revoke', id }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          return { ok: true }
        } catch (e) { captureError(e, { area: 'revoke-device' }); return { ok: false, error: t.netErrors.connection } }
      },
      revokeOtherDevices: async () => {
        const { authToken } = get()
        if (!authToken) return { ok: false, error: 'Não autenticado' }
        try {
          const res = await fetch('/api/me/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ action: 'revoke-others' }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          return { ok: true }
        } catch (e) { captureError(e, { area: 'revoke-other-devices' }); return { ok: false, error: t.netErrors.connection } }
      },
      restoreSession: async () => {
        const token = sessionStorage.getItem('pfp-auth-token')
        if (!token) return
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) {
            sessionStorage.removeItem('pfp-auth-token')
            return
          }
          const data = await res.json()
          set({
            authToken: token,
            currentUser: { id: data.user.id, username: data.user.username, name: data.user.name ?? '', email: data.user.email ?? '', role: data.user.role, firstLogin: !!data.user.first_login },
            userMode: data.user.role === 'coach' ? 'admin' : 'visitor',
            justSignedUp: false,
          })
          void flush(token)
          void get().syncTeamRanges()
        } catch (e) { captureError(e, { area: 'restore-session' }); sessionStorage.removeItem('pfp-auth-token') }
      },
      teamRangeIds: loadTeamRangeIds(),
      syncTeamRanges: async () => {
        const { authToken } = get()
        if (!authToken) return
        try {
          const res = await fetch('/api/ranges/list', { headers: { Authorization: `Bearer ${authToken}` } })
          if (!res.ok) return
          const data = await res.json().catch(() => null)
          if (!data || !Array.isArray(data.ranges) || data.ranges.length === 0) return
          const seen = Number(localStorage.getItem(TEAM_VERSION_KEY) ?? '0')
          if ((data.version ?? 0) <= seen) return
          const teamRanges = decodeRanges(data.ranges as Range[])
          const teamIds = new Set(teamRanges.map(r => r.id))
          const userRanges = get().ranges.filter(r => !teamIds.has(r.id))
          const merged = [...teamRanges, ...userRanges]
          saveRanges(merged)
          localStorage.setItem(TEAM_VERSION_KEY, String(data.version))
          const idList = [...teamIds]
          try { localStorage.setItem(TEAM_IDS_KEY, JSON.stringify(idList)) } catch { /* cota: badge fica sem persistir */ }
          set({ ranges: merged, teamRangeIds: idList })
        } catch (e) { captureError(e, { area: 'sync-team-ranges' }); /* fallback: segue com o seed local */ }
      },
      publishTeamRanges: async () => {
        const { authToken, ranges } = get()
        if (!authToken) return { ok: false, error: 'Não autenticado' }
        try {
          const sparse = encodeRanges(ranges)
          const res = await fetch('/api/admin/ranges/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ ranges: sparse }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? t.netErrors.server(res.status) }
          localStorage.setItem(TEAM_VERSION_KEY, String(data.version))
          addBreadcrumb('publish', 'team ranges ok', { version: data.version, count: data.count })
          return { ok: true, version: data.version, count: data.count }
        } catch (e) { captureError(e, { area: 'publish-team-ranges' }); return { ok: false, error: t.netErrors.connection } }
      },

      // ── Admin ───────────────────────────────────────────────────────────────────
      adminWorkerUrl: localStorage.getItem('admin-worker-url') ?? 'https://preflop-admin.loureirodlg.workers.dev',
      adminLastError: '',
      setAdminWorkerUrl: (url) => {
        localStorage.setItem('admin-worker-url', url)
        set({ adminWorkerUrl: url })
      },
      adminSaveRanges: async (password) => {
        const { ranges, adminWorkerUrl, adminToken } = get()
        if (!adminWorkerUrl) return 'error'
        const usingToken = !password && !!adminToken
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (usingToken) headers.Authorization = `Bearer ${adminToken!.token}`
        try {
          const sparse = encodeRanges(ranges)
          const res = await fetch(adminWorkerUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(usingToken ? { ranges: sparse } : { password, ranges: sparse }),
          })
          if (res.status === 401) {
            if (usingToken) { set({ adminToken: null }); return 'token_expired' }
            return 'wrong_password'
          }
          if (res.ok) return 'ok'
          try {
            const data = await res.json()
            set({ adminLastError: data.message ?? `HTTP ${res.status}` })
            if (data.code === 'invalid_token') return 'invalid_token'
            if (data.code === 'missing_token') return 'missing_token'
          } catch { set({ adminLastError: `HTTP ${res.status}` }) }
          return 'error'
        } catch (e) { captureError(e, { area: 'admin-save-ranges' }); set({ adminLastError: String(e) }); return 'error' }
      },
    }),
    {
      name: 'fbr-ui-state',
      partialize: (state) => ({ darkMode: state.darkMode, lang: state.lang }),
      onRehydrateStorage: () => (state) => { if (state) setLangDict(state.lang) },
    }
  )
)

storageErrorReporter = (blocked) => {
  if (useStore.getState().storageBlocked !== blocked) {
    if (blocked) captureMessage('localStorage cheio: gravação local bloqueada', 'warning')
    useStore.setState({ storageBlocked: blocked })
  }
}
