import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { RangeHeatGrid, type GridCell } from './RangeHeatGrid'
import { getRenderCount, resetRenderCount } from '../../test/renderCount'

function cell(over: Partial<GridCell> & { hand: string }): GridCell {
  return {
    total: 10,
    correct: 8,
    accuracy: 80,
    graves: 1,
    consults: 2,
    correctAction: 'raise',
    topWrong: null,
    ...over,
  }
}

describe('RangeHeatGrid', () => {
  it('renderiza os botões de métrica e as 169 células', () => {
    const { container } = render(<RangeHeatGrid cells={[]} />)
    expect(screen.getByRole('button', { name: 'Precisão' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blunders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volume' })).toBeInTheDocument()
    expect(container.querySelectorAll('.aspect-square')).toHaveLength(169)
  })

  it('mostra tooltip com precisão e contagens ao passar o mouse', () => {
    const cells = [cell({ hand: 'AA', total: 12, correct: 9, accuracy: 75, graves: 2, consults: 4 })]
    render(<RangeHeatGrid cells={cells} />)
    fireEvent.mouseEnter(screen.getByText('AA'))
    expect(screen.getByText(/9\/12/)).toBeInTheDocument()
    expect(screen.getByText(/graves 2 · consultas 4/)).toBeInTheDocument()
  })

  it('troca a métrica ativa ao clicar', () => {
    const cells = [cell({ hand: 'AA' })]
    render(<RangeHeatGrid cells={cells} />)
    const blunders = screen.getByRole('button', { name: 'Blunders' })
    fireEvent.click(blunders)
    expect(blunders.className).toContain('bg-brand-600')
  })

  it('mover o mouse não re-renderiza as 169 células (memoização)', () => {
    const { container } = render(<RangeHeatGrid cells={[cell({ hand: 'AA' })]} />)
    const gridEl = container.querySelector('.grid')!
    resetRenderCount('heatCell')
    fireEvent.mouseMove(gridEl, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(gridEl, { clientX: 20, clientY: 20 })
    expect(getRenderCount('heatCell')).toBe(0)
  })

  it('métricas consultas e volume colorem as células com dados', () => {
    const cells = [cell({ hand: 'AA', total: 20, consults: 9, graves: 4, accuracy: 30 })]
    render(<RangeHeatGrid cells={cells} />)
    const aaCell = screen.getByText('AA').closest('.aspect-square')!
    const layer = () => aaCell.querySelector('.absolute.inset-0') as HTMLElement
    expect(layer().style.background).toContain('239, 68, 68')
    fireEvent.click(screen.getByRole('button', { name: 'Consultas' }))
    expect(layer().style.background).toContain('139, 92, 246')
    fireEvent.click(screen.getByRole('button', { name: 'Volume' }))
    expect(layer().style.background).toContain('148, 163, 184')
  })

  it('tooltip mostra a ação mais errada (topWrong)', () => {
    const cells = [cell({ hand: 'AA', topWrong: { action: 'call', n: 3 }, correctAction: 'raise' })]
    render(<RangeHeatGrid cells={cells} />)
    fireEvent.mouseEnter(screen.getByText('AA'))
    expect(screen.getByText(/erram mais/)).toBeInTheDocument()
    expect(screen.getByText('call')).toBeInTheDocument()
  })

  it('sair do grid com o mouse esconde o tooltip', () => {
    const { container } = render(<RangeHeatGrid cells={[cell({ hand: 'AA' })]} />)
    fireEvent.mouseEnter(screen.getByText('AA'))
    expect(screen.getByText(/8\/10/)).toBeInTheDocument()
    fireEvent.mouseLeave(container.querySelector('.grid')!)
    expect(screen.queryByText(/8\/10/)).not.toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const cells = [cell({ hand: 'AA' })]
    const { container } = render(<RangeHeatGrid cells={cells} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  }, 20000)
})
