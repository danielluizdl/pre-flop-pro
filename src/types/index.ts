export const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const
export type Rank = typeof RANKS[number]

export const SUITS = ['c', 'd', 'h', 's'] as const
export const SUIT_ICONS: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' }

export type ActionType = 'fold' | 'call' | 'raise' | 'allin'
export type RoleType = 'fold' | 'post' | 'limp' | 'limp-fold' | 'open' | '3bet' | 'iso' | 'call' | 'allin'
export type TableSize = 6 | 8
export type Page = 'dashboard' | 'editor' | 'table-editor' | 'ranges' | 'drill' | 'exercise' | 'history' | 'range-setup' | 'category-detail' | 'admin'

export interface CurrentUser {
  id: number
  username: string
  name: string
  email: string
  role: 'player' | 'coach'
  firstLogin: boolean
}

export interface DeviceSession {
  id: number
  createdAt: number
  expiresAt: number
  current: boolean
}

export const SEAT_ROLE_LABELS: Record<RoleType, string> = {
  fold:        'Fold',
  post:        'Blind/Post',
  limp:        'Limp',
  'limp-fold': 'Limp Fold',
  open:        'Open Raise',
  '3bet':      '3-Bet',
  iso:         'ISO',
  call:        'Call',
  allin:       'All-In',
}

export interface HandData {
  fold: number
  call: number
  raise: number
  allin: number
  extra?: number
  size?: number | string
}

export interface PositionConfig {
  role: RoleType
  bet: number
  isHero: boolean
  stack: number
}

export interface Scenario {
  id: number
  data: Record<string, PositionConfig>
  pot: string
  ante: number
  summary: string
  heroRaiseSize?: number
}

export interface Range {
  id: number
  name: string
  positions: string[]
  grid: Record<string, HandData>
  scenarios: Scenario[]
  tableSize: TableSize
  customAction?: { label: string; color: string }
  stackRange?: string
  stackGrids?: StackGrid[]
  prereqRangeId?: number
}

export interface PokerPosition {
  id: string
  label: string
}

export interface Slot {
  t: number
  l: number
}

export interface SessionStats {
  hands: number
  correct: number
  errors: number
  consults: number
}

export interface BrushState {
  call: number
  raise: number
  allin: number
  extra: number
  raiseSize: string
  extraLabel: string
  extraColor: string
}

export interface HandHistoryEntry {
  id: number
  hand: string
  suits: [string, string]
  actionTaken: string
  correctAction: string
  rng: number
  correct: boolean
  rangeName: string
  rangeId: number
  stackGridIdx: number
  raiseSize?: number | string
  stackRange?: string
  severity?: 'grave' | 'impreciso'
}

export interface StackGrid {
  stackRange: string
  grid: Record<string, HandData>
  name?: string
}

export interface SessionGrid {
  name: string
  stackRange: string
  grid: Record<string, HandData>
  positions: string[]
}

export interface TrainingSession {
  id: number
  timestamp: number
  rangeNames: string[]
  tableSize: number
  hands: number
  correct: number
  errors: number
  consults: number
  durationSeconds: number
  handPerf?: Record<string, Record<string, { c: number; t: number }>>
}

export interface BuildRound {
  rangeId: number
  rangeName: string
  stackRange: string
  label: string
  grid: Record<string, HandData>
  customAction?: { label: string; color: string }
}

export interface BuildRoundResult {
  label: string
  score: number
}

export interface BuildSession {
  id: number
  timestamp: number
  rangeNames: string[]
  rounds: BuildRoundResult[]
  avgScore: number
}

// ── Table position definitions ───────────────────────────────────────────────

export const POS_6MAX: PokerPosition[] = [
  { id: 'sb',  label: 'SB'  },
  { id: 'bb',  label: 'BB'  },
  { id: 'utg', label: 'UTG' },
  { id: 'mp',  label: 'MP'  },
  { id: 'co',  label: 'CO'  },
  { id: 'btn', label: 'BTN' },
]

export const POS_8MAX: PokerPosition[] = [
  { id: 'sb',   label: 'SB'  },
  { id: 'bb',   label: 'BB'  },
  { id: 'str',  label: 'STR' },
  { id: 'utg',  label: 'UTG' },
  { id: 'utg1', label: 'MP'  },
  { id: 'mp',   label: 'HJ'  },
  { id: 'co',   label: 'CO'  },
  { id: 'btn',  label: 'BTN' },
]

// Slot positions (t = top%, l = left%) relative to table container
export const SLOTS_6MAX: Slot[] = [
  { t: 100, l: 50 },
  { t: 75,  l: 5  },
  { t: 25,  l: 5  },
  { t: 5,   l: 50 },
  { t: 25,  l: 95 },
  { t: 75,  l: 95 },
]

export const SLOTS_8MAX: Slot[] = [
  { t: 100, l: 50 },
  { t: 95,  l: 15 },
  { t: 50,  l: 0  },
  { t: 5,   l: 15 },
  { t: 0,   l: 50 },
  { t: 5,   l: 85 },
  { t: 50,  l: 100 },
  { t: 95,  l: 85 },
]
