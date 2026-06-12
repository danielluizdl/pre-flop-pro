import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { ALL_HANDS, makeEmptyGrid, getRngCorrectAction, getTopFrequencyActions } from '../utils/hands'
import type { HandData, Range, Scenario, PositionConfig } from '../types'

function uniformGrid(d: Partial<HandData>): Record<string, HandData> {
  const grid = makeEmptyGrid()
  ALL_HANDS.forEach(h => { grid[h] = { fold: 0, call: 0, raise: 0, allin: 0, ...d } })
  return grid
}

function heroScenario(stack: number): Scenario {
  const data: Record<string, PositionConfig> = {
    btn: { role: 'open', bet: 2.5, isHero: true, stack },
    bb:  { role: 'post', bet: 1, isHero: false, stack },
  }
  return { id: 1, data, pot: '0', ante: 0, summary: '' }
}

function range(over: Partial<Range>): Range {
  return {
    id: 1, name: 'R', positions: ['BTN'], grid: makeEmptyGrid(),
    scenarios: [heroScenario(100)], tableSize: 6, ...over,
  }
}

function resetDrill(ranges: Range[], ids: number[], extra: Partial<ReturnType<typeof useStore.getState>> = {}) {
  useStore.setState({
    ranges,
    selectedDrillRangeIds: ids,
    drillExcludedHands: [],
    useRngForFrequency: false,
    acceptAnyFreq: false,
    sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
    handHistory: [],
    sessionHandPerf: {},
    ...extra,
  })
}

describe('drill — consistência sorteio ↔ check (RNG ligado)', () => {
  beforeEach(() => {
    const r = range({ id: 1, grid: uniformGrid({ raise: 50, fold: 50 }) })
    resetDrill([r], [1], { useRngForFrequency: true })
  })

  it('correctAction sorteado bate com o grid vigente e com o check', () => {
    for (let i = 0; i < 40; i++) {
      expect(useStore.getState().nextDrillHand()).toBe(true)
      const s = useStore.getState()
      const grid = s.activeDrillRange!.grid
      const expected = getRngCorrectAction(grid[s.activeHand], s.currentRng)
      expect(s.correctActionForCurrentHand).toBe(expected)

      const res = useStore.getState().checkDrillAnswer(expected)
      expect(res.correct).toBe(true)
    }
  })

  it('resposta errada é marcada como incorreta', () => {
    useStore.getState().nextDrillHand()
    const expected = useStore.getState().correctActionForCurrentHand
    const wrong = expected === 'Raise' ? 'Fold' : 'Raise'
    expect(useStore.getState().checkDrillAnswer(wrong).correct).toBe(false)
  })
})

describe('drill — modo frequência (RNG desligado)', () => {
  it('ação principal acerta; secundária erra por padrão', () => {
    const r = range({ id: 1, grid: uniformGrid({ raise: 75, call: 25 }) })
    resetDrill([r], [1])
    useStore.getState().nextDrillHand()
    expect(useStore.getState().correctActionsForCurrentHand).toEqual(['Raise'])
    expect(useStore.getState().checkDrillAnswer('Call').correct).toBe(false)
  })

  it('acceptAnyFreq aceita ação com frequência > 0 como acerto', () => {
    const r = range({ id: 1, grid: uniformGrid({ raise: 75, call: 25 }) })
    resetDrill([r], [1], { acceptAnyFreq: true })
    useStore.getState().nextDrillHand()
    const res = useStore.getState().checkDrillAnswer('Call')
    expect(res.correct).toBe(true)
    expect(res.message).toContain('Válido')
    expect(res.message).toContain('Raise 75%')
  })

  it('acceptAnyFreq não aceita ação com frequência zero', () => {
    const r = range({ id: 1, grid: uniformGrid({ raise: 75, call: 25 }) })
    resetDrill([r], [1], { acceptAnyFreq: true })
    useStore.getState().nextDrillHand()
    expect(useStore.getState().checkDrillAnswer('Allin').correct).toBe(false)
  })
})

