export interface FocusLeakInput {
  hand: string
  rangeName: string
  rangeId: number
  impact: number
  accuracy: number
  total: number
}

export interface FocusGapInput {
  hand: string
  rangeName: string
  rangeId: number
  score: number
  consults: number
  accuracy: number
  total: number
}

export interface FocusTrendInput {
  userId: number
  name: string
  classification: string
  slope: number
  firstAccuracy: number | null
  lastAccuracy: number | null
}

export interface WeeklyFocus {
  leaks: FocusLeakInput[]
  gaps: FocusGapInput[]
  regressions: FocusTrendInput[]
  isEmpty: boolean
}

export interface FocusOptions {
  topLeaks?: number
  topGaps?: number
  topRegressions?: number
  minImpact?: number
  minScore?: number
}

const keyOf = (rangeId: number, hand: string) => `${rangeId}|${hand}`

// Síntese acionável: leaks de maior impacto, lacunas de conhecimento e jogadores
// em regressão. Assume leaks/gaps já ordenados desc pelo seu score. Gaps que
// repetem exatamente um leak já listado são removidos (mesma range+mão) para
// não duplicar o mesmo alvo sob duas lentes.
export function buildWeeklyFocus(
  input: { leaks: FocusLeakInput[]; gaps: FocusGapInput[]; trends: FocusTrendInput[] },
  opts: FocusOptions = {},
): WeeklyFocus {
  const { topLeaks = 5, topGaps = 5, topRegressions = 5, minImpact = 1, minScore = 0.5 } = opts

  const leaks = input.leaks.filter(l => l.impact >= minImpact).slice(0, topLeaks)
  const shown = new Set(leaks.map(l => keyOf(l.rangeId, l.hand)))

  const gaps = input.gaps
    .filter(g => g.score >= minScore && !shown.has(keyOf(g.rangeId, g.hand)))
    .slice(0, topGaps)

  const regressions = input.trends
    .filter(t => t.classification === 'regressing')
    .sort((a, b) => a.slope - b.slope)
    .slice(0, topRegressions)

  return {
    leaks,
    gaps,
    regressions,
    isEmpty: leaks.length === 0 && gaps.length === 0 && regressions.length === 0,
  }
}
