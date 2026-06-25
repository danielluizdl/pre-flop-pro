import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('não tem violações de acessibilidade (axe)', async () => {
    setup()
    const { container } = render(<TopNav />)
    expect((await axe(container)).violations).toEqual([])
  })
})
