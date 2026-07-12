import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { AnalysisPage } from './AnalysisPage'
import { StatsPage } from '../Stats/StatsPage'
import { useStore } from '../../store/useStore'
import { invalidateAnalyticsCache } from '../../utils/analyticsCache'
import { makeEmptyGrid } from '../../utils/hands'
import type { Range } from '../../types'

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

describe('AnalysisPage — Range Check, Por range com acertos/erros por mão', () => {
  function mockBuildByRange() {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      if (url.includes('view=build-by-range')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [{ rangeId: 1, rangeName: 'RFI CO', attempts: 12, avgScore: 87.4, correctHands: 1680, wrongHands: 348 }],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ rows: [], team: null, cells: [], overview: null, devices: [] }),
      } as unknown as Response)
    })
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    useStore.setState({
      authToken: 'tok',
      currentUser: PLAYER,
      ranges: [{ id: 1, name: 'RFI CO', positions: ['CO'], grid, scenarios: [], tableSize: 6 } as Range],
    })
    return urls
  }

  it('mostra tentativas/acertos/erros por mão/nota média somados de todas as tentativas do range', async () => {
    mockBuildByRange()
    render(<AnalysisPage />)
    await screen.findByText('Por range')
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    await screen.findByText('RFI CO')
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('1680')).toBeInTheDocument()
    expect(screen.getByText('348')).toBeInTheDocument()
    expect(screen.getByText('87.4')).toBeInTheDocument()
  })

  it('clicar na linha do range carrega a matriz (build-range-grid) daquele range', async () => {
    const urls = mockBuildByRange()
    render(<AnalysisPage />)
    await screen.findByText('Por range')
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    fireEvent.click(await screen.findByText('RFI CO'))
    await screen.findByText((_, el) => el?.tagName === 'H2' && !!el.textContent?.includes('RFI CO'))
    const gridCalls = urls.filter(u => u.includes('view=build-range-grid'))
    expect(gridCalls.length).toBeGreaterThan(0)
    expect(gridCalls[0]).toContain('rangeId=1')
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
