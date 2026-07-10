import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { BuildAccountStats } from './BuildAccountStats'
import { useStore } from '../../store/useStore'

const OVERVIEW = {
  rounds: 42, avgScore: 84.3, bestScore: 98.5, ranges: 5,
  sessions: 7, durationSeconds: 1500, lastActivity: 1720000000,
}

function mockApi(overview: Partial<typeof OVERVIEW> = {}, byRange: unknown[] = [], sessions: unknown[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    let data: unknown = { rows: [] }
    if (url.includes('view=build-overview')) data = { overview: { ...OVERVIEW, ...overview } }
    else if (url.includes('view=build-by-range')) data = { rows: byRange }
    else if (url.includes('view=build-sessions')) data = { rows: sessions }
    return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
  })
  useStore.setState({ authToken: 'tok' })
}

afterEach(() => {
  vi.restoreAllMocks()
  useStore.setState({ authToken: null })
})

describe('BuildAccountStats', () => {
  it('não renderiza nada sem token', () => {
    useStore.setState({ authToken: null })
    const { container } = render(<BuildAccountStats />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra skeleton (aria-busy) enquanto carrega', () => {
    mockApi()
    render(<BuildAccountStats />)
    expect(screen.getByLabelText('Carregando dados da nuvem')).toHaveAttribute('aria-busy', 'true')
  })

  it('renderiza os cards com os dados da conta', async () => {
    mockApi()
    render(<BuildAccountStats />)
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('84.3')).toBeInTheDocument()
    expect(screen.getByText('98.5')).toBeInTheDocument()
    expect(screen.getByText('25m')).toBeInTheDocument()
  })

  it('sem rounds mostra o estado vazio da conta', async () => {
    mockApi({ rounds: 0 })
    render(<BuildAccountStats />)
    expect(await screen.findByText('Sem dados de Range Check na conta ainda.')).toBeInTheDocument()
  })

  it('erro de rede mostra mensagem + tentar novamente recarrega', async () => {
    let attempt = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      attempt++
      if (attempt <= 3) return Promise.reject(new Error('network'))
      const url = String(input)
      const data = url.includes('view=build-overview') ? { overview: OVERVIEW } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    render(<BuildAccountStats />)
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    expect(screen.getByText('Não foi possível carregar os dados da nuvem.')).toBeInTheDocument()
    fireEvent.click(retry)
    expect(await screen.findByText('42')).toBeInTheDocument()
  })

  it('renderiza as tabelas Por range e Sessões recentes', async () => {
    mockApi({},
      [{ rangeId: 1, rangeName: 'BTN RFI', attempts: 10, avgScore: 88.2, bestScore: 100, lastActivity: 1720000000 }],
      [{ sessionUuid: 'u1', rounds: 3, avgScore: 77.7, startedAt: 1720000000, durationSeconds: 90 }],
    )
    render(<BuildAccountStats />)
    expect(await screen.findByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByText('88.2')).toBeInTheDocument()
    expect(screen.getByText('77.7')).toBeInTheDocument()
    expect(screen.getByText('1m')).toBeInTheDocument()
  })

  it('sessão sem duração (schema_v8 pendente) mostra travessão', async () => {
    mockApi({}, [], [{ sessionUuid: 'u1', rounds: 3, avgScore: 77.7, startedAt: 1720000000, durationSeconds: null }])
    render(<BuildAccountStats />)
    expect(await screen.findByText('77.7')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    mockApi({},
      [{ rangeId: 1, rangeName: 'BTN RFI', attempts: 10, avgScore: 88.2, bestScore: 100, lastActivity: 1720000000 }],
      [{ sessionUuid: 'u1', rounds: 3, avgScore: 77.7, startedAt: 1720000000, durationSeconds: 90 }],
    )
    const { container } = render(<BuildAccountStats />)
    await screen.findByText('BTN RFI')
    expect((await axe(container)).violations).toEqual([])
  })
})
