export type HandClass = 'pair' | 'suited' | 'offsuit'

export interface ComboActionFreq { call?: number; raise?: number; allin?: number; extra?: number; fold?: number }

export function classOf(hand: string): HandClass {
  if (hand.length === 2) return 'pair'
  return hand.endsWith('s') ? 'suited' : 'offsuit'
}

export function combosOf(hand: string): number {
  const c = classOf(hand)
  return c === 'pair' ? 6 : c === 'suited' ? 4 : 12
}

export const TOTAL_COMBOS = 1326
export const CLASS_TOTAL: Record<HandClass, number> = { pair: 78, suited: 312, offsuit: 936 }

export interface ClassStat { combos: number; coveragePct: number }
export interface ComboStats {
  openCombos: number
  openPct: number
  byClass: Record<HandClass, ClassStat>
  byAction: { raise: number; call: number; allin: number; extra: number; fold: number }
  accountedCombos: number
}

const clampFreq = (v: number) => Math.max(0, Math.min(100, v))

export function rangeComboStats(grid: Record<string, ComboActionFreq>): ComboStats {
  const byClassCombos: Record<HandClass, number> = { pair: 0, suited: 0, offsuit: 0 }
  const byAction = { raise: 0, call: 0, allin: 0, extra: 0, fold: 0 }
  let openCombos = 0
  let accountedCombos = 0

  for (const hand of Object.keys(grid)) {
    const d = grid[hand] ?? {}
    const combos = combosOf(hand)
    const raise = clampFreq(d.raise ?? 0)
    const call = clampFreq(d.call ?? 0)
    const allin = clampFreq(d.allin ?? 0)
    const extra = clampFreq(d.extra ?? 0)
    const fold = clampFreq(d.fold ?? 0)
    const nonFold = Math.min(100, raise + call + allin + extra) / 100
    const played = combos * nonFold
    openCombos += played
    byClassCombos[classOf(hand)] += played
    byAction.raise += combos * (raise / 100)
    byAction.call += combos * (call / 100)
    byAction.allin += combos * (allin / 100)
    byAction.extra += combos * (extra / 100)
    byAction.fold += combos * (fold / 100)
    accountedCombos += combos * ((raise + call + allin + extra + fold) / 100)
  }

  const byClass = (Object.keys(byClassCombos) as HandClass[]).reduce((acc, k) => {
    acc[k] = { combos: byClassCombos[k], coveragePct: CLASS_TOTAL[k] > 0 ? (byClassCombos[k] / CLASS_TOTAL[k]) * 100 : 0 }
    return acc
  }, {} as Record<HandClass, ClassStat>)

  return {
    openCombos,
    openPct: (openCombos / TOTAL_COMBOS) * 100,
    byClass,
    byAction,
    accountedCombos,
  }
}
