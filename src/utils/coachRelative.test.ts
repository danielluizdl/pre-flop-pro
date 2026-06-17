import { describe, it, expect } from 'vitest'
import { mean, sampleStd, zScore, buildRelativeLeaks } from './coachRelative'

describe('mean / sampleStd / zScore', () => {
  it('mean', () => {
    expect(mean([])).toBe(0)
    expect(mean([2, 4, 6])).toBe(4)
  })
  it('sampleStd usa n-1 e 0 com <2 pontos', () => {
    expect(sampleStd([5])).toBe(0)
    expect(sampleStd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2)
  })
  it('zScore 0 quando sd 0', () => {
    expect(zScore(5, 5, 0)).toBe(0)
    expect(zScore(8, 4, 2)).toBe(2)
  })
})

const stat = (userId: number, rangeId: number, total: number, correct: number) => ({
  userId, name: `P${userId}`, rangeId, rangeName: `R${rangeId}`, total, correct,
})

describe('buildRelativeLeaks', () => {
  it('exige peers mínimos por range', () => {
    const rows = [stat(1, 1, 100, 50), stat(2, 1, 100, 90)]
    expect(buildRelativeLeaks(rows, { minPeers: 3 })).toEqual([])
  })

  it('ignora jogadores com amostra abaixo de minHands', () => {
    const rows = [
      stat(1, 1, 5, 1),   // 20% mas n<15, descartado
      stat(2, 1, 100, 90),
      stat(3, 1, 100, 90),
      stat(4, 1, 100, 90),
    ]
    const leaks = buildRelativeLeaks(rows, { minHands: 15, minPeers: 3 })
    // só 3 qualificam, todos iguais => ninguém abaixo da média
    expect(leaks).toEqual([])
  })

  it('retorna só quem está abaixo da média do time, ordenado por z', () => {
    const rows = [
      stat(1, 1, 100, 90), // 90%
      stat(2, 1, 100, 88), // 88%
      stat(3, 1, 100, 92), // 92%
      stat(4, 1, 100, 60), // 60% — bem abaixo
    ]
    const leaks = buildRelativeLeaks(rows, { minHands: 15, minPeers: 3 })
    expect(leaks.length).toBeGreaterThanOrEqual(1)
    expect(leaks[0].userId).toBe(4)
    expect(leaks[0].deviation).toBeLessThan(0)
    expect(leaks[0].z).toBeLessThan(0)
    expect(leaks.every(l => l.deviation < 0)).toBe(true)
  })

  it('calcula média do time e desvio corretamente', () => {
    const rows = [
      stat(1, 1, 100, 80),
      stat(2, 1, 100, 90),
      stat(3, 1, 100, 100),
    ]
    const leaks = buildRelativeLeaks(rows, { minHands: 15, minPeers: 3 })
    // média = 90; jogador 1 a 80 => deviation -10
    const p1 = leaks.find(l => l.userId === 1)!
    expect(p1.teamMean).toBe(90)
    expect(p1.playerAcc).toBe(80)
    expect(p1.deviation).toBe(-10)
  })

  it('separa por range', () => {
    const rows = [
      stat(1, 1, 100, 50), stat(2, 1, 100, 90), stat(3, 1, 100, 90),
      stat(1, 2, 100, 95), stat(2, 2, 100, 60), stat(3, 2, 100, 90),
    ]
    const leaks = buildRelativeLeaks(rows, { minHands: 15, minPeers: 3 })
    const r1Leak = leaks.find(l => l.rangeId === 1)!
    const r2Leak = leaks.find(l => l.rangeId === 2)!
    expect(r1Leak.userId).toBe(1)
    expect(r2Leak.userId).toBe(2)
  })
})
