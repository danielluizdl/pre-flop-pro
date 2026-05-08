import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ALL_HANDS, makeEmptyGrid, generateSuits, getRngCorrectAction, getHighestFrequencyAction,
} from '../utils/hands'
import type {
  BrushState, HandData, HandHistoryEntry, PokerPosition, PositionConfig,
  Range, Scenario, SessionGrid, SessionStats, Slot, StackGrid, TableSize, TrainingSession, Page,
} from '../types'
import {
  POS_6MAX, POS_8MAX, SLOTS_6MAX, SLOTS_8MAX,
} from '../types'
import { DEFAULT_RANGES } from '../data/defaultRanges'
import adminRangesRaw from '../data/adminRanges.json'

const RANGES_KEY       = 'fbr-ranges-v1'
const HISTORY_KEY      = 'fbr-training-history-v1'
const HAND_PERF_KEY    = 'pfp-hand-perf-v1'
const ADMIN_WORKER_KEY = 'admin-worker-url'
const ADMIN_VERSION_KEY = 'admin-ranges-version'

type HandPerfMap = Record<number, Record<string, { c: number; t: number }>>

const adminPayload  = adminRangesRaw as unknown as { version: number; ranges: Range[] }
const ADMIN_VERSION = adminPayload.version ?? 0
const ADMIN_RANGES  = adminPayload.ranges ?? []

const SEEDED_DEFAULTS: Range[] = (() => {
  if (ADMIN_RANGES.length === 0) return DEFAULT_RANGES
  const adminIds = new Set(ADMIN_RANGES.map(r => r.id))
  return [...ADMIN_RANGES, ...DEFAULT_RANGES.filter(r => !adminIds.has(r.id))]
})()

function loadRanges(): Range[] {
  try {
    const saved: Range[] = JSON.parse(localStorage.getItem(RANGES_KEY) ?? '[]') ?? []
    const seenVersion = Number(localStorage.getItem(ADMIN_VERSION_KEY) ?? '0')

    if (ADMIN_VERSION > seenVersion) {
      // Nova versão publicada: sobrescreve ranges do admin, preserva ranges do usuário
      const adminIds = new Set(SEEDED_DEFAULTS.map(r => r.id))
      const userRanges = saved.filter(r => !adminIds.has(r.id))
      const merged = [...SEEDED_DEFAULTS, ...userRanges]
      localStorage.setItem(RANGES_KEY, JSON.stringify(merged))
      localStorage.setItem(ADMIN_VERSION_KEY, String(ADMIN_VERSION))
      return merged
    }

    // Versão já vista: injeta apenas ranges ausentes sem sobrescrever edições locais
    const existingIds = new Set(saved.map(r => r.id))
    const missing = SEEDED_DEFAULTS.filter(r => !existingIds.has(r.id))
    if (missing.length > 0) {
      const merged = [...missing, ...saved]
      localStorage.setItem(RANGES_KEY, JSON.stringify(merged))
      return merged
    }
    return saved
  } catch { return [...SEEDED_DEFAULTS] }
}

function saveRanges(ranges: Range[]) {
  localStorage.setItem(RANGES_KEY, JSON.stringify(ranges))
}

function loadHistory(): TrainingSession[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') ?? [] }
  catch { return [] }
}

function saveHistory(sessions: TrainingSession[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions))
}

function loadHandPerf(): HandPerfMap {
  try { return JSON.parse(localStorage.getItem(HAND_PERF_KEY) ?? '{}') ?? {} }
  catch { return {} }
}

function saveHandPerf(perf: HandPerfMap) {
  localStorage.setItem(HAND_PERF_KEY, JSON.stringify(perf))
}

interface AppState {
  // ── Navigation ──────────────────────────────────────────────────────────────
  page: Page
  darkMode: boolean
  setPage: (p: Page) => void
  toggleDarkMode: () => void

  // ── Persistent data ─────────────────────────────────────────────────────────
  ranges: Range[]
  trainingHistory: TrainingSession[]

  // ── Table config (shared for editor + drill display) ────────────────────────
  currentTableSize: TableSize
  activePositions: PokerPosition[]
  activeSlots: Slot[]
  currentAnte: number
  setTableFormat: (size: TableSize) => void

