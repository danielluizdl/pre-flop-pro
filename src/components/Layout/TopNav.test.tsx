import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TopNav } from './TopNav'
import { useStore } from '../../store/useStore'

function setup() {
  useStore.setState({ page: 'dashboard', userMode: null, currentUser: null, darkMode: false })
}

describe('TopNav', () => {
  it('renderiza a navegação, o botão de novo range e o perfil', () => {
    setup()
    render(<TopNav />)
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo Range/ })).toBeInTheDocument()
    expect(screen.getByText('Visitante')).toBeInTheDocument()
  })

  it('clicar num item de navegação muda a página', () => {
    setup()
    const setPage = vi.fn()
    useStore.setState({ setPage })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Drill' }))
    expect(setPage).toHaveBeenCalledWith('drill')
    fireEvent.click(screen.getByRole('button', { name: /Novo Range/ }))
    expect(setPage).toHaveBeenCalledWith('range-setup')
  })

  it('alterna o modo escuro', () => {
    setup()
    const toggleDarkMode = vi.fn()
    useStore.setState({ toggleDarkMode })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Modo escuro' }))
    expect(toggleDarkMode).toHaveBeenCalled()
  })

  it('abre o menu de perfil e "Sair" faz logout', () => {
    setup()
    const authLogout = vi.fn()
    useStore.setState({ authLogout, currentUser: { id: 1, username: 'daniel', name: 'Daniel', email: '', role: 'player', firstLogin: false } })
    render(<TopNav />)
    expect(screen.queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('daniel'))
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }))
    expect(authLogout).toHaveBeenCalled()
  })

  it('mostra "Painel Coach" só para coach e navega para admin', () => {
    setup()
    const setPage = vi.fn()
    useStore.setState({ setPage, currentUser: { id: 1, username: 'coach', name: 'Coach', email: '', role: 'coach', firstLogin: false } })
    render(<TopNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Painel Coach' }))
    expect(setPage).toHaveBeenCalledWith('admin')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<TopNav />)
    expect((await axe(container)).violations).toEqual([])
  })
})
