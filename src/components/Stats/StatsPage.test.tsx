import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { StatsPage } from './StatsPage'
import { useStore } from '../../store/useStore'
import type { TrainingSession } from '../../types'

const SESSION: TrainingSession = {
  id: 1, timestamp: Date.now(), rangeNames: ['BTN RFI'], tableSize: 8,
  hands: 50, correct: 44, errors: 6, consults: 2, durationSeconds: 300,
}

describe('StatsPage', () => {
  it('mostra o cabeçalho e o estado vazio sem sessões', () => {
    useStore.setState({ trainingHistory: [], currentUser: null })
    render(<StatsPage />)
    expect(screen.getByText('Histórico de Treinos')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma sessão registrada ainda.')).toBeInTheDocument()
  })

  it('mostra os totais quando há histórico de sessões', () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    render(<StatsPage />)
    expect(screen.getByText('Precisão Global')).toBeInTheDocument()
    expect(screen.getByText('Mãos Totais')).toBeInTheDocument()
  })

  it('alterna para a aba Desempenho Global sem quebrar', () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Desempenho Global' }))
    expect(screen.queryByText('Nenhuma sessão registrada ainda.')).not.toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    const { container } = render(<StatsPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
