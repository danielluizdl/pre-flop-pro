import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ALL_HANDS, makeEmptyGrid } from '../utils/hands'
import type { HandData, Range, Scenario, PositionConfig } from '../types'

function playGrid(hands: string[]): Record<string, HandData> {
  const g = makeEmptyGrid()
  hands.forEach(h => { g[h] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 } })
  return g
}

function heroScenario(stack: number): Scenario {
  const data: Record<string, PositionConfig> = {
    btn: { role: 'open', bet: 2.5, isHero: true, stack },
    bb: { role: 'post', bet: 1, isHero: false, stack: 250 },
  }
  return { id: 1, data, pot: '3.5', ante: 0, summary: '' }
}

describe('nextDrillHand — ramos de candidatos', () => {
  beforeEach(() => {
    useStore.setState({
      useRngForFrequency: false,
      focusErrors: false,
      drillExcludedHands: [],
    })
  })

  it('ignora ids selecionados que não existem em ranges', () => {
    const r: Range = { id: 1, name: 'R', positions: ['BTN'], grid: playGrid(['AA', 'KK']), scenarios: [], tableSize: 6 }
    useStore.setState({ ranges: [r], selectedDrillRangeIds: [999, 1] })
    const ok = useStore.getState().nextDrillHand()
    expect(ok).not.toBe(false)
    expect(['AA', 'KK', ...ALL_HANDS]).toContain(useStore.getState().activeHand)
  })

  it('range multi-stack sem faixa que case o stack do herói: cenário é descartado', () => {
    const r: Range = {
      id: 2, name: 'MS', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [heroScenario(250)], tableSize: 6,
      stackGrids: [{ stackRange: '<= 100', grid: playGrid(['AA']) }],
    }
    useStore.setState({ ranges: [r], selectedDrillRangeIds: [2] })
    // herói com 250bb não cabe em "<= 100" → não há candidato → retorna false
    expect(useStore.getState().nextDrillHand()).toBe(false)
  })

  it('range multi-stack com faixa que casa: usa o grid da faixa correta', () => {
    const r: Range = {
      id: 3, name: 'MS', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [heroScenario(60)], tableSize: 6,
      stackGrids: [
        { stackRange: '<= 100', grid: playGrid(['AA', 'KK']) },
        { stackRange: '> 100', grid: playGrid(['22']) },
      ],
    }
    useStore.setState({ ranges: [r], selectedDrillRangeIds: [3] })
    const ok = useStore.getState().nextDrillHand()
    expect(ok).not.toBe(false)
    expect(useStore.getState().activeDrillStackGridIdx).toBe(0)
  })

  it('prereq multi-stack: candidatos vêm da faixa correta do prereq', () => {
    const prereq: Range = {
      id: 10, name: 'Prereq', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 6,
      stackGrids: [
        { stackRange: '<= 100', grid: playGrid(['AA']) },
        { stackRange: '> 100', grid: playGrid(['22', '33', '44']) },
      ],
    }
    const main: Range = {
      id: 11, name: 'Main', positions: ['BTN'], grid: playGrid(ALL_HANDS.slice()), scenarios: [heroScenario(60)], tableSize: 6,
      prereqRangeId: 10,
    }
    useStore.setState({ ranges: [prereq, main], selectedDrillRangeIds: [11], drillExcludedHands: ALL_HANDS.filter(h => h !== 'AA') })
    const ok = useStore.getState().nextDrillHand()
    expect(ok).not.toBe(false)
    // única mão não-fold da faixa <=100 do prereq é AA (drillExcludedHands é ignorado com prereq)
    expect(useStore.getState().activeHand).toBe('AA')
  })
})

describe('checkDrillAnswer — freqOf quando a mão não está no grid', () => {
  it('mão fora do grid: Fold é 100% (acerto) e outra ação é erro grave', () => {
    const grid = makeEmptyGrid()
    delete grid['72o']
    const r: Range = { id: 20, name: 'R', positions: ['BTN'], grid, scenarios: [], tableSize: 6 }
    useStore.setState({
      ranges: [r],
      activeDrillRange: r,
      activeDrillStackGridIdx: -1,
      activeHand: '72o',
      correctActionForCurrentHand: 'Fold',
      correctActionsForCurrentHand: ['Fold'],
      useRngForFrequency: false,
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 0 },
      handHistory: [],
      sessionHandPerf: {},
      currentHandSuits: ['s', 'h'],
      currentRng: 50,
    })
    const okRes = useStore.getState().checkDrillAnswer('Fold')
    expect(okRes.correct).toBe(true)
    const errRes = useStore.getState().checkDrillAnswer('Raise')
    expect(errRes.correct).toBe(false)
    expect(errRes.severity).toBe('grave')
  })
})
