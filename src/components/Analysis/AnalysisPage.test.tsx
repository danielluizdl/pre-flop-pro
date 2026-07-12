import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AnalysisPage } from './AnalysisPage'
import { StatsPage } from '../Stats/StatsPage'
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

describe('AnalysisPage', () => {
  it('renderiza filtros de período/range e as seções pessoais, sem filtro de jogadores', async () => {
    mockApi()
    render(<AnalysisPage />)
    expect(await screen.findByText('Por range')).toBeInTheDocument()
    expect(screen.getByText('Maiores leaks')).toBeInTheDocument()
    expect(screen.getByText('Consulta no drill')).toBeInTheDocument()
    expect(screen.getByText('Todos os ranges')).toBeInTheDocument()
    expect(screen.queryByText('Todos os jogadores')).not.toBeInTheDocument()
    expect(screen.queryByText('Resumo individual por jogador')).not.toBeInTheDocument()
  })

  it('busca dados no endpoint pessoal, nunca no de admin', async () => {
    const urls = mockApi()
    render(<AnalysisPage />)
    await screen.findByText('Por range')
    const apiCalls = urls.filter(u => u.includes('/api/'))
    expect(apiCalls.length).toBeGreaterThan(0)
    for (const u of apiCalls) {
      expect(u).toContain('/api/me/analytics')
      expect(u).not.toContain('/api/admin/')
      expect(u).not.toContain('playerIds')
    }
  })

  it('deslogado: mostra estado vazio pedindo login, sem chamar a API', () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      urls.push(String(input))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: null, currentUser: null })
    render(<AnalysisPage />)
    expect(screen.getByText('Entre na sua conta para ver sua análise')).toBeInTheDocument()
    expect(screen.queryByText('Por range')).not.toBeInTheDocument()
    expect(urls.filter(u => u.includes('/api/'))).toEqual([])
  })

  it('não tem violações de acessibilidade', async () => {
    mockApi()
    const { container } = render(<AnalysisPage />)
    await screen.findByText('Por range')
    expect((await axe(container)).violations).toEqual([])
  })
})

describe('AnalysisPage — abas Drill/Range Check', () => {
  it('mostra as duas abas e o Drill fica ativo por padrão', async () => {
    mockApi()
    render(<AnalysisPage />)
    await screen.findByText('Por range')
    expect(screen.getByRole('button', { name: 'Drill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Range Check' })).toBeInTheDocument()
    expect(screen.getByText('Maiores leaks')).toBeInTheDocument()
  })

  it('trocar para a aba Range Check mostra a matriz e some com as seções do Drill', async () => {
    mockApi()
    render(<AnalysisPage />)
    await screen.findByText('Por range')
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    expect(await screen.findByText('Matriz do range')).toBeInTheDocument()
    expect(screen.queryByText('Maiores leaks')).not.toBeInTheDocument()
    expect(screen.queryByText('Consulta no drill')).not.toBeInTheDocument()
  })

  it('aba Range Check nunca busca no endpoint de admin', async () => {
    const urls = mockApi()
    render(<AnalysisPage />)
    await screen.findByText('Por range')
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    await screen.findByText('Matriz do range')
    const apiCalls = urls.filter(u => u.includes('/api/'))
    expect(apiCalls.length).toBeGreaterThan(0)
    for (const u of apiCalls) expect(u).not.toContain('/api/admin/')
  })

  it('não tem violações de acessibilidade na aba Range Check', async () => {
    mockApi()
    const { container } = render(<AnalysisPage />)
    await screen.findByText('Por range')
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    await screen.findByText('Matriz do range')
    expect((await axe(container)).violations).toEqual([])
  })
})

describe('StatsPage — sem aba Análise', () => {
  it('logado, o Histórico não mostra mais a aba Análise (virou página própria)', async () => {
    mockApi()
    useStore.setState({ trainingHistory: [] })
    render(<StatsPage />)
    expect(screen.getByRole('button', { name: 'Meus dados na nuvem' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Análise' })).not.toBeInTheDocument()
  })
})
