import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import CoachPanel from './CoachPanel'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { getRenderCount, resetRenderCount } from '../../test/renderCount'
import type { Range } from '../../types'

function mockApi() {
  vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const data = url.includes('/admin/users')
      ? { users: [] }
      : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
  })
  useStore.setState({ authToken: 'tok' })
}

afterEach(() => vi.restoreAllMocks())

describe('CoachPanel', () => {
  it('renderiza as abas, o botão de publicar e os filtros do time', async () => {
    mockApi()
    render(<CoachPanel />)
    expect(await screen.findByRole('button', { name: 'Visão do time' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por jogador' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Publicar ranges para o time/ })).toBeInTheDocument()
    expect(screen.getByText('Todos os jogadores')).toBeInTheDocument()
    expect(screen.getByText('Todos os ranges')).toBeInTheDocument()
  })

  it('mostra "Por range" como primeira seção colapsável', async () => {
    mockApi()
    render(<CoachPanel />)
    expect(await screen.findByText('Por range')).toBeInTheDocument()
    expect(screen.getByText('Resumo do time')).toBeInTheDocument()
    expect(screen.getByText('Maiores leaks')).toBeInTheDocument()
    expect(screen.queryByText('Hotspots de consulta')).not.toBeInTheDocument()
  })

  it('período Custom revela dois campos de data', async () => {
    mockApi()
    const { container } = render(<CoachPanel />)
    await screen.findByRole('button', { name: 'Visão do time' })
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } })
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2)
  })

  it('troca para a aba "Por jogador"', async () => {
    mockApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Por jogador' }))
    expect(await screen.findByText('Nenhum jogador cadastrado ainda.')).toBeInTheDocument()
  })

  it('o filtro de range expõe aria-expanded e alterna ao abrir', async () => {
    mockApi()
    render(<CoachPanel />)
    const btn = await screen.findByRole('button', { name: 'Filtrar por range' })
    expect(btn).toHaveAttribute('aria-haspopup', 'listbox')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Buscar range')).toBeInTheDocument()
  })

  it('o filtro de range expõe listbox e seleciona via teclado (setas + Enter)', async () => {
    mockApi()
    const range: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }
    useStore.setState({ authToken: 'tok', ranges: [range] })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar por range' }))
    expect(screen.getByRole('listbox', { name: 'Ranges' })).toBeInTheDocument()
    const search = screen.getByRole('combobox', { name: 'Buscar range' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
  })

  it('Esc no campo de busca fecha o filtro de range', async () => {
    mockApi()
    const range: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }
    useStore.setState({ authToken: 'tok', ranges: [range] })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar por range' }))
    const search = screen.getByRole('combobox', { name: 'Buscar range' })
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('abrir o resumo de um jogador re-renderiza só a linha afetada (memo)', async () => {
    const orow = (userId: number, name: string) => ({
      userId, username: name.toLowerCase(), name, hands: 100, accuracy: 70,
      graves: 5, imprecisos: 2, consults: 3, sessions: 4, durationSeconds: 3600, lastActivity: 0,
    })
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      let data: unknown = { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      if (url.includes('/admin/users')) data = { users: [] }
      else if (url.includes('view=team-overview')) data = { rows: [orow(1, 'Alice'), orow(2, 'Bob')], team: null }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Resumo do time/ }))
    const alice = await screen.findByText('Alice')
    resetRenderCount('overviewRow')
    fireEvent.click(alice)
    // Só a linha da Alice muda (isOpen) — a do Bob é memoizada e não re-renderiza.
    expect(getRenderCount('overviewRow')).toBe(1)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    mockApi()
    const { container } = render(<CoachPanel />)
    await screen.findByRole('button', { name: 'Visão do time' })
    expect((await axe(container)).violations).toEqual([])
  })
})
