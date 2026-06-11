import { describe, it, expect } from 'vitest'
import {
  getRngCorrectAction, getRngBands, formatRngBands,
  getTopFrequencyActions, stackMatchesRange,
} from './hands'
import type { HandData } from '../types'

const hd = (p: Partial<HandData>): HandData => ({ fold: 0, call: 0, raise: 0, allin: 0, ...p })

describe('getRngCorrectAction — nova ordem (Allin > Raise > Call > extra > Fold)', () => {
  // 20% allin / 50% raise / 30% fold → 1-20 Allin, 21-70 Raise, 71-100 Fold
  const d = hd({ allin: 20, raise: 50, fold: 30 })

  it('rng=1 cai na primeira faixa (Allin)', () => {
    expect(getRngCorrectAction(d, 1)).toBe('Allin')
  })
  it('rng=20 (borda final do Allin)', () => {
    expect(getRngCorrectAction(d, 20)).toBe('Allin')
  })
  it('rng=21 (borda inicial do Raise)', () => {
    expect(getRngCorrectAction(d, 21)).toBe('Raise')
  })
  it('rng=70 (borda final do Raise)', () => {
    expect(getRngCorrectAction(d, 70)).toBe('Raise')
  })
  it('rng=71 (borda inicial do Fold)', () => {
    expect(getRngCorrectAction(d, 71)).toBe('Fold')
  })
  it('rng=100 cai na última faixa (Fold)', () => {
    expect(getRngCorrectAction(d, 100)).toBe('Fold')
  })

  it('respeita a ordem de agressividade quando há Call no meio', () => {
    // allin 10 / raise 30 / call 40 / fold 20 → 1-10 Allin, 11-40 Raise, 41-80 Call, 81-100 Fold
    const c = hd({ allin: 10, raise: 30, call: 40, fold: 20 })
    expect(getRngCorrectAction(c, 10)).toBe('Allin')
    expect(getRngCorrectAction(c, 11)).toBe('Raise')
    expect(getRngCorrectAction(c, 40)).toBe('Raise')
    expect(getRngCorrectAction(c, 41)).toBe('Call')
    expect(getRngCorrectAction(c, 80)).toBe('Call')
    expect(getRngCorrectAction(c, 81)).toBe('Fold')
  })

  it('mão 100% de uma ação retorna sempre essa ação', () => {
    expect(getRngCorrectAction(hd({ raise: 100 }), 1)).toBe('Raise')
    expect(getRngCorrectAction(hd({ raise: 100 }), 100)).toBe('Raise')
    expect(getRngCorrectAction(hd({ allin: 100 }), 50)).toBe('Allin')
  })

  it('extra com extraLabel ocupa a faixa antes do Fold', () => {
    // raise 70 / extra 30 → 1-70 Raise, 71-100 ISO
    const e = hd({ raise: 70, extra: 30 })
    expect(getRngCorrectAction(e, 70, 'ISO')).toBe('Raise')
    expect(getRngCorrectAction(e, 71, 'ISO')).toBe('ISO')
    expect(getRngCorrectAction(e, 100, 'ISO')).toBe('ISO')
  })

  it('extra sem extraLabel é ignorado e vira Fold', () => {
    const e = hd({ raise: 70, extra: 30 })
    expect(getRngCorrectAction(e, 80)).toBe('Fold')
    expect(getRngCorrectAction(e, 71)).toBe('Fold')
  })

  it('data undefined retorna Fold', () => {
    expect(getRngCorrectAction(undefined, 1)).toBe('Fold')
    expect(getRngCorrectAction(undefined, 100)).toBe('Fold')
  })
})

describe('getRngBands', () => {
  it('produz faixas na ordem de agressividade', () => {
    const bands = getRngBands(hd({ allin: 20, raise: 50, fold: 30 }))
    expect(bands).toEqual([
      { label: 'Allin', lo: 1, hi: 20 },
      { label: 'Raise', lo: 21, hi: 70 },
      { label: 'Fold', lo: 71, hi: 100 },
    ])
  })
  it('formata o mapa de faixas', () => {
    const bands = getRngBands(hd({ allin: 20, raise: 50, fold: 30 }))
    expect(formatRngBands(bands)).toBe('1–20 Allin · 21–70 Raise · 71–100 Fold')
  })
  it('inclui extra quando há extraLabel', () => {
    const bands = getRngBands(hd({ raise: 70, extra: 30 }), 'ISO')
    expect(bands).toEqual([
      { label: 'Raise', lo: 1, hi: 70 },
      { label: 'ISO', lo: 71, hi: 100 },
    ])
  })
  it('data undefined retorna faixa única de Fold', () => {
    expect(getRngBands(undefined)).toEqual([{ label: 'Fold', lo: 1, hi: 100 }])
  })
})

describe('getTopFrequencyActions', () => {
  it('empate retorna múltiplas ações', () => {
    expect(getTopFrequencyActions(hd({ raise: 50, call: 50 })).sort()).toEqual(['Call', 'Raise'])
  })
  it('100% fold retorna Fold', () => {
    expect(getTopFrequencyActions(hd({ fold: 100 }))).toEqual(['Fold'])
  })
  it('extra é ignorado sem extraLabel', () => {
    expect(getTopFrequencyActions(hd({ raise: 40, extra: 60 }))).toEqual(['Raise'])
  })
  it('extra conta quando há extraLabel', () => {
    expect(getTopFrequencyActions(hd({ raise: 40, extra: 60 }), 'ISO')).toEqual(['ISO'])
  })
  it('data undefined retorna Fold', () => {
    expect(getTopFrequencyActions(undefined)).toEqual(['Fold'])
  })
})

describe('stackMatchesRange', () => {
  it('<=40', () => {
    expect(stackMatchesRange(40, '<=40')).toBe(true)
    expect(stackMatchesRange(41, '<=40')).toBe(false)
  })
  it('<40', () => {
    expect(stackMatchesRange(39, '<40')).toBe(true)
    expect(stackMatchesRange(40, '<40')).toBe(false)
  })
  it('>=100', () => {
    expect(stackMatchesRange(100, '>=100')).toBe(true)
    expect(stackMatchesRange(99, '>=100')).toBe(false)
  })
  it('>100', () => {
    expect(stackMatchesRange(101, '>100')).toBe(true)
    expect(stackMatchesRange(100, '>100')).toBe(false)
  })
  it('faixa 25-40', () => {
    expect(stackMatchesRange(25, '25-40')).toBe(true)
    expect(stackMatchesRange(40, '25-40')).toBe(true)
    expect(stackMatchesRange(24, '25-40')).toBe(false)
    expect(stackMatchesRange(41, '25-40')).toBe(false)
  })
  it('sufixo bb (40bb)', () => {
    expect(stackMatchesRange(40, '40bb')).toBe(true)
    expect(stackMatchesRange(41, '40bb')).toBe(false)
  })
  it('exato', () => {
    expect(stackMatchesRange(60, '60')).toBe(true)
    expect(stackMatchesRange(61, '60')).toBe(false)
  })
  it('string vazia casa qualquer stack', () => {
    expect(stackMatchesRange(0, '')).toBe(true)
    expect(stackMatchesRange(999, '')).toBe(true)
  })
})
