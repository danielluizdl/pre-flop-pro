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
  vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const data = url.includes('view=overview') ? { overview: OVERVIEW } : { rows: [] }
    return Promise.resolve({ json: () => Promise.resolve(data) } as unknown as Response)
  })
  useStore.setState({ authToken: 'tok', listDevices: async () => ({ ok: true, devices: [] }) })
}

afterEach(() => vi.restoreAllMocks())

describe('MyAccountStats', () => {
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
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
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
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
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

  it('não tem violações de acessibilidade (axe)', async () => {
    mockApi()
    const { container } = render(<MyAccountStats />)
    await screen.findByText('702')
    expect((await axe(container)).violations).toEqual([])
  })
})