describe('drill — prereqRangeId', () => {
  it('filtra candidatos pelo prereqGrid, mas resposta vem do activeGrid; excluded ignorado', () => {
    const prereqGrid = makeEmptyGrid()
    prereqGrid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    prereqGrid['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const pr = range({ id: 1, name: 'PR', grid: prereqGrid })

    const mainGrid = makeEmptyGrid()
    mainGrid['AA'] = { fold: 0, call: 100, raise: 0, allin: 0 }
    mainGrid['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    mainGrid['QQ'] = { fold: 0, call: 0, raise: 0, allin: 100 }
    const m = range({ id: 2, name: 'M', grid: mainGrid, prereqRangeId: 1 })

    // AA excluído de propósito: deve ser ignorado por causa do prereq.
    resetDrill([pr, m], [2], { drillExcludedHands: ['AA'] })

    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      useStore.getState().nextDrillHand()
      const s = useStore.getState()
      seen.add(s.activeHand)
      expect(['AA', 'KK']).toContain(s.activeHand)
      const expected = getTopFrequencyActions(s.activeDrillRange!.grid[s.activeHand]).join(' ou ')
      expect(s.correctActionForCurrentHand).toBe(expected)
    }
    // QQ é não-fold no main mas fold no prereq → nunca sorteado
    expect(seen.has('QQ')).toBe(false)
    // AA aparece apesar de excluído (prereq ignora o filtro manual)
    expect(seen.has('AA')).toBe(true)
    // resposta correta vem do activeGrid (AA=Call, KK=Raise)
    expect(getTopFrequencyActions(m.grid['AA'])).toEqual(['Call'])
    expect(getTopFrequencyActions(m.grid['KK'])).toEqual(['Raise'])
  })
})

describe('drill — stackGrids resolvidos pelo hero stack do cenário', () => {
  it('escolhe o stackGrid certo conforme o stack do hero e calcula a resposta dele', () => {
    const gridLow = makeEmptyGrid()
    gridLow['AA'] = { fold: 0, call: 0, raise: 0, allin: 100 }
    const gridHigh = makeEmptyGrid()
    gridHigh['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }

    const r = range({
      id: 1,
      stackGrids: [
        { stackRange: '<=40', grid: gridLow },
        { stackRange: '>40', grid: gridHigh },
      ],
      scenarios: [
        { id: 1, data: { btn: { role: 'allin', bet: 30, isHero: true, stack: 30 }, bb: { role: 'post', bet: 1, isHero: false, stack: 30 } }, pot: '0', ante: 0, summary: '' },
        { id: 2, data: { btn: { role: 'open', bet: 2.5, isHero: true, stack: 100 }, bb: { role: 'post', bet: 1, isHero: false, stack: 100 } }, pot: '0', ante: 0, summary: '' },
      ],
    })

    const excludeAllButAA = ALL_HANDS.filter(h => h !== 'AA')
    resetDrill([r], [1], { drillExcludedHands: excludeAllButAA })

    for (let i = 0; i < 40; i++) {
      useStore.getState().nextDrillHand()
      const s = useStore.getState()
      expect(s.activeHand).toBe('AA')
      const heroStack = Object.values(s.currentScenario).find(p => p.isHero)?.stack
      if (heroStack === 30) {
        expect(s.activeDrillStackGridIdx).toBe(0)
        expect(s.correctActionForCurrentHand).toBe('Allin')
      } else {
        expect(s.activeDrillStackGridIdx).toBe(1)
        expect(s.correctActionForCurrentHand).toBe('Raise')
      }
      // o check recomputa do mesmo stackGrid
      expect(useStore.getState().checkDrillAnswer(s.correctActionForCurrentHand).correct).toBe(true)
    }
  })
})

describe('drill — histórico grava rangeId e stackGridIdx', () => {
  it('entry guarda rangeId e stackGridIdx do sorteio', () => {
    const r = range({ id: 7, grid: uniformGrid({ raise: 100 }) })
    resetDrill([r], [7])
    useStore.getState().nextDrillHand()
    const idx = useStore.getState().activeDrillStackGridIdx
    useStore.getState().checkDrillAnswer('Raise')
    const hist = useStore.getState().handHistory
    const entry = hist[hist.length - 1]
    expect(entry.rangeId).toBe(7)
    expect(entry.stackGridIdx).toBe(idx)
  })
})

describe('drill — customAction (ação extra)', () => {
  it('RNG ligado: faixa extra responde com o label customizado', () => {
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 60, allin: 0, extra: 40 }
    const r = range({ id: 1, grid, customAction: { label: 'ISO', color: '#a855f7' } })
    resetDrill([r], [1], { useRngForFrequency: true, drillExcludedHands: ALL_HANDS.filter(h => h !== 'AA') })
    for (let i = 0; i < 40; i++) {
      useStore.getState().nextDrillHand()
      const s = useStore.getState()
      const expected = s.currentRng <= 60 ? 'Raise' : 'ISO'
      expect(s.correctActionForCurrentHand).toBe(expected)
      expect(useStore.getState().checkDrillAnswer(expected).correct).toBe(true)
    }
  })

  it('RNG desligado: extra majoritário vira ação principal', () => {
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 30, allin: 0, extra: 70 }
    const r = range({ id: 1, grid, customAction: { label: 'ISO', color: '#a855f7' } })
    resetDrill([r], [1], { drillExcludedHands: ALL_HANDS.filter(h => h !== 'AA') })
    useStore.getState().nextDrillHand()
    expect(useStore.getState().correctActionsForCurrentHand).toEqual(['ISO'])
    expect(useStore.getState().checkDrillAnswer('ISO').correct).toBe(true)
  })
})

