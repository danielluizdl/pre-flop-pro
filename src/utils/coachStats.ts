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

// Taxa de erro ponderada por gravidade (0..~1). 0 quando não há mãos treinadas.
export function weightedErrorRate(counts: LeakCounts): number {
  if (!(counts.total > 0)) return 0
  return weightedErrors(counts) / counts.total
}

export interface GapCounts extends LeakCounts {
  consults: number
}

// Lacuna de conhecimento = quanto a mão é consultada × quanto ainda erram (ponderado).
// Alta = consultam muito E continuam errando — alvo prioritário de estudo.
export function knowledgeGapScore(counts: GapCounts): number {
  return counts.consults * weightedErrorRate(counts)
}

export interface RankedGap {
  score: number
  accuracy: number
  accuracyLower: number
  confidence: Confidence
}

export function rankKnowledgeGaps<T extends GapCounts>(rows: T[], z = 1.96): (T & RankedGap)[] {
  return rows
    .filter(r => r.consults > 0)
    .map(r => ({
      ...r,
      score: Math.round(knowledgeGapScore(r) * 10) / 10,
      accuracy: r.total > 0 ? Math.round((r.correct / r.total) * 1000) / 10 : 0,
      accuracyLower: Math.round(wilsonLowerBound(r.correct, r.total, z) * 1000) / 10,
      confidence: confidenceLevel(r.total),
    }))
    .sort((a, b) => b.score - a.score || b.consults - a.consults || a.accuracyLower - b.accuracyLower)
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
