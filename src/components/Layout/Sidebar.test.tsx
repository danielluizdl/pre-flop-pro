import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Sidebar } from './Sidebar'
import { useStore } from '../../store/useStore'

describe('Sidebar', () => {
  it('renderiza os itens de navegação', () => {
    useStore.setState({ userMode: null, page: 'dashboard' })
    render(<Sidebar collapsed={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeInTheDocument()
  })

  it('clicar num item chama setPage', () => {
    const setPage = vi.fn()
    useStore.setState({ userMode: null, page: 'dashboard', setPage })
    render(<Sidebar collapsed={false} onToggle={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Drill' }))
    expect(setPage).toHaveBeenCalledWith('drill')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ userMode: null, page: 'dashboard' })
    const { container } = render(<Sidebar collapsed={false} onToggle={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
