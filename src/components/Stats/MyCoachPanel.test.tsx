import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { MyCoachPanel } from './MyCoachPanel'
import { StatsPage } from './StatsPage'
import { useStore } from '../../store/useStore'
import { invalidateAnalyticsCache } from '../../utils/analyticsCache'

const PLAYER = { id: 7, username: 'p1', name: 'Jogador Um', email: '', role: 'player' as const, firstLogin: false, tier: 'main', turma: null }

function mockApi() {
  const urls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    urls.push(String(input))
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ rows: [], team: null, cells: [], overview: null, devices: [] }),
    } as unknown as Response)
  })
  useStore.setState({ authToken: 'tok', currentUser: PLAYER })
  return urls
}

afterEach(() => { vi.restoreAllMocks(); invalidateAnalyticsCache() })

describe('MyCoachPanel', () => {
  it('renderiza filtros de período/range e as seções pessoais, sem filtro de jogadores', async () => {
    mockApi()
    render(<MyCoachPanel />)
    expect(await screen.findByText('Por range')).toBeInTheDocument()
    expect(screen.getByText('Maiores leaks')).toBeInTheDocument()
    expect(screen.getByText('Consulta no drill')).toBeInTheDocument()
    expect(screen.getByText('Todos os ranges')).toBeInTheDocument()
    expect(screen.queryByText('Todos os jogadores')).not.toBeInTheDocument()
    expect(screen.queryByText('Resumo individual por jogador')).not.toBeInTheDocument()
  })

  it('busca dados no endpoint pessoal, nunca no de admin', async () => {
    const urls = mockApi()
    render(<MyCoachPanel />)
    await screen.findByText('Por range')
    const apiCalls = urls.filter(u => u.includes('/api/'))
    expect(apiCalls.length).toBeGreaterThan(0)
    for (const u of apiCalls) {
      expect(u).toContain('/api/me/analytics')
      expect(u).not.toContain('/api/admin/')
      expect(u).not.toContain('playerIds')
    }
  })

  it('não tem violações de acessibilidade', async () => {
    mockApi()
    const { container } = render(<MyCoachPanel />)
    await screen.findByText('Por range')
    expect((await axe(container)).violations).toEqual([])
  })
})

describe('StatsPage — aba Análise', () => {
  it('esconde a aba Análise para visitante deslogado', () => {
    useStore.setState({ trainingHistory: [], currentUser: null, authToken: null })
    render(<StatsPage />)
    expect(screen.queryByRole('button', { name: 'Análise' })).not.toBeInTheDocument()
  })

  it('mostra a aba Análise para usuário logado e abre o painel pessoal', async () => {
    mockApi()
    useStore.setState({ trainingHistory: [] })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Análise' }))
    expect(await screen.findByText('Por range')).toBeInTheDocument()
    expect(screen.getByText('Maiores leaks')).toBeInTheDocument()
  })
})
