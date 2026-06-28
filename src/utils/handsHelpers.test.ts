import { describe, it, expect } from 'vitest'
import {
  ALL_HANDS,
  makeEmptyGrid,
  generateSuits,
  getHighestFrequencyAction,
  countNonFoldHands,
  focusWeight,
  weightedPick,
  getAllPairs,
  getAllSuited,
  getAllOffsuit,
  getConnectorsSuited,
  getConnectorsOffsuit,
  getOneGappersSuited,
  getBroadwaysSuited,
  getBroadwaysOffsuit,
  stackRangesOverlap,
  stackMatchesRange,
} from './hands'
import type { HandData } from '../types'

const hd = (p: Partial<HandData>): HandData => ({ fold: 0, call: 0, raise: 0, allin: 0, ...p })

describe('ALL_HANDS / makeEmptyGrid', () => {
  it('tem 169 mãos únicas', () => {
    expect(ALL_HANDS).toHaveLength(169)
    expect(new Set(ALL_HANDS).size).toBe(169)
  })
  it('inclui pares, suited e offsuit', () => {
    expect(ALL_HANDS).toContain('AA')
    expect(ALL_HANDS).toContain('AKs')
    expect(ALL_HANDS).toContain('AKo')
  })
  it('makeEmptyGrid cria 169 células 100% fold', () => {
    const g = makeEmptyGrid()
    expect(Object.keys(g)).toHaveLength(169)
    expect(g['AA']).toEqual({ fold: 100, call: 0, raise: 0, allin: 0, size: 0 })
    expect(Object.values(g).every(d => d.fold === 100)).toBe(true)
  })
})

describe('generateSuits', () => {
  it('par (2 chars) gera dois naipes diferentes', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = generateSuits('AA')
      expect(a).not.toBe(b)
    }
  })
  it('suited (sufixo s) gera o mesmo naipe', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = generateSuits('AKs')
      expect(a).toBe(b)
    }
  })
  it('offsuit (sufixo o) gera naipes diferentes', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = generateSuits('AKo')
      expect(a).not.toBe(b)
    }
  })
  it('só usa naipes válidos', () => {
    const valid = new Set(['c', 'd', 'h', 's'])
    const [a, b] = generateSuits('72o')
    expect(valid.has(a)).toBe(true)
    expect(valid.has(b)).toBe(true)
  })
})

describe('getHighestFrequencyAction', () => {
  it('retorna a ação de maior frequência', () => {
    expect(getHighestFrequencyAction(hd({ raise: 70, fold: 30 }))).toBe('Raise')
    expect(getHighestFrequencyAction(hd({ call: 60, fold: 40 }))).toBe('Call')
    expect(getHighestFrequencyAction(hd({ allin: 80, fold: 20 }))).toBe('Allin')
    expect(getHighestFrequencyAction(hd({ fold: 100 }))).toBe('Fold')
  })
  it('considera extra apenas com extraLabel', () => {
    expect(getHighestFrequencyAction(hd({ extra: 90, fold: 10 }), 'Iso')).toBe('Iso')
    expect(getHighestFrequencyAction(hd({ extra: 90, fold: 10 }))).toBe('Fold')
  })
})

describe('countNonFoldHands', () => {
  it('conta mãos com fold < 100', () => {
    const g = makeEmptyGrid()
    g['AA'] = hd({ raise: 100 })
    g['KK'] = hd({ call: 50, fold: 50 })
    expect(countNonFoldHands(g)).toBe(2)
  })
  it('grid vazio conta zero', () => {
    expect(countNonFoldHands(makeEmptyGrid())).toBe(0)
  })
})

describe('focusWeight', () => {
  it('mão nunca treinada vale 3', () => {
    expect(focusWeight(undefined)).toBe(3)
    expect(focusWeight({ c: 0, t: 0 })).toBe(3)
  })
  it('100% de acerto vale 1', () => {
    expect(focusWeight({ c: 10, t: 10 })).toBe(1)
  })
  it('0% de acerto vale 5', () => {
    expect(focusWeight({ c: 0, t: 10 })).toBe(5)
  })
  it('50% de acerto vale 3', () => {
    expect(focusWeight({ c: 5, t: 10 })).toBe(3)
  })
})

