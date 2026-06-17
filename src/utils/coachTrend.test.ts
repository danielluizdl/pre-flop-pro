import { describe, it, expect } from 'vitest'
import { linreg, classifyTrend, buildTrend, aggregateTeamBuckets } from './coachTrend'

describe('linreg', () => {
  it('reta perfeita ascendente: slope 2, r2 1', () => {
    const f = linreg([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }])
    expect(f.slope).toBeCloseTo(2, 10)
    expect(f.intercept).toBeCloseTo(0, 10)
    expect(f.r2).toBeCloseTo(1, 10)
  })

  it('reta descendente: slope negativo', () => {
    const f = linreg([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }])
    expect(f.slope).toBeCloseTo(-2, 10)
  })

  it('menos de 2 pontos => slope 0', () => {
    expect(linreg([]).slope).toBe(0)
    expect(linreg([{ x: 5, y: 7 }]).slope).toBe(0)
    expect(linreg([{ x: 5, y: 7 }]).intercept).toBe(7)
  })

  it('variância zero em x => slope 0', () => {
    const f = linreg([{ x: 3, y: 1 }, { x: 3, y: 9 }])
    expect(f.slope).toBe(0)
    expect(f.intercept).toBeCloseTo(5, 10)
  })

  it('peso desloca o ajuste para os pontos pesados', () => {
    const unweighted = linreg([{ x: 0, y: 0 }, { x: 1, y: 10 }])
    const weighted = linreg([{ x: 0, y: 0, w: 100 }, { x: 1, y: 10, w: 1 }])
    expect(weighted.intercept).toBeLessThan(unweighted.intercept + 0.01)
    expect(weighted.slope).toBeGreaterThan(0)
  })

  it('r2 baixo para dispersão alta', () => {
    const f = linreg([{ x: 0, y: 5 }, { x: 1, y: 0 }, { x: 2, y: 6 }, { x: 3, y: 1 }])
    expect(f.r2).toBeLessThan(0.5)
  })
})

describe('classifyTrend', () => {
  it('insuficiente com <2 pontos', () => {
    expect(classifyTrend(5, 1)).toBe('insufficient')
  })
  it('melhorando acima do limiar', () => {
    expect(classifyTrend(1.2, 4)).toBe('improving')
  })
  it('regredindo abaixo do limiar negativo', () => {
    expect(classifyTrend(-0.8, 4)).toBe('regressing')
  })
  it('estável dentro da zona morta', () => {
    expect(classifyTrend(0.3, 4)).toBe('stable')
    expect(classifyTrend(-0.4, 4)).toBe('stable')
  })
})

describe('buildTrend', () => {
  it('série vazia => insuficiente', () => {
    const t = buildTrend([])
    expect(t.classification).toBe('insufficient')
    expect(t.weeks).toEqual([])
    expect(t.firstAccuracy).toBeNull()
  })

  it('calcula precisão por semana e ordena', () => {
    const t = buildTrend([
      { week: 102, hands: 100, correct: 90 },
      { week: 100, hands: 100, correct: 50 },
      { week: 101, hands: 100, correct: 70 },
    ])
    expect(t.weeks.map(w => w.week)).toEqual([100, 101, 102])
    expect(t.weeks.map(w => w.accuracy)).toEqual([50, 70, 90])
    expect(t.firstAccuracy).toBe(50)
    expect(t.lastAccuracy).toBe(90)
    expect(t.slope).toBeGreaterThan(0)
    expect(t.classification).toBe('improving')
  })

  it('respeita lacunas de semana no x (slope por semana real)', () => {
    const noGap = buildTrend([
      { week: 0, hands: 100, correct: 50 },
      { week: 1, hands: 100, correct: 70 },
    ])
    const gap = buildTrend([
      { week: 0, hands: 100, correct: 50 },
      { week: 2, hands: 100, correct: 70 },
    ])
    expect(noGap.slope).toBeGreaterThan(gap.slope)
  })

  it('poucas mãos => insuficiente mesmo com 2 semanas', () => {
    const t = buildTrend([
      { week: 0, hands: 3, correct: 1 },
      { week: 1, hands: 4, correct: 4 },
    ])
    expect(t.classification).toBe('insufficient')
  })

  it('regressão é detectada', () => {
    const t = buildTrend([
      { week: 0, hands: 100, correct: 90 },
      { week: 1, hands: 100, correct: 80 },
      { week: 2, hands: 100, correct: 65 },
    ])
    expect(t.classification).toBe('regressing')
    expect(t.slope).toBeLessThan(0)
  })

  it('ignora semanas sem mãos', () => {
    const t = buildTrend([
      { week: 0, hands: 0, correct: 0 },
      { week: 1, hands: 100, correct: 80 },
    ])
    expect(t.weeks.length).toBe(1)
  })
})

describe('aggregateTeamBuckets', () => {
  it('soma por semana entre jogadores', () => {
    const agg = aggregateTeamBuckets([
      { week: 1, hands: 10, correct: 5 },
      { week: 1, hands: 20, correct: 20 },
      { week: 2, hands: 5, correct: 0 },
    ])
    expect(agg).toEqual([
      { week: 1, hands: 30, correct: 25 },
      { week: 2, hands: 5, correct: 0 },
    ])
  })
})
