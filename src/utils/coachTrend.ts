export interface Point {
  x: number
  y: number
  w?: number
}

export interface Linreg {
  slope: number
  intercept: number
  r2: number
  n: number
}

// Regressão linear simples por mínimos quadrados, com peso opcional (default 1).
export function linreg(points: Point[]): Linreg {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: n === 1 ? points[0].y : 0, r2: 0, n }
  let W = 0, sx = 0, sy = 0
  for (const p of points) {
    const w = p.w ?? 1
    W += w; sx += w * p.x; sy += w * p.y
  }
  if (W <= 0) return { slope: 0, intercept: 0, r2: 0, n }
  const mx = sx / W, my = sy / W
  let sxx = 0, sxy = 0, syy = 0
  for (const p of points) {
    const w = p.w ?? 1
    const dx = p.x - mx, dy = p.y - my
    sxx += w * dx * dx; sxy += w * dx * dy; syy += w * dy * dy
  }
  if (sxx <= 0) return { slope: 0, intercept: my, r2: 0, n }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0
  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)), n }
}

export type TrendDir = 'improving' | 'regressing' | 'stable' | 'insufficient'

// slope em pontos percentuais por semana. flat = zona morta (default 0.5pp/sem).
export function classifyTrend(slope: number, n: number, flat = 0.5): TrendDir {
  if (n < 2) return 'insufficient'
  if (slope >= flat) return 'improving'
  if (slope <= -flat) return 'regressing'
  return 'stable'
}

export interface WeekBucket {
  week: number
  hands: number
  correct: number
}

export interface WeekPoint {
  week: number
  accuracy: number
  hands: number
}

export interface PlayerTrend {
  weeks: WeekPoint[]
  slope: number
  r2: number
  classification: TrendDir
  totalHands: number
  firstAccuracy: number | null
  lastAccuracy: number | null
}

const ACC = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0)

// Constrói a série semanal e a inclinação. x = índice relativo da semana (respeita
// lacunas via week absoluto); y = precisão %; peso = nº de mãos da semana.
export function buildTrend(buckets: WeekBucket[], minHandsForTrend = 20): PlayerTrend {
  const sorted = [...buckets].filter(b => b.hands > 0).sort((a, b) => a.week - b.week)
  const weeks: WeekPoint[] = sorted.map(b => ({ week: b.week, accuracy: ACC(b.correct, b.hands), hands: b.hands }))
  const totalHands = sorted.reduce((a, b) => a + b.hands, 0)
  if (weeks.length === 0) {
    return { weeks, slope: 0, r2: 0, classification: 'insufficient', totalHands: 0, firstAccuracy: null, lastAccuracy: null }
  }
  const base = sorted[0].week
  const points: Point[] = sorted.map(b => ({ x: b.week - base, y: ACC(b.correct, b.hands), w: b.hands }))
  const fit = linreg(points)
  const enough = weeks.length >= 2 && totalHands >= minHandsForTrend
  return {
    weeks,
    slope: Math.round(fit.slope * 10) / 10,
    r2: Math.round(fit.r2 * 100) / 100,
    classification: enough ? classifyTrend(fit.slope, weeks.length) : 'insufficient',
    totalHands,
    firstAccuracy: weeks[0].accuracy,
    lastAccuracy: weeks[weeks.length - 1].accuracy,
  }
}

export function aggregateTeamBuckets(rows: { week: number; hands: number; correct: number }[]): WeekBucket[] {
  const map = new Map<number, WeekBucket>()
  for (const r of rows) {
    const cur = map.get(r.week)
    if (cur) { cur.hands += r.hands; cur.correct += r.correct }
    else map.set(r.week, { week: r.week, hands: r.hands, correct: r.correct })
  }
  return [...map.values()].sort((a, b) => a.week - b.week)
}
