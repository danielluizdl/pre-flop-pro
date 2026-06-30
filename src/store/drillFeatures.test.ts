import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ALL_HANDS, makeEmptyGrid, focusWeight } from '../utils/hands'
import type { HandData, Range, PositionConfig } from '../types'

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

describe('nextDrillHand — prereq', () => {
  it('com prereqRangeId, candidatos vêm do prereqGrid e drillExcludedHands é ignorado', () => {
    const prereqGrid = makeEmptyGrid()
    prereqGrid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    // Todas as outras mãos ficam fold=100 (não entram no pool)

    const mainGrid = makeEmptyGrid()
    // Mão principal pode ter fold > 0 — mas a ação correta vem do mainGrid
    mainGrid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }

    const prereqRange: Range = { id: 10, name: 'Prereq', positions: ['BTN'], grid: prereqGrid, scenarios: [], tableSize: 6 }
    const mainRange: Range = { id: 20, name: 'Main', positions: ['CO'], grid: mainGrid, scenarios: [], tableSize: 6, prereqRangeId: 10 }

    useStore.setState({
      ranges: [prereqRange, mainRange],
      selectedDrillRangeIds: [20],
      // 'AA' está excluída manualmente — mas com prereq deve ser ignorado
      drillExcludedHands: ['AA'],
      focusErrors: false,
      handPerformance: {},
      useRngForFrequency: false,
      acceptAnyFreq: false,
    })

    const result = useStore.getState().nextDrillHand()
    expect(result).toBe(true)
    // Só 'AA' é não-fold no prereqGrid, então deve ser selecionada
    expect(useStore.getState().activeHand).toBe('AA')
  })

  it('sem prereq encontrado, cai no filtro normal de drillExcludedHands', () => {
    const g = makeEmptyGrid()
    ALL_HANDS.forEach(h => { g[h] = { fold: 0, call: 0, raise: 100, allin: 0 } })

    // prereqRangeId aponta para range inexistente (id 99)
    const range: Range = { id: 30, name: 'NoPrereq', positions: ['BTN'], grid: g, scenarios: [], tableSize: 6, prereqRangeId: 99 }

    useStore.setState({
      ranges: [range],
      selectedDrillRangeIds: [30],
      // Exclui todas exceto 'KK'
      drillExcludedHands: ALL_HANDS.filter(h => h !== 'KK'),
      focusErrors: false,
      handPerformance: {},
      useRngForFrequency: false,
      acceptAnyFreq: false,
    })

    const result = useStore.getState().nextDrillHand()
    expect(result).toBe(true)
    expect(useStore.getState().activeHand).toBe('KK')
  })
})

describe('nextDrillHand — multi-stack', () => {
  it('resolve stackGridIdx a partir do heroStack do cenário', () => {
    const g1 = makeEmptyGrid()
    g1['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const g2 = makeEmptyGrid()
    g2['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }

    const scenario: Record<string, PositionConfig> = {
      BTN: { role: 'open', bet: 2.5, isHero: true, stack: 150 },
    }

    const range: Range = {
      id: 40, name: 'Multi', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [
        { id: 1, data: scenario, pot: '0', ante: 0, summary: 'BTN 150bb' },
      ],
      tableSize: 6,
      stackGrids: [
        { stackRange: '0-100', grid: g1 },  // stack 150 NÃO bate aqui
        { stackRange: '100-250', grid: g2 }, // stack 150 bate aqui
      ],
    }

    useStore.setState({
      ranges: [range],
      selectedDrillRangeIds: [40],
      drillExcludedHands: [],
      focusErrors: false,
      handPerformance: {},
      useRngForFrequency: false,
      acceptAnyFreq: false,
    })

    const result = useStore.getState().nextDrillHand()
    expect(result).toBe(true)
    // stackGridIdx deve ser 1 (100-250 bate no heroStack 150)
    expect(useStore.getState().activeDrillStackGridIdx).toBe(1)
    expect(useStore.getState().activeDrillStackRange).toBe('100-250')
  })
})

describe('checkDrillAnswer — RNG ligado', () => {
  it('com useRngForFrequency=true, usa o RNG para determinar a ação correta', () => {
    const g = makeEmptyGrid()
    // AA: raise 20%, call 80% — RNG=10 cai no raise
    g['AA'] = { fold: 0, call: 80, raise: 20, allin: 0 }

    useStore.setState({
      activeDrillRange: rangeWith(g),
      activeDrillStackGridIdx: -1,
      activeDrillStackRange: '',
      activeHand: 'AA',
      currentRng: 10, // cai no raise (1-20)
      currentHandSuits: ['h', 's'],
      useRngForFrequency: true,
      acceptAnyFreq: false,
      handHistory: [],
      sessionHandPerf: {},
      handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 0 },
    })

    const r = useStore.getState().checkDrillAnswer('Raise')
    expect(r.correct).toBe(true)
    expect(r.severity).toBeUndefined()
  })

  it('com RNG ligado, resposta errada é grave se freq=0', () => {
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }

    useStore.setState({
      activeDrillRange: rangeWith(g),
      activeDrillStackGridIdx: -1,
      activeDrillStackRange: '',
      activeHand: 'AA',
      currentRng: 50,
      currentHandSuits: ['h', 's'],
      useRngForFrequency: true,
      acceptAnyFreq: false,
      handHistory: [],
      sessionHandPerf: {},
      handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 0 },
    })

    const r = useStore.getState().checkDrillAnswer('Call')
    expect(r.correct).toBe(false)
    expect(r.severity).toBe('grave')
  })
})

describe('incrementConsults / logConsult', () => {
  it('incrementConsults incrementa sessionStats.consults', () => {
    useStore.setState({ sessionStats: { hands: 5, correct: 4, errors: 1, consults: 2 } })
    useStore.getState().incrementConsults()
    expect(useStore.getState().sessionStats.consults).toBe(3)
  })

  it('logConsult não lança mesmo sem authToken (fireEvent fail-open)', () => {
    useStore.setState({ authToken: null })
    expect(() => useStore.getState().logConsult(1, 'BTN RFI', 'AA')).not.toThrow()
  })
})
