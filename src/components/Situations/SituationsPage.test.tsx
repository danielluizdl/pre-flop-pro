import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { SituationsPage } from './SituationsPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const RANGE: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }

describe('SituationsPage', () => {
  it('mostra o cabeçalho e o botão de novo range', () => {
    useStore.setState({ ranges: [RANGE] })
    render(<SituationsPage />)
    expect(screen.getByText('Meus Ranges')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Novo Range' })).toBeInTheDocument()
  })

  it('estado vazio quando não há ranges', () => {
    useStore.setState({ ranges: [] })
    render(<SituationsPage />)
    expect(screen.getByText('Nenhum range criado ainda.')).toBeInTheDocument()
  })

  it('expande o grupo de posição e mostra o range', () => {
    useStore.setState({ ranges: [RANGE] })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Treinar/ })).toBeInTheDocument()
  })

  it('Editar chama loadRangeForEdit do range', () => {
    const loadRangeForEdit = vi.fn()
    useStore.setState({ ranges: [RANGE], loadRangeForEdit })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(loadRangeForEdit).toHaveBeenCalledWith(1)
  })

  it('Apagar pede confirmação e só deleta se confirmado', () => {
    const deleteRange = vi.fn()
    useStore.setState({ ranges: [RANGE], deleteRange })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    const del = screen.getByRole('button', { name: 'Apagar range' })
    fireEvent.click(del)
    expect(deleteRange).not.toHaveBeenCalled()
    fireEvent.click(del)
    expect(deleteRange).toHaveBeenCalledWith(1)
    confirmSpy.mockRestore()
  })

  it('mostra a precisão acumulada do range quando há dados', () => {
    useStore.setState({
      ranges: [RANGE],
      handPerformance: { 1: { AA: { c: 8, t: 10 } } },
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('abre o heatmap sem dados de treino', () => {
    useStore.setState({ ranges: [RANGE], handPerformance: {} })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver heatmap' }))
    expect(screen.getByRole('dialog', { name: 'BTN RFI' })).toBeInTheDocument()
    expect(screen.getByText('Nenhum dado de treino ainda.')).toBeInTheDocument()
  })

  it('heatmap com dados mostra botão de resetar e fecha pelo ✕', () => {
    const clearHandPerformance = vi.fn()
    useStore.setState({
      ranges: [RANGE],
      handPerformance: { 1: { AA: { c: 5, t: 10 } } },
      clearHandPerformance,
    })
    render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver heatmap' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resetar dados' }))
    expect(clearHandPerformance).toHaveBeenCalledWith(1)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE] })
    const { container } = render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect((await axe(container)).violations).toEqual([])
  })
})
