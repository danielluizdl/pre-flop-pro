import type { HandData } from '../types'

export const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const
const SUITS = ['c', 'd', 'h', 's'] as const

export const ALL_HANDS: string[] = (() => {
  const hands: string[] = []
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      if (i === j) hands.push(RANKS[i] + RANKS[j])
      else if (i < j) hands.push(RANKS[i] + RANKS[j] + 's')
      else hands.push(RANKS[j] + RANKS[i] + 'o')
    }
  }
  return hands
})()

export function makeEmptyGrid(): Record<string, HandData> {
  const grid: Record<string, HandData> = {}
  ALL_HANDS.forEach(h => { grid[h] = { fold: 100, call: 0, raise: 0, allin: 0, size: 0 } })
  return grid
}

export function generateSuits(hand: string): [string, string] {
  const type = hand.length === 3 ? hand[2] : ''
  const s1 = SUITS[Math.floor(Math.random() * 4)]
  if (type === 's') return [s1, s1]
  let s2 = s1
  while (s2 === s1) s2 = SUITS[Math.floor(Math.random() * 4)]
  return [s1, s2]
}

export function getRngCorrectAction(data: HandData | undefined, rng: number, extraLabel?: string): string {
  if (!data) return 'Fold'
  const allin = data.allin ?? 0
  const raise = data.raise ?? 0
  const call  = data.call  ?? 0
  const extra = data.extra ?? 0
  // Faixas por agressividade: Allin > Raise > Call > extra > Fold
  if (rng <= allin) return 'Allin'
  if (rng <= allin + raise) return 'Raise'
  if (rng <= allin + raise + call) return 'Call'
  if (extraLabel && extra && rng <= allin + raise + call + extra) return extraLabel
  return 'Fold'
}

export interface RngBand {
  label: string
  lo: number
  hi: number
}

export function getRngBands(data: HandData | undefined, extraLabel?: string): RngBand[] {
  if (!data) return [{ label: 'Fold', lo: 1, hi: 100 }]
  const allin = data.allin ?? 0
  const raise = data.raise ?? 0
  const call  = data.call  ?? 0
  const extra = data.extra ?? 0
  const segments: { label: string; pct: number }[] = [
    { label: 'Allin', pct: allin },
    { label: 'Raise', pct: raise },
    { label: 'Call',  pct: call  },
    ...(extraLabel && extra ? [{ label: extraLabel, pct: extra }] : []),
  ]
  const bands: RngBand[] = []
  let cursor = 0
  segments.forEach(seg => {
    if (seg.pct <= 0) return
    const lo = cursor + 1
    const hi = cursor + seg.pct
    bands.push({ label: seg.label, lo, hi })
    cursor = hi
  })
  if (cursor < 100) bands.push({ label: 'Fold', lo: cursor + 1, hi: 100 })
  return bands
}

export function formatRngBands(bands: RngBand[]): string {
  return bands.map(b => (b.lo === b.hi ? `${b.lo}` : `${b.lo}–${b.hi}`) + ` ${b.label}`).join(' · ')
}

export function getHighestFrequencyAction(data: HandData, extraLabel?: string): string {
  const opts = [
    { action: 'Raise', pct: data.raise },
    { action: 'Call',  pct: data.call  },
    { action: 'Allin', pct: data.allin },
    { action: 'Fold',  pct: data.fold  },
    ...(extraLabel && data.extra ? [{ action: extraLabel, pct: data.extra }] : []),
  ]
  return opts.reduce((best, cur) => (cur.pct > best.pct ? cur : best)).action
}

export function getTopFrequencyActions(data: HandData | undefined, extraLabel?: string): string[] {
  if (!data) return ['Fold']
  const opts = [
    { action: 'Raise', pct: data.raise ?? 0 },
    { action: 'Call',  pct: data.call  ?? 0 },
    { action: 'Allin', pct: data.allin ?? 0 },
    { action: 'Fold',  pct: data.fold  ?? 100 },
    ...(extraLabel && data.extra ? [{ action: extraLabel, pct: data.extra ?? 0 }] : []),
  ]
  const max = Math.max(...opts.map(o => o.pct))
  if (!isFinite(max)) return ['Fold']
  return opts.filter(o => o.pct === max).map(o => o.action)
}

export function countNonFoldHands(grid: Record<string, HandData>): number {
  return Object.values(grid).filter(d => d.fold < 100).length
}

// ── Amostragem ponderada por desempenho ("Focar erros") ────────────────────

/** Peso de sorteio: mãos nunca treinadas = 3; treinadas = 1 + 4*(1 - acerto). */
export function focusWeight(perf: { c: number; t: number } | undefined): number {
  if (!perf || perf.t <= 0) return 3
  const accuracy = perf.c / perf.t
  return 1 + 4 * (1 - accuracy)
}

export function weightedPick<T>(items: T[], weights: number[], rnd: number = Math.random()): T {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return items[Math.floor(rnd * items.length)]
  let r = rnd * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}


