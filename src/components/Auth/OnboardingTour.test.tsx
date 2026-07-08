import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'jest-axe'
import { AppLayout } from '../Layout/AppLayout'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

const DEMO_RANGE: Range = {
  id: 99,
  name: 'BTN RFI Demo',
  positions: ['BTN'],
  grid: { ...makeEmptyGrid(), AA: { fold: 0, call: 0, raise: 100, allin: 0 } },
  scenarios: [],
  tableSize: 6,
}

function renderTour(onboardingStep = 0, extra: Record<string, unknown> = {}) {
  useStore.setState({
    userMode: 'visitor', page: 'dashboard', storageBlocked: false, justSignedUp: false, onboardingStep,
    currentUser: { id: 1, username: 'novo', name: 'Novo', email: '', role: 'player', firstLogin: false },
    ranges: [], trainingHistory: [], selectedDrillRangeIds: [], buildSelectedRangeIds: [],
    activeDrillRange: null, buildRounds: [], buildConfirmed: false,
    ...extra,
  })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('OnboardingTour', () => {
  it('mostra o passo 1 (Dashboard) com o contador 1/13', () => {
    renderTour()
    expect(screen.getByText('Bem-vindo ao Pre-Flop Pro!')).toBeInTheDocument()
    expect(screen.getByText('1/13')).toBeInTheDocument()
  })

  it('"Próximo" navega de verdade pra próxima página (Meus Ranges)', async () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByRole('heading', { name: 'Meus Ranges' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('ranges')
    expect(useStore.getState().onboardingStep).toBe(1)
  })

  it('passo 4 (posição do herói) chama setupNewRange e navega pro RangeEditorPage', async () => {
    renderTour(3)
    expect(await screen.findByRole('heading', { name: 'Criar Range' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
  })

  it('passos 5 e 6 (nome / matriz) continuam no RangeEditorPage sem resetar o range', async () => {
    renderTour(3)
    await screen.findByRole('heading', { name: 'Criar Range' })
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Passo 3: nome do range')).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Passo 4: pintando as mãos')).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
  })

  it('passo 7 (mesa) chama initTableConfig e navega pro TableEditorPage', async () => {
    renderTour(6)
    expect(await screen.findByRole('heading', { name: 'Configurar Cenários' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('table-editor')
  })

  it('passo 8 (cenários) continua no TableEditorPage', async () => {
    renderTour(7)
    expect(await screen.findByRole('heading', { name: 'Configurar Cenários' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('table-editor')
  })

  it('voltar do passo 7 (mesa) pro passo 6 (matriz) navega de volta pro RangeEditorPage', async () => {
    renderTour(6)
    await screen.findByRole('heading', { name: 'Configurar Cenários' })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(await screen.findByRole('heading', { name: 'Criar Range' })).toBeInTheDocument()
    expect(useStore.getState().page).toBe('editor')
  })

  it('passo do Drill ao vivo inicia uma sessão de demonstração com uma mão real', async () => {
    renderTour(8, { ranges: [DEMO_RANGE] })
    await screen.findByText('Drill: escolha o que treinar')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByRole('button', { name: /FOLD/ })).toBeInTheDocument()
    expect(useStore.getState().activeDrillRange?.id).toBe(99)
  })

  it('passo do Drill ao vivo não reinicia uma sessão real já em andamento', async () => {
    renderTour(9, {
      ranges: [DEMO_RANGE],
      activeDrillRange: DEMO_RANGE,
      activeHand: 'KK',
      activeDrillStackGridIdx: -1,
      activeDrillStackRange: '',
      currentHandSuits: ['h', 's'],
      currentScenario: {},
      currentRng: 50,
      currentHeroRaiseSize: 0,
      sessionStats: { hands: 3, correct: 2, errors: 1, consults: 0 },
    })
    await screen.findByRole('button', { name: /FOLD/ })
    expect(useStore.getState().activeHand).toBe('KK')
    expect(useStore.getState().sessionStats.hands).toBe(3)
  })

  it('passo do Range Check ao vivo inicia uma rodada de demonstração pra pintar', async () => {
    renderTour(10, { ranges: [DEMO_RANGE] })
    await screen.findByText('Range Check: escolha o que reproduzir')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(await screen.findByText('Combos por ação')).toBeInTheDocument()
    expect(useStore.getState().buildRounds).toHaveLength(1)
  })

  it('último passo (Histórico) mostra "Concluir" e encerra o tour ao clicar', async () => {
    renderTour(12)
    expect(await screen.findByText('Seu histórico')).toBeInTheDocument()
    expect(screen.getByText('13/13')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(useStore.getState().onboardingStep).toBeNull()
  })

  it('encerrar o tour depois do passo de Drill ao vivo para a sessão de demonstração que ele criou', async () => {
    renderTour(9, { ranges: [DEMO_RANGE] })
    await screen.findByRole('button', { name: /FOLD/ })
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }))
    expect(useStore.getState().activeDrillRange).toBeNull()
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
    expect(screen.getByText('1/13')).toBeInTheDocument()
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
