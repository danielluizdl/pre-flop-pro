import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { useStore } from '../../store/useStore'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('AppLayout', () => {
  it('mostra a tela de login quando userMode é null', () => {
    useStore.setState({ userMode: null, page: 'dashboard', currentUser: null, justSignedUp: false })
    renderLayout()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drill' })).not.toBeInTheDocument()
  })

  it('renderiza a navegação e o dashboard quando logado', () => {
    useStore.setState({ userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, storageBlocked: false })
    renderLayout()
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
  })

  it('exibe o banner de armazenamento bloqueado', () => {
    useStore.setState({ userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, storageBlocked: true })
    renderLayout()
    expect(screen.getByText(/Armazenamento cheio/)).toBeInTheDocument()
  })

  it('oculta o banner quando o armazenamento está ok', () => {
    useStore.setState({ userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, storageBlocked: false })
    renderLayout()
    expect(screen.queryByText(/Armazenamento cheio/)).not.toBeInTheDocument()
  })
})
