import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { CategoryDetailPage } from './CategoryDetailPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const RANGE: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }

describe('CategoryDetailPage', () => {
  it('mostra a categoria e os ranges dela', () => {
    useStore.setState({ ranges: [RANGE], activeCategory: 'late' })
    render(<CategoryDetailPage />)
    expect(screen.getByText('LATE')).toBeInTheDocument()
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Treinar/ })).toBeInTheDocument()
  })

  it('estado vazio para categoria sem ranges', () => {
    useStore.setState({ ranges: [RANGE], activeCategory: 'straddle' })
    render(<CategoryDetailPage />)
    expect(screen.getByText('Nenhum range nesta categoria.')).toBeInTheDocument()
  })

  it('Treinar inicia a sessão e navega para o drill', () => {
    const startDrillSession = vi.fn()
    const nextDrillHand = vi.fn(() => true)
    const setPage = vi.fn()
    useStore.setState({ ranges: [RANGE], activeCategory: 'late', startDrillSession, nextDrillHand, setPage })
    render(<CategoryDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: /Treinar/ }))
    expect(startDrillSession).toHaveBeenCalled()
    expect(useStore.getState().selectedDrillRangeIds).toEqual([1])
    expect(setPage).toHaveBeenCalledWith('drill')
  })

  it('Treinar sem mãos disponíveis alerta e não navega', () => {
    const setPage = vi.fn()
    useStore.setState({ ranges: [RANGE], activeCategory: 'late', startDrillSession: vi.fn(), nextDrillHand: vi.fn(() => false), setPage })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<CategoryDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: /Treinar/ }))
    expect(alertSpy).toHaveBeenCalled()
    expect(setPage).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('Editar carrega o range para edição', () => {
    const loadRangeForEdit = vi.fn()
    useStore.setState({ ranges: [RANGE], activeCategory: 'late', loadRangeForEdit })
    render(<CategoryDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(loadRangeForEdit).toHaveBeenCalledWith(1)
  })

  it('mostra a precisão acumulada do range', () => {
    useStore.setState({ ranges: [RANGE], activeCategory: 'late', handPerformance: { 1: { AA: { c: 4, t: 10 } } } })
    render(<CategoryDetailPage />)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('"Início" volta ao dashboard', () => {
    const setPage = vi.fn()
    useStore.setState({ ranges: [RANGE], activeCategory: 'late', setPage })
    render(<CategoryDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: /Início/ }))
    expect(setPage).toHaveBeenCalledWith('dashboard')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE], activeCategory: 'late' })
    const { container } = render(<CategoryDetailPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
