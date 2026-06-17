export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

// Desvio padrão amostral (n-1). 0 com menos de 2 pontos.
export function sampleStd(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1)
  return Math.sqrt(variance)
}

export function zScore(value: number, m: number, sd: number): number {
  if (!(sd > 0)) return 0
  return (value - m) / sd
}

export interface PlayerRangeStat {
  userId: number
  name: string
  rangeId: number
  rangeName: string
  total: number
  correct: number
}

export interface RelativeLeak {
  userId: number
  name: string
  rangeId: number
  rangeName: string
  total: number
  playerAcc: number
  teamMean: number
  deviation: number
  z: number
  peers: number
}

export interface RelativeOptions {
  minHands?: number
  minPeers?: number
}

const ACC = (correct: number, total: number) => (total > 0 ? (correct / total) * 100 : 0)
const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

// Para cada range, compara cada jogador (com amostra suficiente) aos colegas no
// mesmo range: desvio em pontos percentuais e z-score. Retorna só quem está
// ABAIXO da média do time (deviation<0), ordenado pelo mais abaixo (z asc).
export function buildRelativeLeaks(rows: PlayerRangeStat[], opts: RelativeOptions = {}): RelativeLeak[] {
  const { minHands = 15, minPeers = 3 } = opts
  const byRange = new Map<number, PlayerRangeStat[]>()
  for (const r of rows) {
    if (!byRange.has(r.rangeId)) byRange.set(r.rangeId, [])
    byRange.get(r.rangeId)!.push(r)
  }
  const out: RelativeLeak[] = []
  for (const group of byRange.values()) {
    const qualifying = group.filter(r => r.total >= minHands)
    if (qualifying.length < minPeers) continue
    const accs = qualifying.map(r => ACC(r.correct, r.total))
    const m = mean(accs)
    const sd = sampleStd(accs)
    for (const r of qualifying) {
      const acc = ACC(r.correct, r.total)
      if (acc >= m) continue
      out.push({
        userId: r.userId,
        name: r.name,
        rangeId: r.rangeId,
        rangeName: r.rangeName,
        total: r.total,
        playerAcc: r1(acc),
        teamMean: r1(m),
        deviation: r1(acc - m),
        z: r2(zScore(acc, m, sd)),
        peers: qualifying.length,
      })
    }
  }
  return out.sort((a, b) => a.z - b.z || a.deviation - b.deviation)
}