describe('drill — sessão mista (vários ranges, 6-max e 8-max, com e sem stackGrids)', () => {
  it('toda resposta correta bate com o grid vigente e os totais por range fecham', () => {
    const r6 = range({ id: 1, name: '6max', tableSize: 6, grid: uniformGrid({ raise: 50, fold: 50 }) })

    const grid8 = uniformGrid({ allin: 40, fold: 60 })
    const r8: Range = {
      id: 2, name: '8max', positions: ['UTG'], grid: grid8, tableSize: 8,
      scenarios: [{ id: 1, data: { utg: { role: 'open', bet: 6, isHero: true, stack: 100 }, bb: { role: 'post', bet: 1, isHero: false, stack: 100 } }, pot: '0', ante: 0.5, summary: '' }],
    }

    const gridLow = uniformGrid({ allin: 100 })
    const gridHigh = uniformGrid({ raise: 100 })
    const rStack = range({
      id: 3, name: 'stacks',
      stackGrids: [{ stackRange: '<=40', grid: gridLow }, { stackRange: '>40', grid: gridHigh }],
      scenarios: [
        { id: 1, data: { btn: { role: 'allin', bet: 30, isHero: true, stack: 30 }, bb: { role: 'post', bet: 1, isHero: false, stack: 30 } }, pot: '0', ante: 0, summary: '' },
        { id: 2, data: { btn: { role: 'open', bet: 2.5, isHero: true, stack: 100 }, bb: { role: 'post', bet: 1, isHero: false, stack: 100 } }, pot: '0', ante: 0, summary: '' },
      ],
    })

    resetDrill([r6, r8, rStack], [1, 2, 3], { useRngForFrequency: true })
    useStore.getState().startDrillSession()

    let played = 0
    for (let i = 0; i < 120; i++) {
      useStore.getState().nextDrillHand()
      const s = useStore.getState()
      // grid vigente = stackGrid resolvido pelo idx, senão grid base
      const sg = s.activeDrillStackGridIdx >= 0 ? s.activeDrillRange!.stackGrids![s.activeDrillStackGridIdx] : undefined
      const grid = sg?.grid ?? s.activeDrillRange!.grid
      const expected = getRngCorrectAction(grid[s.activeHand], s.currentRng, s.activeDrillRange!.customAction?.label)
      expect(s.correctActionForCurrentHand).toBe(expected)
      expect(useStore.getState().checkDrillAnswer(expected).correct).toBe(true)
      played++
    }

    const s = useStore.getState()
    const totalAcc = Object.entries(s.sessionHandPerf)
      .filter(([k]) => !k.includes('|||'))
      .reduce((acc, [, hands]) => acc + Object.values(hands).reduce((a, v) => a + v.t, 0), 0)
    expect(totalAcc).toBe(played)
    expect(s.sessionStats.hands).toBe(played)
    expect(s.sessionStats.correct).toBe(played)
  })
})

describe('drill — replay aponta para o stackGrid correto da mão revisada', () => {
  it('o stackGridIdx gravado identifica o grid cuja resposta foi mostrada', () => {
    const gridLow = uniformGrid({ allin: 100 })
    const gridHigh = uniformGrid({ raise: 100 })
    const r = range({
      id: 5,
      stackGrids: [{ stackRange: '<=40', grid: gridLow }, { stackRange: '>40', grid: gridHigh }],
      scenarios: [
        { id: 1, data: { btn: { role: 'allin', bet: 30, isHero: true, stack: 30 }, bb: { role: 'post', bet: 1, isHero: false, stack: 30 } }, pot: '0', ante: 0, summary: '' },
        { id: 2, data: { btn: { role: 'open', bet: 2.5, isHero: true, stack: 100 }, bb: { role: 'post', bet: 1, isHero: false, stack: 100 } }, pot: '0', ante: 0, summary: '' },
      ],
    })
    resetDrill([r], [5], { drillExcludedHands: ALL_HANDS.filter(h => h !== 'AA') })
    for (let i = 0; i < 30; i++) {
      useStore.getState().nextDrillHand()
      useStore.getState().checkDrillAnswer('Allin')
      const hist = useStore.getState().handHistory
      const entry = hist[hist.length - 1]
      // A célula AA do stackGrid apontado pela entry deve produzir a correctAction registrada
      const grid = r.stackGrids![entry.stackGridIdx].grid
      const cell = grid['AA']
      const topAction = cell.allin === 100 ? 'Allin' : 'Raise'
      expect(entry.correctAction).toBe(topAction)
    }
  })
})

describe('drill — stats por range não corrompem acima de 50 mãos', () => {
  it('sessionHandPerf acumula o total real além do cap de 50 do histórico visual', () => {
    const r = range({ id: 9, grid: uniformGrid({ raise: 100 }) })
    resetDrill([r], [9])
    useStore.getState().startDrillSession()
    for (let i = 0; i < 70; i++) {
      useStore.getState().nextDrillHand()
      useStore.getState().checkDrillAnswer('Raise')
    }
    const s = useStore.getState()
    expect(s.handHistory.length).toBe(50)
    const perf = s.sessionHandPerf['9']
    const total = Object.values(perf).reduce((acc, v) => acc + v.t, 0)
    expect(total).toBe(70)
    expect(s.sessionStats.hands).toBe(70)
  })
})
