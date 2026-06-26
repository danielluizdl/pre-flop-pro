import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HandMatrix, __cellRenderCount } from './HandMatrix'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'

describe('HandMatrix', () => {
  it('renderiza as 169 mãos do grid 13x13', () => {
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} readOnly />)
    expect(container.querySelectorAll('[data-hand]')).toHaveLength(169)
    expect(screen.getByText('AA')).toBeInTheDocument()
    expect(screen.getByText('AKs')).toBeInTheDocument()
    expect(screen.getByText('72o')).toBeInTheDocument()
  })

  it('mostra o toggle Ações / Erro-Acerto quando há heatmap', () => {
    render(<HandMatrix grid={makeEmptyGrid()} heatmap={{}} />)
    expect(screen.getByText('Ações')).toBeInTheDocument()
    expect(screen.getByText('Erro / Acerto')).toBeInTheDocument()
  })

  it('aplica o brush ao clicar numa mão vazia', () => {
    const applyBrush = vi.fn()
    useStore.setState({
      applyBrush,
      brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
    })
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} />)
    fireEvent.mouseDown(container.querySelector('[data-hand="AA"]')!)
    expect(applyBrush).toHaveBeenCalledWith('AA')
  })

  it('mover o mouse no heatmap não re-renderiza as 169 células (memoização)', () => {
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} heatmap={{ AA: { c: 1, t: 1 } }} forceViewMode="heatmap" />)
    const gridEl = container.querySelector('.grid')!
    __cellRenderCount.n = 0
    fireEvent.mouseMove(gridEl, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(gridEl, { clientX: 20, clientY: 20 })
    fireEvent.mouseMove(gridEl, { clientX: 30, clientY: 30 })
    // O tooltip segue o cursor, mas as células são memoizadas → não re-renderizam.
    expect(__cellRenderCount.n).toBe(0)
  })

  it('mudar o grid re-renderiza apenas a célula afetada (memo deixa passar mudança real)', () => {
    const grid = makeEmptyGrid()
    const { container, rerender } = render(<HandMatrix grid={grid} readOnly />)
    __cellRenderCount.n = 0
    const next = { ...grid, AA: { fold: 0, call: 0, raise: 100, allin: 0 } }
    rerender(<HandMatrix grid={next} readOnly />)
    expect(__cellRenderCount.n).toBe(1)
    expect(container.querySelector('[data-hand="AA"]')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} readOnly />)
    expect((await axe(container)).violations).toEqual([])
  })
})
