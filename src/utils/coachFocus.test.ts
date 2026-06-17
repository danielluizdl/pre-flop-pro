import { describe, it, expect } from 'vitest'
import { buildWeeklyFocus } from './coachFocus'

const leak = (hand: string, rangeId: number, impact: number) => ({
  hand, rangeId, rangeName: `R${rangeId}`, impact, accuracy: 50, total: 100,
})
const gap = (hand: string, rangeId: number, score: number) => ({
  hand, rangeId, rangeName: `R${rangeId}`, score, consults: 10, accuracy: 40, total: 50,
})
const trend = (name: string, classification: string, slope: number) => ({
  userId: name.charCodeAt(0), name, classification, slope, firstAccuracy: 80, lastAccuracy: 60,
})

describe('buildWeeklyFocus', () => {
  it('vazio quando nada passa do limiar', () => {
    const f = buildWeeklyFocus({ leaks: [], gaps: [], trends: [] })
    expect(f.isEmpty).toBe(true)
  })

  it('limita ao topN de leaks e respeita minImpact', () => {
    const leaks = [leak('AA', 1, 10), leak('KK', 1, 5), leak('QQ', 1, 0.2)]
    const f = buildWeeklyFocus({ leaks, gaps: [], trends: [] }, { topLeaks: 2 })
    expect(f.leaks.map(l => l.hand)).toEqual(['AA', 'KK'])
    // QQ filtrado por minImpact mesmo se topLeaks permitisse
    const f2 = buildWeeklyFocus({ leaks, gaps: [], trends: [] }, { topLeaks: 5 })
    expect(f2.leaks.map(l => l.hand)).toEqual(['AA', 'KK'])
  })

  it('remove gap que duplica um leak já listado (mesma range+mão)', () => {
    const leaks = [leak('AA', 1, 10)]
    const gaps = [gap('AA', 1, 5), gap('AA', 2, 5), gap('KK', 1, 5)]
    const f = buildWeeklyFocus({ leaks, gaps, trends: [] })
    const keys = f.gaps.map(g => `${g.rangeId}|${g.hand}`)
    expect(keys).not.toContain('1|AA')
    expect(keys).toContain('2|AA')
    expect(keys).toContain('1|KK')
  })

  it('filtra gaps por minScore', () => {
    const gaps = [gap('AA', 1, 5), gap('KK', 1, 0.1)]
    const f = buildWeeklyFocus({ leaks: [], gaps, trends: [] }, { minScore: 0.5 })
    expect(f.gaps.map(g => g.hand)).toEqual(['AA'])
  })

  it('só regressões, ordenadas pela queda mais forte', () => {
    const trends = [
      trend('Ana', 'regressing', -1),
      trend('Bia', 'improving', 3),
      trend('Caio', 'regressing', -4),
      trend('Davi', 'stable', 0.1),
    ]
    const f = buildWeeklyFocus({ leaks: [], gaps: [], trends })
    expect(f.regressions.map(r => r.name)).toEqual(['Caio', 'Ana'])
  })

  it('isEmpty false quando há qualquer item', () => {
    const f = buildWeeklyFocus({ leaks: [leak('AA', 1, 10)], gaps: [], trends: [] })
    expect(f.isEmpty).toBe(false)
  })
})