describe('weightedPick', () => {
  it('escolhe pelo índice proporcional ao rnd', () => {
    const items = ['a', 'b', 'c']
    const weights = [1, 1, 1]
    expect(weightedPick(items, weights, 0)).toBe('a')
    expect(weightedPick(items, weights, 0.5)).toBe('b')
    expect(weightedPick(items, weights, 0.99)).toBe('c')
  })
  it('peso maior captura mais faixa', () => {
    const items = ['raro', 'comum']
    const weights = [1, 9]
    expect(weightedPick(items, weights, 0.05)).toBe('raro')
    expect(weightedPick(items, weights, 0.2)).toBe('comum')
  })
  it('total <= 0 cai no sorteio uniforme', () => {
    const items = ['a', 'b']
    expect(weightedPick(items, [0, 0], 0)).toBe('a')
    expect(weightedPick(items, [0, 0], 0.99)).toBe('b')
  })
  it('rnd no limite retorna o último item', () => {
    expect(weightedPick(['a', 'b'], [1, 1], 1)).toBe('b')
  })
})

describe('grupos de mãos', () => {
  it('getAllPairs tem 13 pares', () => {
    const p = getAllPairs()
    expect(p).toHaveLength(13)
    expect(p[0]).toBe('AA')
    expect(p[12]).toBe('22')
  })
  it('getAllSuited tem 78 mãos suited', () => {
    const s = getAllSuited()
    expect(s).toHaveLength(78)
    expect(s.every(h => h.endsWith('s'))).toBe(true)
    expect(s).toContain('AKs')
  })
  it('getAllOffsuit tem 78 mãos offsuit', () => {
    const o = getAllOffsuit()
    expect(o).toHaveLength(78)
    expect(o.every(h => h.endsWith('o'))).toBe(true)
    expect(o).toContain('AKo')
  })
  it('getConnectorsSuited tem 12 conectores', () => {
    const c = getConnectorsSuited()
    expect(c).toHaveLength(12)
    expect(c).toContain('KQs')
    expect(c).toContain('32s')
  })
  it('getConnectorsOffsuit tem 12 conectores', () => {
    const c = getConnectorsOffsuit()
    expect(c).toHaveLength(12)
    expect(c).toContain('KQo')
    expect(c).toContain('32o')
  })
  it('getOneGappersSuited tem 11 one-gappers', () => {
    const g = getOneGappersSuited()
    expect(g).toHaveLength(11)
    expect(g).toContain('KJs')
    expect(g).toContain('42s')
  })
  it('getBroadwaysSuited tem 10 mãos', () => {
    const b = getBroadwaysSuited()
    expect(b).toHaveLength(10)
    expect(b).toContain('AKs')
    expect(b).toContain('JTs')
  })
  it('getBroadwaysOffsuit tem 10 mãos', () => {
    const b = getBroadwaysOffsuit()
    expect(b).toHaveLength(10)
    expect(b).toContain('AKo')
    expect(b).toContain('JTo')
  })
})

describe('stackRangesOverlap', () => {
  it('faixas que se cruzam retornam true', () => {
    expect(stackRangesOverlap('20-40', '30-50')).toBe(true)
    expect(stackRangesOverlap('<=40', '>=30')).toBe(true)
  })
  it('faixas disjuntas retornam false', () => {
    expect(stackRangesOverlap('20-40', '50-60')).toBe(false)
    expect(stackRangesOverlap('<20', '>=30')).toBe(false)
  })
  it('faixa aberta sobrepõe exato dentro dela', () => {
    expect(stackRangesOverlap('>=100', '120')).toBe(true)
    expect(stackRangesOverlap('>=100', '80')).toBe(false)
  })
  it('string inválida não sobrepõe', () => {
    expect(stackRangesOverlap('abc', '20-40')).toBe(false)
    expect(stackRangesOverlap('20-40', '')).toBe(false)
  })
  it('limites tocando contam como sobreposição', () => {
    expect(stackRangesOverlap('20-40', '40-60')).toBe(true)
  })
})

describe('stackMatchesRange — ramos extras', () => {
  it('string desconhecida casa qualquer stack', () => {
    expect(stackMatchesRange(50, 'qualquer')).toBe(true)
  })
  it('en-dash na faixa', () => {
    expect(stackMatchesRange(30, '25–40')).toBe(true)
  })
})
