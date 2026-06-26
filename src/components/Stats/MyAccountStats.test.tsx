import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('não tem violações de acessibilidade (axe)', async () => {
    mockApi()
    const { container } = render(<MyAccountStats />)
    await screen.findByText('702')
    expect((await axe(container)).violations).toEqual([])
  })
})
