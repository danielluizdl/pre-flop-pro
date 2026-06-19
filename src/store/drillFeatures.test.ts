import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ALL_HANDS, makeEmptyGrid, focusWeight } from '../utils/hands'
import type { HandData, Range } from '../types'

function rangeWith(grid: Record<string, HandData>): Range {
  return { id: 1, name: 'R', positions: ['BTN'], grid, scenarios: [], tableSize: 6 }
}

describe('focusWeight (D1)', () => {
  it('mão nunca treinada tem peso 3', () => {
    expect(focusWeight(undefined)).toBe(3)
    expect(focusWeight({ c: 0, t: 0 })).toBe(3)
  })
  it('mão treinada: peso 1 + 4*(1 - acerto)', () => {
    expect(focusWeight({ c: 10, t: 10 })).toBe(1)
    expect(focusWeight({ c: 0, t: 10 })).toBe(5)
    expect(focusWeight({ c: 5, t: 10 })).toBe(3)
  })
})

describe('amostragem ponderada "Focar erros" (D1)', () => {
  const grid = (() => {
    const g = makeEmptyGrid()
    ALL_HANDS.forEach(h => { g[h] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 } })
    return g
  })()
  // Pool reduzido a duas mãos: AA (acurácia 0 → peso 5) e KK (acurácia 100 → peso 1)
  const excluded = ALL_HANDS.filter(h => h !== 'AA' && h !== 'KK')

  function run(focus: boolean): { AA: number; KK: number } {
    useStore.setState({
      ranges: [rangeWith(grid)],
      selectedDrillRangeIds: [1],
      drillExcludedHands: excluded,
      focusErrors: focus,
      handPerformance: { 1: { AA: { c: 0, t: 10 }, KK: { c: 10, t: 10 } } },
      useRngForFrequency: false,
      acceptAnyFreq: false,
    })
    const counts = { AA: 0, KK: 0 }
    for (let i = 0; i < 2000; i++) {
      useStore.getState().nextDrillHand()
      const h = useStore.getState().activeHand as 'AA' | 'KK'
      counts[h]++
    }
    return counts
  }

  it('ligado: mão de baixa acurácia sorteada bem mais que a de alta', () => {
    const c = run(true)
    // razão esperada 5:1; tolerância folgada
    expect(c.AA).toBeGreaterThan(c.KK * 2)
  })

  it('desligado: distribuição uniforme (nada muda no sorteio)', () => {
    const c = run(false)
    const ratio = c.AA / c.KK
    expect(ratio).toBeGreaterThan(0.7)
    expect(ratio).toBeLessThan(1.4)
  })
})

describe('severidade do erro (D2)', () => {
  beforeEach(() => {
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 25, raise: 75, allin: 0, size: 0 }
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 }
    useStore.setState({
      activeDrillRange: rangeWith(g),
      activeDrillStackGridIdx: -1,
      activeDrillStackRange: '',
      currentRng: 50,
      currentHandSuits: ['h', 's'],
      useRngForFrequency: false,
      acceptAnyFreq: false,
      handHistory: [],
      sessionHandPerf: {},
      handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 0 },
    })
  })

  it('acerto na ação principal não tem severidade', () => {
    useStore.setState({ activeHand: 'AA' })
    const r = useStore.getState().checkDrillAnswer('Raise')
    expect(r.correct).toBe(true)
    expect(r.severity).toBeUndefined()
  })

  it('ação com freq > 0 mas não principal é impreciso', () => {
    useStore.setState({ activeHand: 'AA' })
    const r = useStore.getState().checkDrillAnswer('Call')
    expect(r.correct).toBe(false)
    expect(r.severity).toBe('impreciso')
    expect(r.message).toContain('Impreciso')
    expect(r.message).toContain('25%')
  })

  it('ação com 0% é erro grave', () => {
    useStore.setState({ activeHand: 'KK' })
    const r = useStore.getState().checkDrillAnswer('Call')
    expect(r.correct).toBe(false)
    expect(r.severity).toBe('grave')
    expect(r.message).toContain('Blunder')
    expect(r.message).toContain('0%')
  })

  it('acumula contagem em sessionSeverity', () => {
    useStore.setState({ activeHand: 'KK' })
    useStore.getState().checkDrillAnswer('Call')
    useStore.setState({ activeHand: 'AA' })
    useStore.getState().checkDrillAnswer('Call')
    const sev = useStore.getState().sessionSeverity
    expect(sev.grave).toBe(1)
    expect(sev.impreciso).toBe(1)
  })
})
