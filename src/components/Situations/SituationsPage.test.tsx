import { describe, it, expect } from 'vitest'
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

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ ranges: [RANGE] })
    const { container } = render(<SituationsPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect((await axe(container)).violations).toEqual([])
  })
})
