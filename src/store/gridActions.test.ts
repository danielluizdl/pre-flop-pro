import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { makeEmptyGrid, ALL_HANDS } from '../utils/hands'
import { POS_8MAX } from '../types'

const s = () => useStore.getState()

beforeEach(() => {
  useStore.setState({
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
    brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '2.5', extraLabel: '', extraColor: '#a855f7' },
    selectedEditorPositions: ['BTN'],
    sessionGrids: [],
    selectedDrillRangeIds: [],
    drillExcludedHands: [],
  })
})

describe('pincel sobre o grid', () => {
  it('applyBrush pinta a mão com fold complementar e tamanho do raise', () => {
    s().applyBrush('AA')
    const cell = s().rangeData.grid.AA
    expect(cell.raise).toBe(100)
    expect(cell.fold).toBe(0)
    expect(cell.size).toBe('2.5')
  })

  it('applyBrush não pinta quando o total do pincel passa de 100', () => {
    useStore.setState({ brush: { ...s().brush, call: 60, raise: 60 } })
    s().applyBrush('AA')
    expect(s().rangeData.grid.AA.fold).toBe(100)
  })

  it('applyBrushToHands pinta várias mãos de uma vez', () => {
    s().applyBrushToHands(['AA', 'KK', 'QQ'])
    expect(s().rangeData.grid.AA.raise).toBe(100)
    expect(s().rangeData.grid.KK.raise).toBe(100)
    expect(s().rangeData.grid.QQ.raise).toBe(100)
  })

  it('clearHand devolve a mão para 100% fold', () => {
    s().applyBrush('AA')
    s().clearHand('AA')
    expect(s().rangeData.grid.AA.fold).toBe(100)
    expect(s().rangeData.grid.AA.raise).toBe(0)
  })

  it('clearHands limpa um conjunto de mãos', () => {
    s().applyBrushToHands(['AA', 'KK'])
    s().clearHands(['AA', 'KK'])
    expect(s().rangeData.grid.AA.fold).toBe(100)
    expect(s().rangeData.grid.KK.fold).toBe(100)
  })

  it('resetGrid zera o grid inteiro', () => {
    s().applyBrushToHands(['AA', 'KK', 'QQ'])
    s().resetGrid()
    expect(Object.values(s().rangeData.grid).every(c => c.fold === 100)).toBe(true)
  })

  it('applyBrushToHands não pinta quando o total do pincel passa de 100', () => {
    useStore.setState({ brush: { ...s().brush, call: 60, raise: 60 } })
    s().applyBrushToHands(['AA', 'KK'])
    expect(s().rangeData.grid.AA.fold).toBe(100)
    expect(s().rangeData.grid.KK.fold).toBe(100)
  })
})

describe('setBrush clampeia o total em 100', () => {
  it('aumentar call reduz o maior dos demais (raise)', () => {
    useStore.setState({ brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '2.5', extraLabel: '', extraColor: '#a855f7' } })
    s().setBrush('call', 60)
    expect(s().brush.call).toBe(60)
    expect(s().brush.raise).toBe(40)
    expect(s().brush.call + s().brush.raise + s().brush.allin + s().brush.extra).toBe(100)
  })

  it('valor 100 zera as demais ações', () => {
    useStore.setState({ brush: { call: 30, raise: 30, allin: 0, extra: 0, raiseSize: '2.5', extraLabel: '', extraColor: '#a855f7' } })
    s().setBrush('allin', 100)
    expect(s().brush.allin).toBe(100)
    expect(s().brush.call).toBe(0)
    expect(s().brush.raise).toBe(0)
  })

  it('excesso grande cascateia a redução por até três ações', () => {
    useStore.setState({ brush: { call: 10, raise: 10, allin: 10, extra: 0, raiseSize: '2.5', extraLabel: 'Iso', extraColor: '#a855f7' } })
    s().setBrush('extra', 95)
    expect(s().brush.extra).toBe(95)
    expect(s().brush.call).toBe(0)
    expect(s().brush.raise).toBe(0)
    expect(s().brush.allin).toBe(5)
    expect(s().brush.call + s().brush.raise + s().brush.allin + s().brush.extra).toBe(100)
  })
})

describe('grids da sessão', () => {
  it('pushGridToSession move o grid atual para a sessão e limpa o editor', () => {
    s().setRangeName('BTN RFI')
    s().applyBrush('AA')
    s().pushGridToSession()
    expect(s().sessionGrids).toHaveLength(1)
    expect(s().sessionGrids[0].name).toBe('BTN RFI')
    expect(s().sessionGrids[0].positions).toEqual(['BTN'])
    expect(s().rangeData.name).toBe('')
    expect(s().selectedEditorPositions).toEqual([])
  })

  it('updateSessionGrid substitui o grid no índice', () => {
    s().pushGridToSession()
    const replacement = { name: 'novo', stackRange: '<=250bb', grid: makeEmptyGrid(), positions: ['CO'] }
    s().updateSessionGrid(0, replacement)
    expect(s().sessionGrids[0].name).toBe('novo')
  })

  it('removeSessionGrid remove pelo índice', () => {
    s().pushGridToSession()
    useStore.setState({ selectedEditorPositions: ['CO'] })
    s().pushGridToSession()
    s().removeSessionGrid(0)
    expect(s().sessionGrids).toHaveLength(1)
  })
})

describe('seleção do drill', () => {
  it('toggleDrillRange adiciona e remove ids', () => {
    s().toggleDrillRange(5)
    expect(s().selectedDrillRangeIds).toContain(5)
    s().toggleDrillRange(5)
    expect(s().selectedDrillRangeIds).not.toContain(5)
  })

  it('clearDrillRanges esvazia a seleção', () => {
    s().toggleDrillRange(1)
    s().toggleDrillRange(2)
    s().clearDrillRanges()
    expect(s().selectedDrillRangeIds).toEqual([])
  })

  it('toggleDrillHand alterna a exclusão de uma mão', () => {
    s().toggleDrillHand('AA')
    expect(s().drillExcludedHands).toContain('AA')
    s().toggleDrillHand('AA')
    expect(s().drillExcludedHands).not.toContain('AA')
  })

  it('setAllDrillHands(true) inclui tudo; (false) exclui tudo', () => {
    s().setAllDrillHands(false)
    expect(s().drillExcludedHands).toHaveLength(ALL_HANDS.length)
    s().setAllDrillHands(true)
    expect(s().drillExcludedHands).toEqual([])
  })
})

describe('formato de mesa e prereq', () => {
  it('setTableFormat(6) troca posições e reseta o range novo', () => {
    s().setTableFormat(6)
    expect(s().currentTableSize).toBe(6)
    expect(s().activePositions.length).toBe(6)
    expect(s().rangeData.tableSize).toBe(6)
  })

  it('setEditorPrereq seta e remove o pré-requisito', () => {
    s().setEditorPrereq(7)
    expect(s().rangeData.prereqRangeId).toBe(7)
    s().setEditorPrereq(null)
    expect(s().rangeData.prereqRangeId).toBeUndefined()
  })

  it('toggleEditorPosition é single-select', () => {
    useStore.setState({ activePositions: POS_8MAX, selectedEditorPositions: [] })
    s().toggleEditorPosition('BTN')
    expect(s().selectedEditorPositions).toEqual(['BTN'])
    s().toggleEditorPosition('CO')
    expect(s().selectedEditorPositions).toEqual(['CO'])
    s().toggleEditorPosition('CO')
    expect(s().selectedEditorPositions).toEqual([])
  })
})
