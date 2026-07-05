import { ALL_HANDS } from './hands'
import { combosOf, TOTAL_COMBOS } from './rangeCombos'
import type { HandData } from '../types'

export interface BuildScoreResult {
  score: number
  misplacedCombos: number
  perHand: Record<string, number>
}

type Freqs = { call: number; raise: number; allin: number; extra: number; fold: number }

const clampFreq = (v: number) => Math.max(0, Math.min(100, v))

function freqsOf(d: HandData | undefined): Freqs {
  const call = clampFreq(d?.call ?? 0)
  const raise = clampFreq(d?.raise ?? 0)
  const allin = clampFreq(d?.allin ?? 0)
  const extra = clampFreq(d?.extra ?? 0)
  const fold = Math.max(0, 100 - call - raise - allin - extra)
  return { call, raise, allin, extra, fold }
}

const ACTIONS: (keyof Freqs)[] = ['fold', 'call', 'raise', 'allin', 'extra']

export function scoreBuild(
  realGrid: Record<string, HandData>,
  userGrid: Record<string, HandData>,
): BuildScoreResult {
  let misplacedCombos = 0
  const perHand: Record<string, number> = {}
  for (const hand of ALL_HANDS) {
    const real = freqsOf(realGrid[hand])
    const user = freqsOf(userGrid[hand])
    const combos = combosOf(hand)
    let diff = 0
    for (const a of ACTIONS) diff += Math.abs(real[a] - user[a])
    const handMisplaced = 0.5 * (diff / 100) * combos
    misplacedCombos += handMisplaced
    perHand[hand] = combos > 0 ? handMisplaced / combos : 0
  }
  const score = Math.max(0, Math.min(100, 100 * (1 - misplacedCombos / TOTAL_COMBOS)))
  return { score, misplacedCombos, perHand }
}
