import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Dashboard } from './Dashboard'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const RANGE: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }
const mkRange = (id: number): Range => ({ ...RANGE, id, name: `Range ${id}`, grid: { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 100, allin: 0 } } })

describe('Dashboard', () => {
  it('mostra o estado vazio e navega para criar o primeiro range', () => {
    useStore.setState({ ranges: [], trainingHistory: [], currentUser: null, page: 'dashboard' })
    render(<Dashboard />)
    expect(screen.getByText('Nenhum range criado ainda.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Criar primeiro range' }))
    expect(useStore.getState().page).toBe('range-setup')
  })

  it('renderiza a seção secundária quando há mais de 3 ranges', () => {
    useStore.setState({ ranges: [1, 2, 3, 4, 5].map(mkRange), trainingHistory: [], currentUser: null })
    render(<Dashboard />)
    expect(screen.getByText('Range 5')).toBeInTheDocument()
  })

  it('mostra o hero, os stats e as categorias', () => {
    useStore.setState({ ranges: [RANGE], trainingHistory: [], currentUser: null })
    render(<Dashboard />)
    expect(screen.getByText('Comece agora')).toBeInTheDocument()
    expect(screen.getByText('Treine por categoria')).toBeInTheDocument()
    expect(screen.getByText('Ranges')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Iniciar treino/ })).toBeInTheDocument()
    expect(screen.getByText('EARLY')).toBeInTheDocument()
  })

  it('clicar numa categoria seta a categoria ativa e navega', () => {
    useStore.setState({ ranges: [RANGE], trainingHistory: [], currentUser: null, page: 'dashboard', activeCategory: null })
    render(<Dashboard />)
    fireEvent.click(screen.getByText('EARLY'))
    expect(useStore.getState().activeCategory).toBe('early')
    expect(useStore.getState().page).toBe('category-detail')
  })

  it('"Ver todos" navega para a página de ranges', () => {
    useStore.setState({ ranges: [1, 2].map(mkRange), trainingHistory: [], currentUser: null, page: 'dashboard' })
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: /Ver todos/ }))
    expect(useStore.getState().page).toBe('ranges')
  })

  it('clicar num range recente vai para o drill', () => {
    useStore.setState({ ranges: [mkRange(1)], trainingHistory: [], currentUser: null, page: 'dashboard' })
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: /Range 1/ }))
    expect(useStore.getState().page).toBe('drill')
  })

  it('clicar num range da seção secundária vai para o drill', () => {
    useStore.setState({ ranges: [1, 2, 3, 4, 5].map(mkRange), trainingHistory: [], currentUser: null, page: 'dashboard' })
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: /Range 5/ }))
    expect(useStore.getState().page).toBe('drill')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE], trainingHistory: [], currentUser: null })
    const { container } = render(<Dashboard />)
    expect((await axe(container)).violations).toEqual([])
  })
})
