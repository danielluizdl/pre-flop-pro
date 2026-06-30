import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HandQuickSelect } from './HandQuickSelect'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid, getAllPairs } from '../../utils/hands'

function setBrush() {
  useStore.setState({
    brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
  })
}

describe('HandQuickSelect', () => {
  it('renderiza os grupos de mãos', () => {
    setBrush()
    render(<HandQuickSelect mode="brush" />)
    expect(screen.getByRole('button', { name: 'Pares' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suiteds' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Offsuits' })).toBeInTheDocument()
  })

  it('modo filter chama onSetExcluded ao clicar num grupo', () => {
    setBrush()
    const onSetExcluded = vi.fn()
    render(<HandQuickSelect mode="filter" excludedHands={[]} onSetExcluded={onSetExcluded} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    expect(onSetExcluded).toHaveBeenCalled()
  })

  it('modo brush aplica o pincel ao grupo quando nem tudo está pintado', () => {
    setBrush()
    const applyBrushToHands = vi.fn()
    useStore.setState({ applyBrushToHands })
    render(<HandQuickSelect mode="brush" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    expect(applyBrushToHands).toHaveBeenCalled()
  })

  it('modo brush limpa o grupo quando todas já estão pintadas', () => {
    const grid = makeEmptyGrid()
    getAllPairs().forEach(h => { grid[h] = { fold: 0, call: 0, raise: 100, allin: 0, extra: 0 } })
    useStore.setState({
      brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
      rangeData: { id: null, name: '', grid, positions: [], tableSize: 8, stackRange: '' },
    })
    const clearHands = vi.fn()
    useStore.setState({ clearHands })
    render(<HandQuickSelect mode="brush" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    expect(clearHands).toHaveBeenCalled()
  })

  it('modo brush desabilita os grupos quando o pincel está zerado', () => {
    useStore.setState({
      brush: { call: 0, raise: 0, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
      rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 8, stackRange: '' },
    })
    render(<HandQuickSelect mode="brush" />)
    expect(screen.getByRole('button', { name: 'Pares' })).toBeDisabled()
  })

  it('modo filter remove a exclusão quando o grupo inteiro já está excluído', () => {
    setBrush()
    const onSetExcluded = vi.fn()
    const allPairs = getAllPairs()
    render(<HandQuickSelect mode="filter" excludedHands={allPairs} onSetExcluded={onSetExcluded} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    expect(onSetExcluded).toHaveBeenCalledWith([])
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setBrush()
    const { container } = render(<HandQuickSelect mode="brush" />)
    expect((await axe(container)).violations).toEqual([])
  })
})
