import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HandQuickSelect } from './HandQuickSelect'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'

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

  it('não tem violações de acessibilidade (axe)', async () => {
    setBrush()
    const { container } = render(<HandQuickSelect mode="brush" />)
    expect((await axe(container)).violations).toEqual([])
  })
})
