import { describe, it, expect } from 'vitest'
import { combosOf, classOf, rangeComboStats, TOTAL_COMBOS, CLASS_TOTAL } from './rangeCombos'

describe('combos por classe', () => {
  it('par=6, suited=4, offsuit=12', () => {
    expect(combosOf('AA')).toBe(6)
    expect(combosOf('AKs')).toBe(4)
    expect(combosOf('AKo')).toBe(12)
  })
  it('classOf', () => {
    expect(classOf('22')).toBe('pair')
    expect(classOf('JTs')).toBe('suited')
    expect(classOf('JTo')).toBe('offsuit')
  })
  it('totais batem com o baralho', () => {
    expect(CLASS_TOTAL.pair + CLASS_TOTAL.suited + CLASS_TOTAL.offsuit).toBe(TOTAL_COMBOS)
    expect(TOTAL_COMBOS).toBe(1326)
  })
})

describe('rangeComboStats', () => {
  it('mão 100% raise conta todos os combos da mão', () => {
    const s = rangeComboStats({ AA: { raise: 100 } })
    expect(s.openCombos).toBe(6)
    expect(s.byAction.raise).toBe(6)
    expect(s.openPct).toBeCloseTo((6 / 1326) * 100, 5)
  })
  it('frequência parcial pondera os combos', () => {
    const s = rangeComboStats({ AKs: { raise: 50, fold: 50 } })
    expect(s.openCombos).toBe(2) // 4 * 0.5
    expect(s.byClass.suited.combos).toBe(2)
  })
  it('mistura de ações soma não-fold (clampado em 100)', () => {
    const s = rangeComboStats({ AKo: { raise: 70, call: 30 } })
    expect(s.openCombos).toBe(12)
    expect(s.byAction.raise).toBeCloseTo(12 * 0.7, 5)
    expect(s.byAction.call).toBeCloseTo(12 * 0.3, 5)
  })
  it('cobertura por classe usa o total da classe', () => {
    const s = rangeComboStats({ AA: { raise: 100 } })
    expect(s.byClass.pair.coveragePct).toBeCloseTo((6 / 78) * 100, 5)
    expect(s.byClass.suited.combos).toBe(0)
  })
  it('grid vazio = 0%', () => {
    const s = rangeComboStats({})
    expect(s.openCombos).toBe(0)
    expect(s.openPct).toBe(0)
  })
  it('fold entra no byAction e total fecha por mao', () => {
    const s = rangeComboStats({ AKs: { raise: 50, fold: 50 } })
    expect(s.byAction.raise).toBe(2)
    expect(s.byAction.fold).toBe(2)
    expect(s.accountedCombos).toBe(4) // 4 combos da mao, 50/50
  })
  it('mao 100% fold conta tudo como fold', () => {
    const s = rangeComboStats({ '72o': { fold: 100 } })
    expect(s.byAction.fold).toBe(12)
    expect(s.openCombos).toBe(0)
    expect(s.accountedCombos).toBe(12)
  })
})
