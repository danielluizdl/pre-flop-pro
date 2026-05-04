import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ALL_HANDS, makeEmptyGrid, generateSuits, getRngCorrectAction, getHighestFrequencyAction,
} from '../utils/hands'
import type {
  BrushState, HandData, HandHistoryEntry, PokerPosition, PositionConfig,
  Range, Scenario, SessionStats, Slot, TableSize, TrainingSession, Page,
} from '../types'
import {
  POS_6MAX, POS_8MAX, SLOTS_6MAX, SLOTS_8MAX,
} from '../types'
import { DEFAULT_RANGES } from '../data/defaultRanges'

const RANGES_KEY    = 'fbr-ranges-v1'
const HISTORY_KEY   = 'fbr-training-history-v1'
const HAND_PERF_KEY = 'pfp-hand-perf-v1'

type HandPerfMap = Record<number, Record<string, { c: number; t: number }>>

function loadRanges(): Range[] {
  try {
    const saved: Range[] = JSON.parse(localStorage.getItem(RANGES_KEY) ?? '[]') ?? []
    const existingIds = new Set(saved.map(r => r.id))
    const missing = DEFAULT_RANGES.filter(r => !existingIds.has(r.id))
    if (missing.length > 0) {
      const merged = [...missing, ...saved]
      localStorage.setItem(RANGES_KEY, JSON.stringify(merged))
      return merged
    }
    return saved
  } catch { return [...DEFAULT_RANGES] }
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
  rangeData: { id: number | null; name: string; grid: Record<string, HandData>; positions: string[]; tableSize: TableSize }
  selectedEditorPositions: string[]
  brush: BrushState

  setBrush: (field: keyof BrushState, value: number | string) => void
  applyBrush: (hand: string) => void
  applyBrushToHands: (hands: string[]) => void
  clearHands: (hands: string[]) => void
  clearHand: (hand: string) => void
  resetGrid: () => void
  setRangeName: (name: string) => void
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
  removeScenario: (idx: number) => void
  finalizeRange: () => void

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
            ? { rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: size } }
            : {}),
        })
      },

      // ── Range editor ──────────────────────────────────────────────────────────
      rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 6 },
      selectedEditorPositions: [],
      brush: { call: 0, raise: 0, allin: 0, raiseSize: '' },

      setBrush: (field, value) => {
        const { brush } = get()
        if (field === 'raiseSize') {
          set({ brush: { ...brush, raiseSize: value as string } })
          return
        }
        let v = Math.max(0, Math.min(100, Number(value)))
        // Clicking 100% zeroes the other two actions
        if (v === 100) {
          set({ brush: { ...brush, call: field === 'call' ? 100 : 0, raise: field === 'raise' ? 100 : 0, allin: field === 'allin' ? 100 : 0 } })
          return
        }
        let c = field === 'call' ? v : brush.call
        let r = field === 'raise' ? v : brush.raise
        let a = field === 'allin' ? v : brush.allin
        const total = c + r + a
        if (total > 100) {
          const excess = total - 100
          const others = ([
            { t: 'call' as const, v: c },
            { t: 'raise' as const, v: r },
            { t: 'allin' as const, v: a },
          ] as { t: 'call' | 'raise' | 'allin'; v: number }[])
            .filter(o => o.t !== field)
            .sort((x, y) => y.v - x.v)
          if (others.length > 0) {
            const reduce = (key: 'call' | 'raise' | 'allin', amt: number) => {
              if (key === 'call') c = Math.max(0, c - amt)
              else if (key === 'raise') r = Math.max(0, r - amt)
              else a = Math.max(0, a - amt)
            }
            reduce(others[0].t, excess)
            const remaining = c + r + a - 100
            if (remaining > 0 && others.length > 1) reduce(others[1].t, remaining)
          }
        }
        set({ brush: { ...brush, call: c, raise: r, allin: a } })
      },

      applyBrush: (hand) => {
        const { brush, rangeData } = get()
        const total = brush.call + brush.raise + brush.allin
        if (total > 100) return
        const fold = 100 - total
        const newGrid = {
          ...rangeData.grid,
          [hand]: { call: brush.call, raise: brush.raise, allin: brush.allin, fold, size: brush.raiseSize },
        }
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      applyBrushToHands: (hands) => {
        const { brush, rangeData } = get()
        const total = brush.call + brush.raise + brush.allin
        if (total > 100) return
        const fold = 100 - total
        const newGrid = { ...rangeData.grid }
        hands.forEach(hand => {
          newGrid[hand] = { call: brush.call, raise: brush.raise, allin: brush.allin, fold, size: brush.raiseSize }
        })
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      clearHand: (hand) => {
        const { rangeData } = get()
        const newGrid = { ...rangeData.grid, [hand]: { fold: 100, call: 0, raise: 0, allin: 0, size: '' } }
        set({ rangeData: { ...rangeData, grid: newGrid } })
      },

      clearHands: (hands) => {
        const { rangeData } = get()
        const newGrid = { ...rangeData.grid }
        hands.forEach(hand => { newGrid[hand] = { fold: 100, call: 0, raise: 0, allin: 0, size: '' } })
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

      toggleEditorPosition: (label) => {
        const { selectedEditorPositions } = get()
        const next = selectedEditorPositions.includes(label) ? [] : [label]
        set({ selectedEditorPositions: next })
      },

      loadRangeForEdit: (id) => {
        const { ranges } = get()
        const r = ranges.find(x => x.id === id)
        if (!r) return
        const tSize: TableSize = r.tableSize || 6
        const positions = tSize === 6 ? POS_6MAX : POS_8MAX
        const slots = tSize === 6 ? SLOTS_6MAX : SLOTS_8MAX
        const ante = r.scenarios?.[0]?.ante ?? 0
        set({
          rangeData: { id: r.id, name: r.name, positions: r.positions, grid: JSON.parse(JSON.stringify(r.grid)), tableSize: tSize },
          tempScenarios: r.scenarios ? JSON.parse(JSON.stringify(r.scenarios)) : [],
          selectedEditorPositions: [...r.positions],
          currentTableSize: tSize,
          activePositions: positions,
          activeSlots: slots,
          currentAnte: ante,
          page: 'editor',
        })
      },

      // ── Table editor ──────────────────────────────────────────────────────────
      currentScenario: {},
      tempScenarios: [],
      currentHeroRaiseSize: 0,
      currentHasStraddle: false,

      setupNewRange: (size, hasStraddle, ante) => {
        const positions = size === 6 ? POS_6MAX : POS_8MAX
        const slots = size === 6 ? SLOTS_6MAX : SLOTS_8MAX
        const scenario: Record<string, PositionConfig> = {}
        positions.forEach(pos => {
          let role: PositionConfig['role'] = 'fold'
          let bet = 0
          if (pos.id === 'sb') { role = 'post'; bet = 0.5 }
          else if (pos.id === 'bb') { role = 'post'; bet = 1.0 }
          else if (pos.id === 'str' && hasStraddle) { role = 'post'; bet = 2.0 }
          scenario[pos.id] = { role, bet, isHero: false, stack: 100 }
        })
        set({
          currentTableSize: size,
          activePositions: positions,
          activeSlots: slots,
          currentAnte: ante,
          currentHasStraddle: hasStraddle,
          currentScenario: scenario,
          currentHeroRaiseSize: 0,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: size },
          tempScenarios: [],
          selectedEditorPositions: [],
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
          scenario[pos.id] = { role, bet, isHero: false, stack: 100 }
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
          bet = 0
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

      removeScenario: (idx) => {
        const { tempScenarios } = get()
        set({ tempScenarios: tempScenarios.filter((_, i) => i !== idx) })
      },

      finalizeRange: () => {
        const { rangeData, tempScenarios, ranges, currentTableSize, selectedEditorPositions } = get()
        const isEditing = rangeData.id !== null
        const newId = isEditing ? rangeData.id! : Date.now()
        const finalObj: Range = {
          id: newId,
          name: rangeData.name,
          positions: selectedEditorPositions,
          grid: JSON.parse(JSON.stringify(rangeData.grid)),
          scenarios: JSON.parse(JSON.stringify(tempScenarios)),
          tableSize: currentTableSize,
        }
        let newRanges: Range[]
        if (isEditing) {
          const idx = ranges.findIndex(r => r.id === newId)
          newRanges = idx !== -1 ? ranges.map(r => r.id === newId ? finalObj : r) : [...ranges, finalObj]
        } else {
          newRanges = [...ranges, finalObj]
        }
        saveRanges(newRanges)
        set({
          ranges: newRanges,
          rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: currentTableSize },
          tempScenarios: [],
          selectedEditorPositions: [],
          page: 'ranges',
        })
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
        const candidates: { range: Range; hand: string }[] = []
        selectedDrillRangeIds.forEach(id => {
          const r = ranges.find(x => x.id === id)
          if (r) {
            Object.keys(r.grid)
              .filter(h => !drillExcludedHands.includes(h))
              .forEach(hand => candidates.push({ range: r, hand }))
          }
        })
        if (candidates.length === 0) return false

        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        const { range, hand } = pick
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
        const handData = range.grid[hand]
        const { useRngForFrequency } = get()
        const correctAction = useRngForFrequency
          ? getRngCorrectAction(handData, rng)
          : getHighestFrequencyAction(handData)
        const suits = generateSuits(hand)

        set({
          activeDrillRange: range,
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
          activeDrillRange, activeHand, sessionStats,
          currentRng, correctActionForCurrentHand, currentHandSuits, handHistory,
        } = get()
        if (!activeDrillRange) return { correct: false, message: '' }

        const correct = action === correctActionForCurrentHand
        const stats = { ...sessionStats, hands: sessionStats.hands + 1 }
        if (correct) stats.correct++; else stats.errors++

        const d = activeDrillRange.grid[activeHand]
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
          activeHand: '',
          page: 'drill',
          trainingHistory: newHistory,
        })
      },

      incrementConsults: () => {
        const { sessionStats } = get()
        set({ sessionStats: { ...sessionStats, consults: sessionStats.consults + 1 } })
      },
    }),
    {
      name: 'fbr-ui-state',
      partialize: (state) => ({ darkMode: state.darkMode }),
    }
  )
)
