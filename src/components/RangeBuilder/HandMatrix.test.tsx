import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { HandMatrix } from './HandMatrix'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { getRenderCount, resetRenderCount } from '../../test/renderCount'

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

  it('limpa a mão ao clicar numa célula já preenchida', () => {
    const clearHand = vi.fn()
    useStore.setState({ clearHand })
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const { container } = render(<HandMatrix grid={grid} />)
    fireEvent.mouseDown(container.querySelector('[data-hand="AA"]')!)
    expect(clearHand).toHaveBeenCalledWith('AA')
  })

  it('avisa quando a soma das frequências do brush passa de 100%', () => {
    const applyBrush = vi.fn()
    useStore.setState({
      applyBrush,
      brush: { call: 60, raise: 60, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
    })
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} />)
    fireEvent.mouseDown(container.querySelector('[data-hand="AA"]')!)
    expect(screen.getByText(/ultrapassa 100%/)).toBeInTheDocument()
    expect(applyBrush).not.toHaveBeenCalled()
  })

  it('no modo Erro/Acerto, passar o mouse mostra o tooltip de precisão', () => {
    const { container } = render(
      <HandMatrix grid={makeEmptyGrid()} heatmap={{ AA: { c: 3, t: 4 } }} forceViewMode="heatmap" />,
    )
    fireEvent.mouseEnter(container.querySelector('[data-hand="AA"]')!)
    expect(screen.getByText(/3\/4/)).toBeInTheDocument()
    expect(screen.getByText(/75%/)).toBeInTheDocument()
    fireEvent.mouseEnter(container.querySelector('[data-hand="KK"]')!)
    expect(screen.getByText('Não treinado')).toBeInTheDocument()
  })

  it('alternar para "Ações" troca o modo de visualização (aria-pressed)', () => {
    render(<HandMatrix grid={makeEmptyGrid()} heatmap={{ AA: { c: 1, t: 1 } }} readOnly />)
    const acoes = screen.getByRole('button', { name: 'Ações' })
    const erro = screen.getByRole('button', { name: 'Erro / Acerto' })
    expect(erro).toHaveAttribute('aria-pressed', 'true')
    expect(acoes).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(acoes)
    expect(acoes).toHaveAttribute('aria-pressed', 'true')
    expect(acoes).toHaveClass('bg-brand-600')
  })

  it('mover o mouse no heatmap não re-renderiza as 169 células (memoização)', () => {
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} heatmap={{ AA: { c: 1, t: 1 } }} forceViewMode="heatmap" />)
    const gridEl = container.querySelector('.grid')!
    resetRenderCount('handCell')
    fireEvent.mouseMove(gridEl, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(gridEl, { clientX: 20, clientY: 20 })
    fireEvent.mouseMove(gridEl, { clientX: 30, clientY: 30 })
    // O tooltip segue o cursor, mas as células são memoizadas → não re-renderizam.
    expect(getRenderCount('handCell')).toBe(0)
  })

  it('mudar o grid re-renderiza apenas a célula afetada (memo deixa passar mudança real)', () => {
    const grid = makeEmptyGrid()
    const { container, rerender } = render(<HandMatrix grid={grid} readOnly />)
    resetRenderCount('handCell')
    const next = { ...grid, AA: { fold: 0, call: 0, raise: 100, allin: 0 } }
    rerender(<HandMatrix grid={next} readOnly />)
    expect(getRenderCount('handCell')).toBe(1)
    expect(container.querySelector('[data-hand="AA"]')).toBeInTheDocument()
  })

  it('arrastar pinta várias mãos (mouseDown + mouseEnter)', () => {
    const applyBrush = vi.fn()
    useStore.setState({
      applyBrush,
      brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
    })
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} />)
    fireEvent.mouseDown(container.querySelector('[data-hand="AA"]')!)
    fireEvent.mouseEnter(container.querySelector('[data-hand="KK"]')!)
    fireEvent.mouseEnter(container.querySelector('[data-hand="QQ"]')!)
    expect(applyBrush).toHaveBeenCalledTimes(3)
    // soltar o mouse encerra o arrasto — enter depois não pinta
    fireEvent.mouseUp(container.querySelector('[data-hand="QQ"]')!)
    fireEvent.mouseEnter(container.querySelector('[data-hand="JJ"]')!)
    expect(applyBrush).toHaveBeenCalledTimes(3)
  })

  it('arrastar a partir de célula preenchida limpa as mãos por onde passa', () => {
    const clearHand = vi.fn()
    useStore.setState({ clearHand })
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const { container } = render(<HandMatrix grid={g} />)
    fireEvent.mouseDown(container.querySelector('[data-hand="AA"]')!)
    fireEvent.mouseEnter(container.querySelector('[data-hand="KK"]')!)
    expect(clearHand).toHaveBeenCalledWith('AA')
    expect(clearHand).toHaveBeenCalledWith('KK')
  })

  it('mão já pintada no mesmo arrasto não é repintada', () => {
    const applyBrush = vi.fn()
    useStore.setState({
      applyBrush,
      brush: { call: 0, raise: 100, allin: 0, extra: 0, raiseSize: '', extraLabel: '', extraColor: '#d97757' },
    })
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} />)
    fireEvent.mouseDown(container.querySelector('[data-hand="AA"]')!)
    fireEvent.mouseEnter(container.querySelector('[data-hand="AA"]')!)
    expect(applyBrush).toHaveBeenCalledTimes(1)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<HandMatrix grid={makeEmptyGrid()} readOnly />)
    expect((await axe(container)).violations).toEqual([])
  })
})
