import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Dashboard } from './Dashboard'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const RANGE: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }

describe('Dashboard', () => {
  it('mostra o hero, os stats e as categorias', () => {
    useStore.setState({ ranges: [RANGE], trainingHistory: [], currentUser: null })
    render(<Dashboard />)
    expect(screen.getByText('Comece agora')).toBeInTheDocument()
    expect(screen.getByText('Treine por categoria')).toBeInTheDocument()
    expect(screen.getByText('Ranges')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Iniciar treino/ })).toBeInTheDocument()
    expect(screen.getByText('EARLY')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE], trainingHistory: [], currentUser: null })
    const { container } = render(<Dashboard />)
    expect((await axe(container)).violations).toEqual([])
  })
})
