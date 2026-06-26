import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE], activeCategory: 'late' })
    const { container } = render(<CategoryDetailPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
