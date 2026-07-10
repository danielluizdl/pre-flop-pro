import { describe, it, expect } from 'vitest'
import { resolveSessionRanges, sessionRangeKey } from './sessionRanges'
import { makeEmptyGrid } from './hands'
import type { Range } from '../types'

function r(id: number, name: string): Range {
  return { id, name, positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 6 }
}

describe('resolveSessionRanges', () => {
  it('resolve por id quando a sessão tem rangeIds (sobrevive a rename)', () => {
    const catalog = [r(42, 'BTN RFI (novo nome)')]
    const refs = resolveSessionRanges({ rangeNames: ['BTN RFI'], rangeIds: [42] }, catalog)
    expect(refs).toHaveLength(1)
    expect(refs[0].range?.id).toBe(42)
    expect(refs[0].name).toBe('BTN RFI (novo nome)')
    expect(refs[0].id).toBe(42)
  })

  it('sessão antiga sem rangeIds resolve por nome', () => {
    const catalog = [r(7, 'SB 3bet')]
    const refs = resolveSessionRanges({ rangeNames: ['SB 3bet'] }, catalog)
    expect(refs[0].range?.id).toBe(7)
    expect(refs[0].id).toBe(7)
  })

  it('range apagado vira placeholder com range=null mantendo nome e id gravados', () => {
    const refs = resolveSessionRanges({ rangeNames: ['Range Sumido'], rangeIds: [99] }, [])
    expect(refs).toHaveLength(1)
    expect(refs[0].range).toBeNull()
    expect(refs[0].name).toBe('Range Sumido')
    expect(refs[0].id).toBe(99)
  })

  it('range apagado em sessão antiga (sem rangeIds) fica com id=null', () => {
    const refs = resolveSessionRanges({ rangeNames: ['Antigo'] }, [])
    expect(refs[0].range).toBeNull()
    expect(refs[0].id).toBeNull()
  })

  it('id gravado ausente do catálogo cai no fallback por nome', () => {
    const catalog = [r(5, 'BB defesa')]
    const refs = resolveSessionRanges({ rangeNames: ['BB defesa'], rangeIds: [123] }, catalog)
    expect(refs[0].range?.id).toBe(5)
  })

  it('mantém a ordem e o pareamento índice a índice de rangeNames/rangeIds', () => {
    const catalog = [r(1, 'A'), r(2, 'B renomeado')]
    const refs = resolveSessionRanges({ rangeNames: ['B', 'A'], rangeIds: [2, 1] }, catalog)
    expect(refs.map(x => x.name)).toEqual(['B renomeado', 'A'])
  })
})

describe('sessionRangeKey', () => {
  it('usa o id quando existe e prefixo de nome quando não', () => {
    expect(sessionRangeKey({ range: null, name: 'X', id: 9 })).toBe('9')
    expect(sessionRangeKey({ range: null, name: 'X', id: null })).toBe('n:X')
  })
})
