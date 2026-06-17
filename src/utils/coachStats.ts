export interface WilsonInterval {
  lower: number
  upper: number
  mid: number
}

export function wilsonInterval(correct: number, total: number, z = 1.96): WilsonInterval {
  if (!(total > 0)) return { lower: 0, upper: 0, mid: 0 }
  const c = Math.max(0, Math.min(correct, total))
  const p = c / total
  const z2 = z * z
  const denom = 1 + z2 / total
  const center = (p + z2 / (2 * total)) / denom
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom
  const lower = Math.max(0, center - margin)
  const upper = Math.min(1, center + margin)
  return { lower, upper, mid: p }
}

export function wilsonLowerBound(correct: number, total: number, z = 1.96): number {
  return wilsonInterval(correct, total, z).lower
}

export type Confidence = 'low' | 'medium' | 'high'

export function confidenceLevel(total: number): Confidence {
  if (total < 15) return 'low'
  if (total < 50) return 'medium'
  return 'high'
}

export const SEVERITY_WEIGHT = { grave: 1, impreciso: 0.4, untagged: 0.7 } as const

export interface LeakCounts {
  total: number
  correct: number
  graves: number
  imprecisos: number
}

export function weightedErrors({ total, correct, graves, imprecisos }: LeakCounts): number {
  const errors = Math.max(0, total - correct)
  const g = Math.max(0, Math.min(graves, errors))
  const i = Math.max(0, Math.min(imprecisos, errors - g))
  const untagged = Math.max(0, errors - g - i)
  return g * SEVERITY_WEIGHT.grave + i * SEVERITY_WEIGHT.impreciso + untagged * SEVERITY_WEIGHT.untagged
}

export function leakImpact(counts: LeakCounts): number {
  return weightedErrors(counts)
}

export interface RankedLeak {
  impact: number
  accuracyLower: number
  confidence: Confidence
}

export function rankLeaks<T extends LeakCounts>(rows: T[], z = 1.96): (T & RankedLeak)[] {
  return rows
    .map(r => ({
      ...r,
      impact: leakImpact(r),
      accuracyLower: Math.round(wilsonLowerBound(r.correct, r.total, z) * 1000) / 10,
      confidence: confidenceLevel(r.total),
    }))
    .sort((a, b) => b.impact - a.impact || a.accuracyLower - b.accuracyLower || b.total - a.total)
}
