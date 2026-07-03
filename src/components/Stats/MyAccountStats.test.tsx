import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { MyAccountStats } from './MyAccountStats'
import { useStore } from '../../store/useStore'

const OVERVIEW = {
  hands: 702, correct: 600, errors: 102, accuracy: 88,
  graves: 3, imprecisos: 5, consults: 10, sessions: 4, durationSeconds: 3600,
}

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
    return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
  })
  useStore.setState({ authToken: 'tok', listDevices: async () => ({ ok: true, devices: [] }) })
}

afterEach(() => vi.restoreAllMocks())

describe('MyAccountStats', () => {
  it('mostra skeleton (aria-busy) enquanto carrega', () => {
    mockApi()
    render(<MyAccountStats />)
    expect(screen.getByLabelText('Carregando dados da nuvem')).toHaveAttribute('aria-busy', 'true')
  })

  it('renderiza os cards com os dados da nuvem', async () => {
    mockApi()
    render(<MyAccountStats />)
    expect(await screen.findByText('702')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('Blunders')).toBeInTheDocument()
    expect(screen.getByText('Imprecisos')).toBeInTheDocument()
  })

  it('mostra estados vazios sem dados de range/mãos/sessões', async () => {
    mockApi()
    render(<MyAccountStats />)
    await screen.findByText('702')
    expect(screen.getByText('Sem dados ainda.')).toBeInTheDocument()
    expect(screen.getByText('Sem mãos com 3+ tentativas ainda.')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma sessão ativa.')).toBeInTheDocument()
  })

  it('erro de rede mostra mensagem + botão de tentar novamente que recarrega', async () => {
    let attempt = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      attempt++
      // 1ª rodada (3 chamadas) falha; depois passa a responder.
      if (attempt <= 3) return Promise.reject(new Error('network'))
      const url = String(input)
      const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok', listDevices: async () => ({ ok: true, devices: [] }) })

    render(<MyAccountStats />)
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    expect(screen.getByText('Não foi possível carregar os dados da nuvem.')).toBeInTheDocument()
    fireEvent.click(retry)
    expect(await screen.findByText('702')).toBeInTheDocument()
  })

  it('falha ao listar sessões mostra erro (não "nenhuma sessão")', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok', listDevices: async () => ({ ok: false }) })

    render(<MyAccountStats />)
    await screen.findByText('702')
    expect(await screen.findByText(/Não foi possível carregar as sessões/)).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma sessão ativa.')).not.toBeInTheDocument()
  })

  it('renderiza linhas das tabelas Por range e Piores mãos', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      let data: unknown = { rows: [] }
      if (url.includes('view=overview')) data = { overview: OVERVIEW }
      else if (url.includes('view=by-range')) data = { rows: [{ rangeId: 1, rangeName: 'BTN RFI', hands: 50, correct: 40, graves: 2, consults: 3, lastTrained: 0, accuracy: 80 }] }
      else if (url.includes('view=by-hand')) data = { rows: [{ hand: 'A5s', total: 12, correct: 4, accuracy: 33 }] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok', listDevices: async () => ({ ok: true, devices: [] }) })
    render(<MyAccountStats />)
    expect(await screen.findByText('BTN RFI')).toBeInTheDocument()
    expect(screen.getByText('A5s')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  function mockApiWith(overrideOverview: Partial<typeof OVERVIEW>) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('view=overview') ? { overview: { ...OVERVIEW, ...overrideOverview } } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok', listDevices: async () => ({ ok: true, devices: [] }) })
  }

  it('formata a duração em minutos quando abaixo de uma hora', async () => {
    mockApiWith({ durationSeconds: 125 })
    render(<MyAccountStats />)
    expect(await screen.findByText('2m')).toBeInTheDocument()
  })

  it('formata a duração em segundos quando abaixo de um minuto', async () => {
    mockApiWith({ durationSeconds: 45 })
    render(<MyAccountStats />)
    expect(await screen.findByText('45s')).toBeInTheDocument()
  })

  it('exibe travessão para sessão sem data de expiração', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({
      authToken: 'tok',
      listDevices: async () => ({ ok: true, devices: [
        { id: 9, current: false, createdAt: 0, expiresAt: 0 },
      ] }),
    })
    render(<MyAccountStats />)
    await screen.findByText('702')
    expect(await screen.findByText('Iniciada em — · expira em —')).toBeInTheDocument()
  })

  it('erro nas sessões recarrega ao tentar novamente', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    let ok = false
    useStore.setState({
      authToken: 'tok',
      listDevices: async () => (ok ? { ok: true, devices: [] } : { ok: false }),
    })
    render(<MyAccountStats />)
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    ok = true
    fireEvent.click(retry)
    expect(await screen.findByText('Nenhuma sessão ativa.')).toBeInTheDocument()
  })

  function mockDevices(over: { revokeDevice?: () => Promise<{ ok: boolean }>; revokeOtherDevices?: () => Promise<{ ok: boolean }> } = {}) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
      return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({
      authToken: 'tok',
      listDevices: async () => ({ ok: true, devices: [
        { id: 1, current: true, createdAt: 1700000000, expiresAt: 1800000000 },
        { id: 2, current: false, createdAt: 1700000000, expiresAt: 1800000000 },
      ] }),
      ...over,
    })
  }

  it('lista sessões e marca a sessão atual', async () => {
    mockDevices()
    render(<MyAccountStats />)
    expect(await screen.findByText('Sessão #1')).toBeInTheDocument()
    expect(screen.getByText('Esta sessão')).toBeInTheDocument()
  })

  it('encerra outra sessão chamando revokeDevice com o id', async () => {
    const revokeDevice = vi.fn(async () => ({ ok: true }))
    mockDevices({ revokeDevice })
    render(<MyAccountStats />)
    await screen.findByText('Sessão #1')
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    expect(revokeDevice).toHaveBeenCalledWith(2)
  })

  it('"Encerrar as outras" chama revokeOtherDevices', async () => {
    const revokeOtherDevices = vi.fn(async () => ({ ok: true }))
    mockDevices({ revokeOtherDevices })
    render(<MyAccountStats />)
    await screen.findByText('Sessão #1')
    fireEvent.click(screen.getByRole('button', { name: /Encerrar as outras/ }))
    expect(revokeOtherDevices).toHaveBeenCalled()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    mockApi()
    const { container } = render(<MyAccountStats />)
    await screen.findByText('702')
    expect((await axe(container)).violations).toEqual([])
  })
})
