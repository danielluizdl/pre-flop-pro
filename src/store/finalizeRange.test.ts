import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './useStore'
import { makeEmptyGrid } from '../utils/hands'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

const s = () => useStore.getState()

function playedGrid(hand: string) {
  const g = makeEmptyGrid()
  g[hand] = { fold: 0, call: 0, raise: 100, allin: 0 }
  return g
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    ranges: [],
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 6, stackRange: '' },
    brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '2.5', extraLabel: '', extraColor: '#a855f7' },
    selectedEditorPositions: [],
    sessionGrids: [],
    tempScenarios: [],
    currentTableSize: 6,
  })
})

describe('finalizeRange', () => {
  it('cria um range simples com o grid do editor', () => {
    useStore.setState({
      rangeData: { id: null, name: 'BTN RFI', grid: playedGrid('AA'), positions: ['BTN'], tableSize: 6, stackRange: '' },
      selectedEditorPositions: ['BTN'],
    })
    s().finalizeRange()
    const ranges = s().ranges
    expect(ranges).toHaveLength(1)
    expect(ranges[0].name).toBe('BTN RFI')
    expect(ranges[0].positions).toEqual(['BTN'])
    expect(ranges[0].grid.AA.raise).toBe(100)
    expect(ranges[0].stackGrids).toBeUndefined()
  })

  it('anexa customAction quando o pincel tem extraLabel', () => {
    useStore.setState({
      rangeData: { id: null, name: 'X', grid: playedGrid('AA'), positions: ['CO'], tableSize: 6, stackRange: '' },
      selectedEditorPositions: ['CO'],
      brush: { call: 0, raise: 0, allin: 0, extra: 100, raiseSize: '2.5', extraLabel: 'ISO', extraColor: '#123456' },
    })
    s().finalizeRange()
    expect(s().ranges[0].customAction).toEqual({ label: 'ISO', color: '#123456' })
  })

  it('agrupa por posição: posições diferentes viram ranges separados', () => {
    useStore.setState({
      sessionGrids: [
        { name: 'BTN', stackRange: '', grid: playedGrid('AA'), positions: ['BTN'] },
        { name: 'CO', stackRange: '', grid: playedGrid('KK'), positions: ['CO'] },
      ],
      selectedEditorPositions: [],
    })
    s().finalizeRange()
    const names = s().ranges.map(r => r.name).sort()
    expect(names).toEqual(['BTN', 'CO'])
    expect(s().ranges.every(r => !r.stackGrids)).toBe(true)
  })

  it('mesma posição com stackRanges diferentes vira um range multi-stack (stackGrids)', () => {
    useStore.setState({
      sessionGrids: [
        { name: 'baixo', stackRange: '<=40', grid: playedGrid('AA'), positions: ['BTN'] },
        { name: 'alto', stackRange: '>40', grid: playedGrid('KK'), positions: ['BTN'] },
      ],
      selectedEditorPositions: [],
    })
    s().finalizeRange('BTN combinado')
    expect(s().ranges).toHaveLength(1)
    const r = s().ranges[0]
    expect(r.name).toBe('BTN combinado')
    expect(r.stackGrids).toHaveLength(2)
    expect(r.stackGrids!.map(sg => sg.stackRange).sort()).toEqual(['<=40', '>40'])
  })

  it('deduplica: mesmo slot (posição+stackRange) mantém apenas o último grid', () => {
    useStore.setState({
      sessionGrids: [
        { name: 'antigo', stackRange: '', grid: playedGrid('AA'), positions: ['BTN'] },
        { name: 'novo', stackRange: '', grid: playedGrid('KK'), positions: ['BTN'] },
      ],
      selectedEditorPositions: [],
    })
    s().finalizeRange()
    expect(s().ranges).toHaveLength(1)
    expect(s().ranges[0].name).toBe('novo')
    expect(s().ranges[0].grid.KK.raise).toBe(100)
    expect(s().ranges[0].grid.AA.fold).toBe(100)
  })

  it('editando um range existente: substitui no lugar preservando o id', () => {
    const existing = { id: 42, name: 'velho', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 6 as const }
    useStore.setState({
      ranges: [existing],
      rangeData: { id: 42, name: 'atualizado', grid: playedGrid('QQ'), positions: ['BTN'], tableSize: 6, stackRange: '' },
      selectedEditorPositions: ['BTN'],
    })
    s().finalizeRange()
    expect(s().ranges).toHaveLength(1)
    expect(s().ranges[0].id).toBe(42)
    expect(s().ranges[0].name).toBe('atualizado')
    expect(s().ranges[0].grid.QQ.raise).toBe(100)
  })

  it('limpa o editor após finalizar e navega para ranges', () => {
    useStore.setState({
      rangeData: { id: null, name: 'X', grid: playedGrid('AA'), positions: ['BTN'], tableSize: 6, stackRange: '' },
      selectedEditorPositions: ['BTN'],
    })
    s().finalizeRange()
    expect(s().rangeData.id).toBeNull()
    expect(s().rangeData.name).toBe('')
    expect(s().tempScenarios).toEqual([])
    expect(s().page).toBe('ranges')
  })
})