// ── Hand group helpers ─────────────────────────────────────────────────────

/** Todos os 13 pares (AA, KK, ... 22) */
export function getAllPairs(): string[] {
  return RANKS.map(r => r + r)
}

/** Todas as 78 mãos suited (AKs … 32s) */
export function getAllSuited(): string[] {
  const h: string[] = []
  for (let i = 0; i < 13; i++)
    for (let j = i + 1; j < 13; j++)
      h.push(RANKS[i] + RANKS[j] + 's')
  return h
}

/** Todas as 78 mãos offsuit (AKo … 32o) */
export function getAllOffsuit(): string[] {
  const h: string[] = []
  for (let i = 0; i < 13; i++)
    for (let j = i + 1; j < 13; j++)
      h.push(RANKS[i] + RANKS[j] + 'o')
  return h
}

/** Connectors suited: diferença de índice = 1 (KQs, QJs, JTs … 32s) */
export function getConnectorsSuited(): string[] {
  const h: string[] = []
  for (let i = 0; i < 12; i++)
    h.push(RANKS[i] + RANKS[i + 1] + 's')
  return h
}

/** Connectors offsuit: diferença de índice = 1 (KQo, QJo … 32o) */
export function getConnectorsOffsuit(): string[] {
  const h: string[] = []
  for (let i = 0; i < 12; i++)
    h.push(RANKS[i] + RANKS[i + 1] + 'o')
  return h
}

/** One-gappers suited: diferença de índice = 2 (KJs, QTs … 42s) */
export function getOneGappersSuited(): string[] {
  const h: string[] = []
  for (let i = 0; i < 11; i++)
    h.push(RANKS[i] + RANKS[i + 2] + 's')
  return h
}

/** Broadways suited (duas cartas T+, suited): AKs, AQs … KQs, KJs, KTs, QJs, QTs, JTs */
export function getBroadwaysSuited(): string[] {
  const broadways = ['A','K','Q','J','T']
  const h: string[] = []
  for (let i = 0; i < broadways.length; i++)
    for (let j = i + 1; j < broadways.length; j++)
      h.push(broadways[i] + broadways[j] + 's')
  return h
}

/** Broadways offsuit */
export function getBroadwaysOffsuit(): string[] {
  const broadways = ['A','K','Q','J','T']
  const h: string[] = []
  for (let i = 0; i < broadways.length; i++)
    for (let j = i + 1; j < broadways.length; j++)
      h.push(broadways[i] + broadways[j] + 'o')
  return h
}

// ── Stack range overlap detection ──────────────────────────────────────────

function parseStackRange(str: string): [number, number] | null {
  if (!str) return null
  const s = str.replace(/bb/gi, '').trim()
  const leIncl = s.match(/^<=\s*(\d+(?:\.\d+)?)$/)
  if (leIncl) return [0, Number(leIncl[1])]
  const leStrict = s.match(/^<\s*(\d+(?:\.\d+)?)$/)
  if (leStrict) return [0, Number(leStrict[1]) - 0.01]
  const geIncl = s.match(/^>=\s*(\d+(?:\.\d+)?)$/)
  if (geIncl) return [Number(geIncl[1]), Infinity]
  const geStrict = s.match(/^>\s*(\d+(?:\.\d+)?)$/)
  if (geStrict) return [Number(geStrict[1]) + 0.01, Infinity]
  const rng = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
  if (rng) return [Number(rng[1]), Number(rng[2])]
  const exact = s.match(/^(\d+(?:\.\d+)?)$/)
  if (exact) { const n = Number(exact[1]); return [n, n] }
  return null
}

export function stackMatchesRange(stack: number, rangeStr: string): boolean {
  if (!rangeStr) return true
  const s = rangeStr.replace(/bb/gi, '').trim()
  const leIncl = s.match(/^<=\s*(\d+(?:\.\d+)?)$/)
  if (leIncl) return stack <= Number(leIncl[1])
  const leStrict = s.match(/^<\s*(\d+(?:\.\d+)?)$/)
  if (leStrict) return stack < Number(leStrict[1])
  const geIncl = s.match(/^>=\s*(\d+(?:\.\d+)?)$/)
  if (geIncl) return stack >= Number(geIncl[1])
  const geStrict = s.match(/^>\s*(\d+(?:\.\d+)?)$/)
  if (geStrict) return stack > Number(geStrict[1])
  const rng = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
  if (rng) return stack >= Number(rng[1]) && stack <= Number(rng[2])
  const exact = s.match(/^(\d+(?:\.\d+)?)$/)
  if (exact) return stack === Number(exact[1])
  return true
}

export function stackRangesOverlap(a: string, b: string): boolean {
  const ra = parseStackRange(a)
  const rb = parseStackRange(b)
  if (!ra || !rb) return false
  return ra[0] <= rb[1] && rb[0] <= ra[1]
}
