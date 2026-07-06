import { describe, it, expect } from 'vitest'
import { scoreBuild } from './buildScore'
import { makeEmptyGrid, ALL_HANDS } from './hands'
import { TOTAL_COMBOS } from './rangeCombos'
import type { HandData } from '../types'

function gridWith(hands: Record<string, Partial<HandData>>): Record<string, HandData> {
  const g = makeEmptyGrid()
  for (const [h, d] of Object.entries(hands)) {
    const call = d.call ?? 0, raise = d.raise ?? 0, allin = d.allin ?? 0, extra = d.extra ?? 0
    g[h] = { call, raise, allin, extra, fold: d.fold ?? Math.max(0, 100 - call - raise - allin - extra) }
  }
  return g
}

describe('scoreBuild', () => {
  it('grade idêntica dá nota 100 e zero combos fora do lugar', () => {
    const real = gridWith({ AA: { raise: 100 }, AKs: { raise: 50, call: 50 }, '72o': {} })
    const { score, misplacedCombos, perHand } = scoreBuild(real, JSON.parse(JSON.stringify(real)))
    expect(score).toBe(100)
    expect(misplacedCombos).toBe(0)
    expect(Object.values(perHand).every(v => v === 0)).toBe(true)
  })

  it('duas grades vazias (tudo fold) dão nota 100', () => {
    const { score, misplacedCombos } = scoreBuild(makeEmptyGrid(), makeEmptyGrid())
    expect(score).toBe(100)
    expect(misplacedCombos).toBe(0)
  })

  it('uma mão par a 100% de raise faltando custa 6 combos', () => {
    const real = gridWith({ AA: { raise: 100 } })
    const { score, misplacedCombos, perHand } = scoreBuild(real, makeEmptyGrid())
    expect(misplacedCombos).toBe(6)
    expect(perHand['AA']).toBe(1)
    expect(score).toBeCloseTo(100 * (1 - 6 / TOTAL_COMBOS), 6)
  })

  it('uma mão offsuit a mais no range do jogador custa 12 combos', () => {
    const user = gridWith({ '72o': { call: 100 } })
    const { misplacedCombos, perHand } = scoreBuild(makeEmptyGrid(), user)
    expect(misplacedCombos).toBe(12)
    expect(perHand['72o']).toBe(1)
  })

  it('frequência parcial conta proporcional (raise 100 vs 50 em offsuit = 6 combos)', () => {
    const real = gridWith({ AKo: { raise: 100 } })
    const user = gridWith({ AKo: { raise: 50 } })
    const { misplacedCombos, perHand } = scoreBuild(real, user)
    expect(misplacedCombos).toBe(6)
    expect(perHand['AKo']).toBe(0.5)
  })

  it('mesma abertura com ação trocada é erro total da mão (call 100 vs raise 100)', () => {
    const real = gridWith({ AKs: { raise: 100 } })
    const user = gridWith({ AKs: { call: 100 } })
    const { misplacedCombos, perHand } = scoreBuild(real, user)
    expect(misplacedCombos).toBe(4)
    expect(perHand['AKs']).toBe(1)
  })

  it('multi-ação compara ação a ação incluindo fold e extra', () => {
    const real = gridWith({ AQs: { raise: 50, call: 30, allin: 10, extra: 10 } })
    const user = gridWith({ AQs: { raise: 30, call: 50, allin: 10 } })
    // |raise 20| + |call 20| + |extra 10| + |fold 10| = 60 → 0.5 * 0.6 * 4 combos = 1.2
    const { misplacedCombos, perHand } = scoreBuild(real, user)
    expect(misplacedCombos).toBeCloseTo(1.2, 6)
    expect(perHand['AQs']).toBeCloseTo(0.3, 6)
  })

  it('grades completamente opostas em todas as mãos dão nota 0 (clamp inferior)', () => {
    const real = makeEmptyGrid()
    const user = makeEmptyGrid()
    for (const h of ALL_HANDS) {
      real[h] = { fold: 0, call: 0, raise: 100, allin: 0, extra: 0 }
      user[h] = { fold: 100, call: 0, raise: 0, allin: 0, extra: 0 }
    }
    const { score, misplacedCombos } = scoreBuild(real, user)
    expect(misplacedCombos).toBe(TOTAL_COMBOS)
    expect(score).toBe(0)
  })

  it('nota nunca sai do intervalo [0,100] mesmo com dados fora da faixa', () => {
    const real = gridWith({ AA: { raise: 100 } })
    const user = makeEmptyGrid()
    user['AA'] = { fold: -50, call: 250, raise: 0, allin: 0, extra: 0 }
    const { score } = scoreBuild(real, user)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
