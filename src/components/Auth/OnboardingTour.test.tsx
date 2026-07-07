import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'jest-axe'
import { AppLayout } from '../Layout/AppLayout'
import { useStore } from '../../store/useStore'

function renderTour(onboardingStep = 0) {
  useStore.setState({
    userMode: 'visitor', page: 'dashboard', storageBlocked: false, justSignedUp: false, onboardingStep,
    currentUser: { id: 1, username: 'novo', name: 'Novo', email: '', role: 'player', firstLogin: false },
    ranges: [], trainingHistory: [], selectedDrillRangeIds: [], buildSelectedRangeIds: [],
  })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('OnboardingTour', () => {
  it('mostra o passo 1 (Dashboard) com o contador 1/8', () => {
    renderTour()
    expect(screen.getByText('Bem-vindo ao Pre-Flop Pro!')).toBeInTheDocument()
    expect(screen.getByText('1/8')).toBeInTheDocument()
  })

  it('"Próximo" navega de verdade pra próxima página (Meus Ranges)', async () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByRole('heading', { name: 'Meus Ranges' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('ranges')
    expect(useStore.getState().onboardingStep).toBe(1)
  })

  it('passo do editor chama setupNewRange e navega de verdade pro RangeEditorPage', async () => {
    renderTour(3)
    expect(await screen.findByRole('heading', { name: 'Criar Range' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
  })

  it('último passo (Histórico) mostra "Concluir" e encerra o tour ao clicar', async () => {
    renderTour(7)
    expect(await screen.findByText('Seu histórico')).toBeInTheDocument()
    expect(screen.getByText('8/8')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('não mostra "Voltar" no primeiro passo', () => {
    renderTour(0)
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })

  it('"Voltar" retorna ao passo anterior e roda o run() dele de novo', async () => {
    renderTour(1)
    expect(await screen.findByRole('heading', { name: 'Meus Ranges' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(useStore.getState().onboardingStep).toBe(0)
    expect(useStore.getState().page).toBe('dashboard')
    expect(screen.getByText('1/8')).toBeInTheDocument()
  })

  it('"Pular tutorial" encerra imediatamente em qualquer passo', () => {
    renderTour(2)
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('Esc encerra o tour', () => {
    renderTour(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('mostra a observação sobre reabrir o tutorial no perfil', () => {
    renderTour()
    expect(screen.getByText(/Perfil → Rever tutorial/)).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = renderTour()
    expect((await axe(container)).violations).toEqual([])
  })
})
