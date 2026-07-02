import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe } from 'jest-axe'
import { WelcomeModal } from './WelcomeModal'
import { useStore } from '../../store/useStore'
import type { CurrentUser } from '../../types'

const USER: CurrentUser = {
  id: 1, username: 'admin001', name: 'Daniel Loureiro', email: 'd@x.com', role: 'coach', firstLogin: true,
}

afterEach(() => vi.useRealTimers())

describe('WelcomeModal', () => {
  it('mostra a saudação com o primeiro nome e o botão', () => {
    useStore.setState({ currentUser: USER })
    render(<WelcomeModal />)
    expect(screen.getByText('Bem-vindo(a), Daniel!')).toBeInTheDocument()
    expect(screen.getByText('Conta criada com sucesso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bora treinar!' })).toBeInTheDocument()
  })

  it('clicar em "Bora treinar!" zera firstLogin do usuário após o fade', () => {
    vi.useFakeTimers()
    useStore.setState({ currentUser: { ...USER, firstLogin: true } })
    render(<WelcomeModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Bora treinar!' }))
    act(() => { vi.advanceTimersByTime(400) })
    expect(useStore.getState().currentUser?.firstLogin).toBe(false)
  })

  it('fecha automaticamente após a duração e zera firstLogin', () => {
    vi.useFakeTimers()
    useStore.setState({ currentUser: { ...USER, firstLogin: true } })
    render(<WelcomeModal />)
    act(() => { vi.advanceTimersByTime(6000 + 400) })
    expect(useStore.getState().currentUser?.firstLogin).toBe(false)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ currentUser: USER })
    const { container } = render(<WelcomeModal />)
    expect((await axe(container)).violations).toEqual([])
  })
})
