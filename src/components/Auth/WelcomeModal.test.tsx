import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { WelcomeModal } from './WelcomeModal'
import { useStore } from '../../store/useStore'
import type { CurrentUser } from '../../types'

const USER: CurrentUser = {
  id: 1, username: 'admin001', name: 'Daniel Loureiro', email: 'd@x.com', role: 'coach', firstLogin: true,
}

describe('WelcomeModal', () => {
  it('mostra a saudação com o primeiro nome e o botão', () => {
    useStore.setState({ currentUser: USER })
    render(<WelcomeModal />)
    expect(screen.getByText('Bem-vindo(a), Daniel!')).toBeInTheDocument()
    expect(screen.getByText('Conta criada com sucesso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bora treinar!' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ currentUser: USER })
    const { container } = render(<WelcomeModal />)
    expect((await axe(container)).violations).toEqual([])
  })
})