  // ── Range editor ─────────────────────────────────────────────────────────────
  rangeData: { id: number | null; name: string; grid: Record<string, HandData>; positions: string[]; tableSize: TableSize; stackRange: string }
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
  finalizeRange: () => void
  sessionGrids: SessionGrid[]
  pushGridToSession: () => void
  updateSessionGrid: (idx: number, sg: SessionGrid) => void

  // ── Hand performance (heatmap) ────────────────────────────────────────────────
  handPerformance: HandPerfMap
  clearHandPerformance: (rangeId: number) => void

  // ── Saved ranges management ──────────────────────────────────────────────────
  deleteRange: (id: number) => void
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
  currentHandSuits: [string, string]
  sessionStartTime: number

  useRngForFrequency: boolean
  setUseRng: (val: boolean) => void

  toggleDrillRange: (id: number) => void
  clearDrillRanges: () => void
  setDrillExcluded: (hands: string[]) => void
  toggleDrillHand: (hand: string) => void
  setAllDrillHands: (included: boolean) => void
  startDrillSession: () => void
  nextDrillHand: () => boolean
  checkDrillAnswer: (action: string) => { correct: boolean; message: string }
  stopDrill: () => void
  incrementConsults: () => void

  // ── Auth ──────────────────────────────────────────────────────────────────────
  userMode: 'visitor' | 'admin' | null
  login: (password: string) => Promise<'ok' | 'wrong_password' | 'error'>
  enterAsVisitor: () => void
  logout: () => void

