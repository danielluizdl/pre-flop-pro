import { describe, it, expect } from 'vitest'
import { validateRanges } from './validateRanges'
import { makeEmptyGrid } from './hands'
import type { Range, Scenario, PositionConfig } from '../types'

function scenario(heroStack: number, heroCount = 1): Scenario {
  const data: Record<string, PositionConfig> = {
    btn: { role: 'open', bet: 2.5, isHero: heroCount >= 1, stack: heroStack },
    bb:  { role: 'post', bet: 1,   isHero: heroCount >= 2, stack: heroStack },
  }
  return { id: 1, data, pot: '0', ante: 0, summary: '' }
}

function baseRange(over: Partial<Range>): Range {
  return {
    id: 1, name: 'R', positions: ['BTN'], grid: makeEmptyGrid(),
    scenarios: [scenario(100)], tableSize: 6, ...over,
  }
}

describe('validateRanges', () => {
  it('range válido não retorna problemas', () => {
    expect(validateRanges([baseRange({})])).toEqual([])
  })

  it('detecta soma de frequências != 100', () => {
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 50, call: 0, raise: 30, allin: 0 }
    const problems = validateRanges([baseRange({ grid })])
    expect(problems.some(p => p.includes('AA') && p.includes('80'))).toBe(true)
  })

  it('detecta cenário sem hero', () => {
    const problems = validateRanges([baseRange({ scenarios: [scenario(100, 0)] })])
    expect(problems.some(p => p.includes('0 heróis'))).toBe(true)
  })

  it('detecta cenário com mais de 1 hero', () => {
    const problems = validateRanges([baseRange({ scenarios: [scenario(100, 2)] })])
    expect(problems.some(p => p.includes('2 heróis'))).toBe(true)
  })

  it('detecta prereqRangeId inexistente', () => {
    const problems = validateRanges([baseRange({ prereqRangeId: 999 })])
    expect(problems.some(p => p.includes('prereqRangeId 999'))).toBe(true)
  })

  it('detecta extra > 0 sem customAction', () => {
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 70, allin: 0, extra: 30 }
    const problems = validateRanges([baseRange({ grid })])
    expect(problems.some(p => p.includes('extra') && p.includes('customAction'))).toBe(true)
  })

  it('aceita extra > 0 quando há customAction', () => {
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 70, allin: 0, extra: 30 }
    const problems = validateRanges([baseRange({ grid, customAction: { label: 'ISO', color: '#fff' } })])
    expect(problems).toEqual([])
  })

  it('detecta nomes duplicados', () => {
    const a = baseRange({ id: 1, name: 'Dup' })
    const b = baseRange({ id: 2, name: 'Dup' })
    const problems = validateRanges([a, b])
    expect(problems.some(p => p.includes('Nome duplicado') && p.includes('Dup'))).toBe(true)
  })

  it('detecta stackGrid morto (hero stack não casa com nenhum)', () => {
    const r = baseRange({
      stackGrids: [
        { stackRange: '<=40', grid: makeEmptyGrid() },
        { stackRange: '40-60', grid: makeEmptyGrid() },
      ],
      scenarios: [scenario(100)],
    })
    const problems = validateRanges([r])
    expect(problems.some(p => p.includes('cenário morto'))).toBe(true)
  })

  it('detecta stackGrid ambíguo (hero stack casa com mais de 1)', () => {
    const r = baseRange({
      stackGrids: [
        { stackRange: '<=100', grid: makeEmptyGrid() },
        { stackRange: '>=40', grid: makeEmptyGrid() },
      ],
      scenarios: [scenario(50)],
    })
    const problems = validateRanges([r])
    expect(problems.some(p => p.includes('ambíguo'))).toBe(true)
  })
})
