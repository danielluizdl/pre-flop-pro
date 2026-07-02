import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './useStore'
import { makeEmptyGrid } from '../utils/hands'
import { POS_6MAX, POS_8MAX } from '../types'
import type { Range } from '../types'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('../utils/eventQueue', () => ({
  enqueue: vi.fn(),
  flush: vi.fn(),
}))

import { enqueue } from '../utils/eventQueue'

const s = () => useStore.getState()

function gridWith(hand: string) {
  const g = makeEmptyGrid()
  g[hand] = { fold: 0, call: 0, raise: 100, allin: 0 }
  return g
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    ranges: [],
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
    selectedEditorPositions: [],
    sessionGrids: [],
    tempScenarios: [],
    page: 'dashboard',
    brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '2.5', extraLabel: '', extraColor: '#a855f7' },
  })
})

describe('loadRangeForEdit', () => {
  it('range simples: carrega nome/grid/posições e navega para o editor', () => {
    const r: Range = {
      id: 7, name: 'BTN RFI', positions: ['BTN'], grid: gridWith('AA'),
      scenarios: [{ id: 1, data: {}, pot: '1.5', ante: 0.5, summary: 'x' }], tableSize: 6, stackRange: '100bb',
    }
    useStore.setState({ ranges: [r] })
    s().loadRangeForEdit(7)
    const st = s()
    expect(st.page).toBe('editor')
    expect(st.rangeData.id).toBe(7)
    expect(st.rangeData.name).toBe('BTN RFI')
    expect(st.rangeData.stackRange).toBe('100bb')
    expect(st.rangeData.grid.AA.raise).toBe(100)
    expect(st.selectedEditorPositions).toEqual(['BTN'])
    expect(st.sessionGrids).toEqual([])
    expect(st.currentTableSize).toBe(6)
    expect(st.activePositions).toBe(POS_6MAX)
    expect(st.currentAnte).toBe(0.5)
    expect(st.tempScenarios).toHaveLength(1)
  })

  it('range multi-stack: variantes viram sessionGrids e o editor abre vazio', () => {
    const r: Range = {
      id: 9, name: 'STR multi', positions: ['STR'], grid: gridWith('AA'), scenarios: [], tableSize: 8,
      stackGrids: [
        { stackRange: '<=40', grid: gridWith('AA'), name: 'baixo' },
        { stackRange: '>40', grid: gridWith('KK') },
      ],
    }
    useStore.setState({ ranges: [r] })
    s().loadRangeForEdit(9)
    const st = s()
    expect(st.page).toBe('editor')
    expect(st.rangeData.id).toBe(9)
    expect(st.rangeData.name).toBe('')
    expect(st.selectedEditorPositions).toEqual([])
    expect(st.sessionGrids).toHaveLength(2)
    expect(st.sessionGrids[0]).toMatchObject({ name: 'baixo', stackRange: '<=40', positions: ['STR'] })
    // variante sem nome herda o nome do range
    expect(st.sessionGrids[1].name).toBe('STR multi')
    expect(st.activePositions).toBe(POS_8MAX)
  })

  it('range com customAction restaura o pincel extra', () => {
    const r: Range = {
      id: 3, name: 'ISO', positions: ['CO'], grid: gridWith('AA'), scenarios: [], tableSize: 6,
      customAction: { label: 'ISO', color: '#123456' },
    }
    useStore.setState({ ranges: [r] })
    s().loadRangeForEdit(3)
    expect(s().brush.extraLabel).toBe('ISO')
    expect(s().brush.extraColor).toBe('#123456')
  })

  it('range com prereqRangeId preserva o pré-requisito no rangeData', () => {
    const r: Range = { id: 4, name: 'X', positions: ['BB'], grid: gridWith('AA'), scenarios: [], tableSize: 6, prereqRangeId: 99 }
    useStore.setState({ ranges: [r] })
    s().loadRangeForEdit(4)
    expect(s().rangeData.prereqRangeId).toBe(99)
  })

  it('id inexistente: no-op', () => {
    s().loadRangeForEdit(12345)
    expect(s().page).toBe('dashboard')
    expect(s().rangeData.id).toBeNull()
  })
})

describe('logConsult / incrementConsults', () => {
  it('logConsult dispara o evento de telemetria com range e mão', () => {
    useStore.setState({ sessionUuid: 'uuid-1', authToken: 'tok' })
    s().logConsult(5, 'BTN RFI', 'AKs')
    expect(enqueue).toHaveBeenCalledWith('consult', { rangeId: 5, rangeName: 'BTN RFI', hand: 'AKs', session_uuid: 'uuid-1' }, 'tok')
  })

  it('logConsult sem mão e sem sessão envia null', () => {
    useStore.setState({ sessionUuid: '', authToken: null })
    s().logConsult(5, 'BTN RFI')
    expect(enqueue).toHaveBeenCalledWith('consult', { rangeId: 5, rangeName: 'BTN RFI', hand: null, session_uuid: null }, null)
  })

  it('incrementConsults soma no sessionStats', () => {
    useStore.setState({ sessionStats: { hands: 2, correct: 1, errors: 1, consults: 0 } })
    s().incrementConsults()
    s().incrementConsults()
    expect(s().sessionStats.consults).toBe(2)
    expect(s().sessionStats.hands).toBe(2)
  })
})