  // ── Admin ─────────────────────────────────────────────────────────────────────
  adminWorkerUrl: string
  setAdminWorkerUrl: (url: string) => void
  adminSaveRanges: (password: string) => Promise<'ok' | 'wrong_password' | 'error'>
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Navigation ────────────────────────────────────────────────────────────
      page: 'dashboard',
      darkMode: false,
      setPage: (page) => set({ page }),
      toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),

      // ── Persistent data ───────────────────────────────────────────────────────
      ranges: loadRanges(),
      trainingHistory: loadHistory(),

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
          const firstGrid = r.stackGrids[0]
          const sessionGridsFromRange: SessionGrid[] = r.stackGrids.slice(1).map(sg => ({
            name: r.name,
            stackRange: sg.stackRange,
            grid: JSON.parse(JSON.stringify(sg.grid)),
            positions: [...r.positions],
          }))
          set({
            rangeData: { id: r.id, name: r.name, positions: r.positions, grid: JSON.parse(JSON.stringify(firstGrid.grid)), tableSize: tSize, stackRange: firstGrid.stackRange },
            tempScenarios: r.scenarios ? JSON.parse(JSON.stringify(r.scenarios)) : [],
            selectedEditorPositions: [...r.positions],
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
            rangeData: { id: r.id, name: r.name, positions: r.positions, grid: JSON.parse(JSON.stringify(r.grid)), tableSize: tSize, stackRange: r.stackRange ?? '' },
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
        } else if (role === 'limp') {
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

      finalizeRange: () => {
        const { rangeData, tempScenarios, ranges, currentTableSize, selectedEditorPositions, brush, sessionGrids } = get()
        const isEditing = rangeData.id !== null
        const baseId = Date.now()
        const scenarios: Scenario[] = JSON.parse(JSON.stringify(tempScenarios))
        const customAction = brush.extraLabel ? { label: brush.extraLabel, color: brush.extraColor } : undefined

        // Group all grids (session + current) by position
        type GridEntry = { name: string; stackRange: string; grid: Record<string, HandData>; positions: string[] }
        const allEntries: GridEntry[] = [
          ...sessionGrids,
          { name: rangeData.name, stackRange: rangeData.stackRange, grid: JSON.parse(JSON.stringify(rangeData.grid)), positions: [...selectedEditorPositions] },
        ]
        const groups = new Map<string, GridEntry[]>()
        allEntries.forEach(g => {
          const key = [...g.positions].sort().join(',')
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(g)
        })

        const primaryKey = [...selectedEditorPositions].sort().join(',')
        let idSeed = baseId
        const groupedRanges: Range[] = []
        groups.forEach((grids, posKey) => {
          idSeed++
          const thisId = isEditing && posKey === primaryKey ? rangeData.id! : idSeed
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
            })
          } else {
            const stackGridsList: StackGrid[] = grids.map(g => ({
              stackRange: g.stackRange,
              grid: JSON.parse(JSON.stringify(g.grid)),
            }))
            groupedRanges.push({
              id: thisId,
              name: grids[0].name,
              positions: grids[0].positions,
              grid: JSON.parse(JSON.stringify(grids[0].grid)),
              stackGrids: stackGridsList,
              scenarios,
              tableSize: currentTableSize,
              ...(customAction ? { customAction } : {}),
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

      // ── Hand performance (heatmap) ────────────────────────────────────────────
      handPerformance: loadHandPerf(),

      clearHandPerformance: (rangeId) => {
        const { handPerformance } = get()
        const next = { ...handPerformance }
        delete next[rangeId]
        saveHandPerf(next)
        set({ handPerformance: next })
      },

      // ── Saved ranges management ────────────────────────────────────────────────
      deleteRange: (id) => {
        const { ranges } = get()
        const newRanges = ranges.filter(r => r.id !== id)
        saveRanges(newRanges)
        set({ ranges: newRanges })
      },
      rangesFilter: 'ALL',
      setRangesFilter: (f) => set({ rangesFilter: f }),

      // ── Drill ─────────────────────────────────────────────────────────────────
      useRngForFrequency: true,
      setUseRng: (val) => set({ useRngForFrequency: val }),

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
      currentHandSuits: ['h', 's'],
      sessionStartTime: 0,

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
        set({
          sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
          handHistory: [],
          sessionStartTime: Date.now(),
        })
      },

      nextDrillHand: () => {
        const { ranges, selectedDrillRangeIds, drillExcludedHands } = get()
        const candidates: { range: Range; hand: string; stackGridIdx: number }[] = []
        selectedDrillRangeIds.forEach(id => {
          const r = ranges.find(x => x.id === id)
          if (!r) return
          if (r.stackGrids && r.stackGrids.length > 0) {
            r.stackGrids.forEach((sg, sgIdx) => {
              Object.keys(sg.grid)
                .filter(h => !drillExcludedHands.includes(h))
                .forEach(hand => candidates.push({ range: r, hand, stackGridIdx: sgIdx }))
            })
          } else {
            Object.keys(r.grid)
              .filter(h => !drillExcludedHands.includes(h))
              .forEach(hand => candidates.push({ range: r, hand, stackGridIdx: -1 }))
          }
        })
        if (candidates.length === 0) return false

        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        const { range, hand, stackGridIdx } = pick
        const activeGrid = stackGridIdx >= 0 && range.stackGrids ? range.stackGrids[stackGridIdx].grid : range.grid
        const stackRangeLabel = stackGridIdx >= 0 && range.stackGrids ? range.stackGrids[stackGridIdx].stackRange : ''

        const rSize: TableSize = range.tableSize || 6
        const activePos = rSize === 6 ? POS_6MAX : POS_8MAX
        const activeSlts = rSize === 6 ? SLOTS_6MAX : SLOTS_8MAX

        let newScenario: Record<string, PositionConfig> = {}
        let newAnte = 0
        let heroRaiseFromScen = 0
        if (range.scenarios?.length > 0) {
          const rndScen = range.scenarios[Math.floor(Math.random() * range.scenarios.length)]
          newScenario = rndScen.data
          newAnte = rndScen.ante || 0
          heroRaiseFromScen = rndScen.heroRaiseSize ?? 0
        }

        const rng = Math.ceil(Math.random() * 100)
        const handData = activeGrid[hand]
        const { useRngForFrequency } = get()
        const extraLabel = range.customAction?.label
        const correctAction = useRngForFrequency
          ? getRngCorrectAction(handData, rng, extraLabel)
          : getHighestFrequencyAction(handData, extraLabel)
        const suits = generateSuits(hand)

        set({
          activeDrillRange: range,
          activeDrillStackRange: stackRangeLabel,
          activeDrillStackGridIdx: stackGridIdx,
          activeHand: hand,
          currentScenario: newScenario,
          currentAnte: newAnte,
          activePositions: activePos,
          activeSlots: activeSlts,
          currentTableSize: rSize,
          currentRng: rng,
          correctActionForCurrentHand: correctAction,
          currentHandSuits: suits,
          currentHeroRaiseSize: heroRaiseFromScen,
        })
        return true
      },

      checkDrillAnswer: (action) => {
        const {
          activeDrillRange, activeDrillStackGridIdx, activeHand, sessionStats,
          currentRng, correctActionForCurrentHand, currentHandSuits, handHistory,
        } = get()
        if (!activeDrillRange) return { correct: false, message: '' }

        const correct = action === correctActionForCurrentHand
        const stats = { ...sessionStats, hands: sessionStats.hands + 1 }
        if (correct) stats.correct++; else stats.errors++

        const activeGrid = activeDrillStackGridIdx >= 0 && activeDrillRange.stackGrids
          ? activeDrillRange.stackGrids[activeDrillStackGridIdx].grid
          : activeDrillRange.grid
        const d = activeGrid[activeHand]
        const entry: HandHistoryEntry = {
          id: Date.now(),
          hand: activeHand,
          suits: currentHandSuits,
          actionTaken: action,
          correctAction: correctActionForCurrentHand,
          rng: currentRng,
          correct,
          rangeName: activeDrillRange.name,
          raiseSize: d?.size,
        }
        const { handPerformance } = get()
        const rid = activeDrillRange.id
        const prev = handPerformance[rid]?.[activeHand] ?? { c: 0, t: 0 }
        const newPerf: HandPerfMap = {
          ...handPerformance,
          [rid]: { ...handPerformance[rid], [activeHand]: { c: prev.c + (correct ? 1 : 0), t: prev.t + 1 } },
        }
        saveHandPerf(newPerf)
        set({ sessionStats: stats, handHistory: [...handHistory, entry].slice(-50), handPerformance: newPerf })

        const { useRngForFrequency } = get()
        const rngTag = useRngForFrequency ? ` (RNG: ${currentRng})` : ''
        return {
          correct,
          message: correct
            ? `✓ ${action}!${rngTag}`
            : `✗ Correto: ${correctActionForCurrentHand}${rngTag}`,
        }
      },

      stopDrill: () => {
        const { sessionStats, selectedDrillRangeIds, ranges, currentTableSize, sessionStartTime, trainingHistory } = get()
        let newHistory = trainingHistory
        if (sessionStats.hands > 0) {
          const session: TrainingSession = {
            id: Date.now(),
            timestamp: Date.now(),
            rangeNames: ranges.filter(r => selectedDrillRangeIds.includes(r.id)).map(r => r.name),
            tableSize: currentTableSize,
            hands: sessionStats.hands,
            correct: sessionStats.correct,
            errors: sessionStats.errors,
            consults: sessionStats.consults,
            durationSeconds: Math.round((Date.now() - sessionStartTime) / 1000),
          }
          newHistory = [...trainingHistory, session]
          saveHistory(newHistory)
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

      incrementConsults: () => {
        const { sessionStats } = get()
        set({ sessionStats: { ...sessionStats, consults: sessionStats.consults + 1 } })
      },

      // ── Auth ────────────────────────────────────────────────────────────────────
      userMode: null,
      login: async (password) => {
        const { adminWorkerUrl } = get()
        if (!adminWorkerUrl) return 'error'
        try {
          const res = await fetch(adminWorkerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, action: 'validate' }),
          })
          if (res.status === 401) return 'wrong_password'
          if (res.ok) { set({ userMode: 'admin' }); return 'ok' }
          return 'error'
        } catch { return 'error' }
      },
      enterAsVisitor: () => set({ userMode: 'visitor' }),
      logout: () => set({ userMode: null }),

      // ── Admin ───────────────────────────────────────────────────────────────────
      adminWorkerUrl: localStorage.getItem('admin-worker-url') ?? 'https://preflop-admin.loureirodlg.workers.dev',
      setAdminWorkerUrl: (url) => {
        localStorage.setItem('admin-worker-url', url)
        set({ adminWorkerUrl: url })
      },
      adminSaveRanges: async (password) => {
        const { ranges, adminWorkerUrl } = get()
        if (!adminWorkerUrl) return 'error'
        try {
          const res = await fetch(adminWorkerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, ranges }),
          })
          if (res.status === 401) return 'wrong_password'
          if (res.ok) return 'ok'
          return 'error'
        } catch { return 'error' }
      },
    }),
    {
      name: 'fbr-ui-state',
      partialize: (state) => ({ darkMode: state.darkMode }),
    }
  )
)
