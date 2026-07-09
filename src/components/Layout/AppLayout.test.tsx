import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { useStore } from '../../store/useStore'
import { invalidateAnalyticsCache } from '../../utils/analyticsCache'

afterEach(() => { vi.restoreAllMocks(); invalidateAnalyticsCache() })

function renderLayout(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('AppLayout', () => {
  it('mostra a tela de login quando userMode é null', () => {
    useStore.setState({ userMode: null, page: 'dashboard', currentUser: null, justSignedUp: false, onboardingStep: null })
    renderLayout()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drill' })).not.toBeInTheDocument()
  })

  it('renderiza a navegação e o dashboard quando logado', () => {
    useStore.setState({ userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false })
    renderLayout()
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
  })

  it('exibe o banner de armazenamento bloqueado', () => {
    useStore.setState({ userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: true })
    renderLayout()
    expect(screen.getByText(/Armazenamento cheio/)).toBeInTheDocument()
  })

  it('oculta o banner quando o armazenamento está ok', () => {
    useStore.setState({ userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false })
    renderLayout()
    expect(screen.queryByText(/Armazenamento cheio/)).not.toBeInTheDocument()
  })

  it('page "ranges" renderiza a página de situações', () => {
    useStore.setState({ userMode: 'visitor', page: 'ranges', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false, ranges: [] })
    renderLayout()
    expect(screen.getByRole('button', { name: /Novo Range/ })).toBeInTheDocument()
  })

  it('page "admin" sem coach cai no dashboard (fallback)', () => {
    useStore.setState({
      userMode: 'visitor', page: 'admin', justSignedUp: false, onboardingStep: null, storageBlocked: false,
      currentUser: { id: 1, username: 'p', name: 'P', email: '', role: 'player', firstLogin: false, tier: '', turma: null },
    })
    renderLayout()
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Publicar ranges para o time/ })).not.toBeInTheDocument()
  })

  it('justSignedUp mostra o WelcomeModal', () => {
    useStore.setState({
      userMode: 'visitor', page: 'dashboard', storageBlocked: false, justSignedUp: true, onboardingStep: null,
      currentUser: { id: 1, username: 'novo', name: 'Novo', email: '', role: 'player', firstLogin: false, tier: '', turma: null },
    })
    renderLayout()
    expect(screen.getByText(/Bem-vindo/)).toBeInTheDocument()
  })

  it('onboardingStep mostra o OnboardingTour em vez do ChangePasswordModal', () => {
    useStore.setState({
      userMode: 'visitor', page: 'dashboard', storageBlocked: false, justSignedUp: false, onboardingStep: 0,
      currentUser: { id: 1, username: 'novo', name: 'Novo', email: '', role: 'player', firstLogin: true, tier: '', turma: null },
    })
    renderLayout()
    expect(screen.getByText('Bem-vindo ao Pre-Flop Pro!')).toBeInTheDocument()
    expect(screen.queryByText('Defina sua senha')).not.toBeInTheDocument()
  })

  it('firstLogin força o ChangePasswordModal', () => {
    useStore.setState({
      userMode: 'visitor', page: 'dashboard', storageBlocked: false, justSignedUp: false, onboardingStep: null,
      currentUser: { id: 1, username: 'reset', name: 'Reset', email: '', role: 'player', firstLogin: true, tier: '', turma: null },
    })
    renderLayout()
    expect(screen.getByText('Defina sua senha')).toBeInTheDocument()
  })

  it('page "drill" carrega o TrainerPage (lazy)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'drill', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false,
      ranges: [], selectedDrillRangeIds: [],
    })
    renderLayout('/drill')
    expect(await screen.findByText(/Selecione os ranges para o treino/)).toBeInTheDocument()
  })

  it('page "history" carrega o StatsPage (lazy)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'history', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false,
      trainingHistory: [],
    })
    renderLayout('/historico')
    expect(await screen.findByText('Histórico de Treinos')).toBeInTheDocument()
  })

  it('page "range-setup" carrega o RangeSetupPage (lazy)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'range-setup', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false,
    })
    renderLayout('/range-setup')
    expect(await screen.findByText('Configure o formato do jogo antes de criar o range.')).toBeInTheDocument()
  })

  it('page "editor" carrega o RangeEditorPage (lazy)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'editor', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false,
    })
    renderLayout('/editor')
    expect(await screen.findByText('Posição do HERO')).toBeInTheDocument()
  })

  it('page "table-editor" carrega o TableEditorPage (lazy)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'table-editor', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false,
    })
    renderLayout('/table-editor')
    expect(await screen.findByText('Configurar Cenários')).toBeInTheDocument()
  })

  it('page desconhecida cai no dashboard (fallback)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'dashboard', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false, ranges: [],
    })
    renderLayout('/rota-inexistente')
    expect(await screen.findByText('Comece agora')).toBeInTheDocument()
  })

  it('page "category-detail" carrega o CategoryDetailPage (lazy)', async () => {
    useStore.setState({
      userMode: 'visitor', page: 'category-detail', currentUser: null, justSignedUp: false, onboardingStep: null, storageBlocked: false,
      activeCategory: 'early', ranges: [],
    })
    renderLayout('/categoria')
    expect(await screen.findByRole('heading', { name: 'EARLY' })).toBeInTheDocument()
  })

  it('page "admin" como coach carrega o CoachPanel (lazy)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('/admin/users')
        ? { users: [] }
        : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({
      userMode: 'admin', page: 'admin', justSignedUp: false, onboardingStep: null, storageBlocked: false, authToken: 'tok',
      currentUser: { id: 1, username: 'coach', name: 'Coach', email: '', role: 'coach', firstLogin: false, tier: '', turma: null },
    })
    renderLayout('/coach')
    expect(await screen.findByRole('button', { name: /Publicar ranges para o time/ })).toBeInTheDocument()
    fetchSpy.mockRestore()
  })
})
