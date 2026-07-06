import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import CoachPanel from './CoachPanel'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { getRenderCount, resetRenderCount } from '../../test/renderCount'
import { invalidateAnalyticsCache } from '../../utils/analyticsCache'
import type { Range } from '../../types'

function mockApi() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const data = url.includes('/admin/users')
      ? { users: [] }
      : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
  })
  useStore.setState({ authToken: 'tok' })
}

afterEach(() => { vi.restoreAllMocks(); invalidateAnalyticsCache() })

describe('CoachPanel', () => {
  it('renderiza as abas, o botão de publicar e os filtros do time', async () => {
    mockApi()
    render(<CoachPanel />)
    expect(await screen.findByRole('button', { name: 'Drill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Range Check' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Publicar ranges para o time/ })).toBeInTheDocument()
    expect(screen.getByText('Todos os jogadores')).toBeInTheDocument()
    expect(screen.getByText('Todos os ranges')).toBeInTheDocument()
  })

  it('header de filtros mostra os rótulos Período/Jogadores/Ranges', async () => {
    mockApi()
    render(<CoachPanel />)
    await screen.findByRole('button', { name: 'Drill' })
    expect(screen.getByText('Período:')).toBeInTheDocument()
    expect(screen.getByText('Jogadores:')).toBeInTheDocument()
    expect(screen.getByText('Ranges:')).toBeInTheDocument()
  })

  it('mostra "Por range" como primeira seção colapsável', async () => {
    mockApi()
    render(<CoachPanel />)
    expect(await screen.findByText('Por range')).toBeInTheDocument()
    expect(screen.getByText('Resumo individual por jogador')).toBeInTheDocument()
    expect(screen.getByText('Maiores leaks')).toBeInTheDocument()
    expect(screen.queryByText('Hotspots de consulta')).not.toBeInTheDocument()
  })

  it('período Custom revela dois campos de data', async () => {
    mockApi()
    const { container } = render(<CoachPanel />)
    await screen.findByRole('button', { name: 'Drill' })
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } })
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2)
  })

  it('troca para a aba "Range Check" com as três seções e filtros', async () => {
    mockApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Range Check' }))
    expect(await screen.findByText('Por jogador')).toBeInTheDocument()
    expect(screen.getByText('Por range')).toBeInTheDocument()
    expect(screen.getByText('Tentativas recentes')).toBeInTheDocument()
    expect(screen.getByText('Todos os jogadores')).toBeInTheDocument()
  })

  it('troca para a aba "Funcionalidades de Admin" e lista as contas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('/admin/users')
        ? { users: [{ id: 1, username: 'jogador1', name: 'Jogador Um', email: 'j1@x.com', created_at: 1700000000, total_hands: 10, correct_hands: 8 }] }
        : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Funcionalidades de Admin' }))
    expect(await screen.findByText('Jogador Um')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Adicionar conta' })).toBeInTheDocument()
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

  it('o filtro de jogadores busca por nome no dropdown', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('/admin/users')
        ? { users: [
            { id: 1, username: 'alice', name: 'Alice', email: '', created_at: 0, total_hands: 0, correct_hands: 0 },
            { id: 2, username: 'bob', name: 'Bob', email: '', created_at: 0, total_hands: 0, correct_hands: 0 },
          ] }
        : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar jogadores' }))
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar jogador' }), { target: { value: 'ali' } })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('o dropdown de jogadores fecha por clique fora e por Escape', async () => {
    mockApi()
    render(<CoachPanel />)
    const btn = await screen.findByRole('button', { name: 'Filtrar jogadores' })
    // clique fora fecha
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    fireEvent.mouseDown(document.body)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    // Escape fecha
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Buscar jogador' }), { key: 'Escape' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('o dropdown de range fecha por clique fora', async () => {
    mockApi()
    render(<CoachPanel />)
    const btn = await screen.findByRole('button', { name: 'Filtrar por range' })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    fireEvent.mouseDown(document.body)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('seção "Por range" mostra erro e "Tentar novamente" recarrega', async () => {
    let failByRange = true
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=by-range') && failByRange) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    expect(await screen.findByText('Erro ao carregar')).toBeInTheDocument()
    failByRange = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Sem dados.')).toBeInTheDocument()
  })

  it('navegar por setas rola a opção ativa para dentro da lista', async () => {
    mockApi()
    const ranges: Range[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1, name: `BTN RFI ${i + 1}`, positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8,
    }))
    useStore.setState({ authToken: 'tok', ranges })
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar por range' }))
    const search = screen.getByRole('combobox', { name: 'Buscar range' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(spy).toHaveBeenCalled()
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

  it('o filtro de range busca por nome e restringe a lista', async () => {
    mockApi()
    const ranges: Range[] = [
      { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 },
      { id: 2, name: 'CO RFI', positions: ['CO'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 },
    ]
    useStore.setState({ authToken: 'tok', ranges })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar por range' }))
    expect(screen.getByRole('option', { name: 'BTN RFI' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar range' }), { target: { value: 'CO' } })
    expect(screen.queryByRole('option', { name: 'BTN RFI' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'CO RFI' })).toBeInTheDocument()
  })

  it('o filtro de range seleciona por clique e "Todos os ranges" reseta', async () => {
    mockApi()
    const range: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }
    useStore.setState({ authToken: 'tok', ranges: [range] })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar por range' }))
    fireEvent.click(screen.getByRole('option', { name: 'BTN RFI' }))
    expect(screen.getByRole('button', { name: 'Filtrar por range' })).toHaveTextContent('BTN RFI')
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por range' }))
    fireEvent.click(screen.getByRole('option', { name: 'Todos os ranges' }))
    expect(screen.getByRole('button', { name: 'Filtrar por range' })).toHaveTextContent('Todos os ranges')
  })

  it('o filtro de range navega para baixo e volta com ArrowUp', async () => {
    mockApi()
    const ranges: Range[] = [
      { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 },
      { id: 2, name: 'CO RFI', positions: ['CO'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 },
    ]
    useStore.setState({ authToken: 'tok', ranges })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar por range' }))
    const search = screen.getByRole('combobox', { name: 'Buscar range' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Filtrar por range' })).toHaveTextContent('BTN RFI')
  })

  it('o filtro de jogadores volta a "Todos os jogadores" e desmarca o selecionado', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      const data = url.includes('/admin/users')
        ? { users: [{ id: 1, username: 'alice', name: 'Alice', email: '', created_at: 0, total_hands: 0, correct_hands: 0 }] }
        : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar jogadores' }))
    const alice = await screen.findByRole('checkbox')
    fireEvent.click(alice)
    expect(alice).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Todos os jogadores' }))
    expect(alice).not.toBeChecked()
  })

  it('abrir o resumo de um jogador re-renderiza só a linha afetada (memo)', async () => {
    const orow = (userId: number, name: string) => ({
      userId, username: name.toLowerCase(), name, hands: 100, accuracy: 70,
      graves: 5, imprecisos: 2, consults: 3, sessions: 4, durationSeconds: 3600, lastActivity: 0,
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      let data: unknown = { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      if (url.includes('/admin/users')) data = { users: [] }
      else if (url.includes('view=team-overview')) data = { rows: [orow(1, 'Alice'), orow(2, 'Bob')], team: null }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Resumo individual por jogador/ }))
    const alice = await screen.findByText('Alice')
    resetRenderCount('overviewRow')
    fireEvent.click(alice)
    // Só a linha da Alice muda (isOpen) — a do Bob é memoizada e não re-renderiza.
    expect(getRenderCount('overviewRow')).toBe(1)
  })

  it('erro de seção do coach mostra "Tentar novamente" e recarrega', async () => {
    let byRangeCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      if (url.includes('view=by-range')) {
        byRangeCalls++
        if (byRangeCalls === 1) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as unknown as Response)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [{ rangeId: 1, rangeName: 'BTN RFI', hands: 50, accuracy: 70, graves: 3, imprecisos: 1, consults: 2, players: 1 }] }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    fireEvent.click(retry)
    expect(await screen.findByText('BTN RFI')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    mockApi()
    const { container } = render(<CoachPanel />)
    await screen.findByRole('button', { name: 'Drill' })
    expect((await axe(container)).violations).toEqual([])
  })

  // --- Fatia: filtros — período custom e seleção de jogadores ---

  it('período Custom com as duas datas dispara fetch com from/to em vez de days', async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      urls.push(String(input))
      const data = String(input).includes('/admin/users')
        ? { users: [] }
        : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    const { container } = render(<CoachPanel />)
    await screen.findByRole('button', { name: 'Drill' })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } })
    const dates = container.querySelectorAll('input[type="date"]')
    urls.length = 0
    fireEvent.change(dates[0], { target: { value: '2026-06-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-06-30' } })
    await screen.findByRole('button', { name: 'Drill' })
    const analytics = urls.filter(u => u.includes('/admin/analytics'))
    expect(analytics.length).toBeGreaterThan(0)
    expect(analytics.every(u => u.includes('from=') && u.includes('to=') && !u.includes('days='))).toBe(true)
  })

  it('marcar um jogador no MultiPlayerSelect refaz o fetch com playerIds', async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      urls.push(String(input))
      const data = String(input).includes('/admin/users')
        ? { users: [{ id: 7, username: 'ana01', name: 'Ana' }] }
        : { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar jogadores' }))
    urls.length = 0
    fireEvent.click(await screen.findByText('Ana'))
    await screen.findByRole('button', { name: 'Drill' })
    const analytics = urls.filter(u => u.includes('/admin/analytics'))
    expect(analytics.length).toBeGreaterThan(0)
    expect(analytics.every(u => u.includes('playerIds=7'))).toBe(true)
  })

  // --- Fatia: publicar ranges para o time (D1) ---

  it('publicar para o time: confirma, chama publishTeamRanges e mostra sucesso', async () => {
    mockApi()
    const publishTeamRanges = vi.fn().mockResolvedValue({ ok: true, count: 12, version: 7 })
    useStore.setState({ publishTeamRanges, ranges: [] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Publicar ranges para o time/ }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(publishTeamRanges).toHaveBeenCalled()
    expect(await screen.findByText('Publicado: 12 range(s) · versão 7')).toBeInTheDocument()
  })

  it('publicar para o time: recusar a confirmação não chama a ação', async () => {
    mockApi()
    const publishTeamRanges = vi.fn()
    useStore.setState({ publishTeamRanges, ranges: [] })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Publicar ranges para o time/ }))
    expect(publishTeamRanges).not.toHaveBeenCalled()
  })

  it('publicar para o time: erro mostra a mensagem retornada', async () => {
    mockApi()
    const publishTeamRanges = vi.fn().mockResolvedValue({ ok: false, error: 'sem permissão' })
    useStore.setState({ publishTeamRanges, ranges: [] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Publicar ranges para o time/ }))
    expect(await screen.findByText('sem permissão')).toBeInTheDocument()
  })

  // --- Fatia: aba "Range Check" (RecallView) ---

  function mockRecallApi() {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      let data: unknown = { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      if (url.includes('/admin/users')) data = { users: [] }
      else if (url.includes('view=build-overview')) {
        data = {
          rows: [
            { userId: 1, username: 'ana01', name: 'Ana', attempts: 12, avgScore: 84.5, bestScore: 97.2, ranges: 3, lastActivity: 1750000000 },
            { userId: 2, username: 'beto02', name: 'Beto', attempts: 0, avgScore: 0, bestScore: 0, ranges: 0, lastActivity: 0 },
          ],
          team: { attempts: 12, avgScore: 84.5, bestScore: 97.2, ranges: 3, lastActivity: 1750000000 },
        }
      } else if (url.includes('view=build-by-range')) {
        data = { rows: [{ rangeId: 5, rangeName: 'BTN RFI', attempts: 12, avgScore: 84.5, bestScore: 97.2, players: 1, lastActivity: 1750000000 }] }
      } else if (url.includes('view=build-events')) {
        data = { rows: [{ userId: 1, playerName: 'Ana', rangeId: 5, rangeName: 'BTN RFI', stackRange: '40bb+', score: 91.3, attempt: 2, createdAt: 1750000000 }] }
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
  }

  it('Range Check: tabela por jogador oculta quem não tentou e mostra a linha do time', async () => {
    mockRecallApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Range Check' }))
    expect((await screen.findAllByText('Ana')).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Beto')).not.toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getAllByText('84.5').length).toBeGreaterThanOrEqual(2)
  })

  it('Range Check: tentativas recentes mostram stack, nº da tentativa e nota', async () => {
    mockRecallApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Range Check' }))
    expect(await screen.findByText('40bb+')).toBeInTheDocument()
    expect(screen.getByText('91.3')).toBeInTheDocument()
    expect(screen.getByText('Tentativa')).toBeInTheDocument()
    expect(screen.getAllByText('BTN RFI').length).toBeGreaterThanOrEqual(2)
  })

  it('Range Check: fail-open (tabela ausente no D1) mostra "Sem dados." nas seções', async () => {
    mockApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Range Check' }))
    expect((await screen.findAllByText('Sem dados.')).length).toBe(3)
  })

  // --- Fatia: ordenação da tabela "Por range" ---

  function mockApiWithByRange() {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=by-range')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [
              { rangeId: 1, rangeName: 'BTN RFI', hands: 50, accuracy: 70, graves: 3, imprecisos: 1, consults: 2, players: 1 },
              { rangeId: 2, rangeName: 'CO RFI', hands: 100, accuracy: 80, graves: 1, imprecisos: 0, consults: 5, players: 2 },
            ],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
  }

  it('tabela Por range ordena por Mãos desc por padrão', async () => {
    mockApiWithByRange()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    const rows = await screen.findAllByRole('row')
    // header + 2 linhas de dados; CO RFI (100 mãos) deve vir antes de BTN RFI (50)
    const texts = rows.map(r => r.textContent ?? '')
    const coIdx = texts.findIndex(t => t.includes('CO RFI'))
    const btnIdx = texts.findIndex(t => t.includes('BTN RFI'))
    expect(coIdx).toBeLessThan(btnIdx)
  })

  it('clicar coluna Mãos inverte para asc (BTN RFI antes de CO RFI)', async () => {
    mockApiWithByRange()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    await screen.findByText('CO RFI')
    fireEvent.click(screen.getByRole('button', { name: /^Mãos/ }))
    const rows = screen.getAllByRole('row')
    const texts = rows.map(r => r.textContent ?? '')
    const btnIdx = texts.findIndex(t => t.includes('BTN RFI'))
    const coIdx = texts.findIndex(t => t.includes('CO RFI'))
    expect(btnIdx).toBeLessThan(coIdx)
  })

  it('clicar coluna Precisão muda a ordenação para accuracy desc', async () => {
    mockApiWithByRange()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    await screen.findByText('CO RFI')
    fireEvent.click(screen.getByRole('button', { name: /^Precisão/ }))
    const rows = screen.getAllByRole('row')
    const texts = rows.map(r => r.textContent ?? '')
    // CO RFI (80%) deve vir antes de BTN RFI (70%)
    const coIdx = texts.findIndex(t => t.includes('CO RFI'))
    const btnIdx = texts.findIndex(t => t.includes('BTN RFI'))
    expect(coIdx).toBeLessThan(btnIdx)
  })

  // --- Fatia: ordenação e agregado do "Resumo individual por jogador" ---

  const orow = (userId: number, name: string, hands: number, accuracy: number) => ({
    userId, username: name.toLowerCase(), name, hands, accuracy,
    graves: 2, imprecisos: 1, consults: 1, sessions: 3, durationSeconds: 1800, lastActivity: 0,
  })

  function mockApiWithOverview(team: Record<string, number> | null = null) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=team-overview')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rows: [orow(1, 'Alice', 50, 60), orow(2, 'Bob', 100, 90)], team }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
  }

  it('Resumo individual por jogador ordena por Mãos desc por padrão (Bob antes de Alice)', async () => {
    mockApiWithOverview()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Resumo individual por jogador/ }))
    await screen.findByText('Alice')
    const texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    expect(texts.findIndex(t => t.includes('Bob'))).toBeLessThan(texts.findIndex(t => t.includes('Alice')))
  })

  it('clicar coluna Precisão do Resumo individual por jogador ordena por accuracy desc', async () => {
    mockApiWithOverview()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Resumo individual por jogador/ }))
    await screen.findByText('Alice')
    fireEvent.click(screen.getByRole('button', { name: /^Precisão/ }))
    const texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // Bob (90%) antes de Alice (60%)
    expect(texts.findIndex(t => t.includes('Bob'))).toBeLessThan(texts.findIndex(t => t.includes('Alice')))
  })

  it('linha agregada TIME aparece quando a API devolve o total do time', async () => {
    mockApiWithOverview({ hands: 150, accuracy: 80, graves: 4, imprecisos: 2, consults: 2, durationSeconds: 3600, lastActivity: 0 })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Resumo individual por jogador/ }))
    expect(await screen.findByText('TIME')).toBeInTheDocument()
  })

  // --- Fatia: seções — erro e vazio ---

  function mockApiWithViewError(errorView: string) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes(`view=${errorView}`)) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
  }

  it('seção Consulta no drill mostra "Erro ao carregar" quando a API falha', async () => {
    mockApiWithViewError('consult-by-range')
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta no drill/ }))
    expect(await screen.findByText('Erro ao carregar')).toBeInTheDocument()
  })

  it('seção Leaks relativos mostra "Erro ao carregar" quando a API falha', async () => {
    mockApiWithViewError('player-ranges')
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Leaks relativos/ }))
    expect(await screen.findByText('Erro ao carregar')).toBeInTheDocument()
  })

  it('seção Maiores leaks mostra "Sem dados." quando retorna vazio', async () => {
    mockApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Maiores leaks/ }))
    expect(await screen.findByText('Sem dados.')).toBeInTheDocument()
  })

  it('seção Consulta no drill mostra "Sem dados." quando retorna vazio', async () => {
    mockApi()
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta no drill/ }))
    expect(await screen.findByText('Sem dados.')).toBeInTheDocument()
  })

  // --- Fatia: Leaks relativos com dados (z-score) ---

  it('Leaks relativos lista o jogador abaixo da média dos colegas com Δ e z', async () => {
    const pr = (userId: number, correct: number) => ({ userId, rangeId: 1, rangeName: 'BTN RFI', total: 100, correct })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=player-ranges')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [pr(1, 50), pr(2, 90), pr(3, 88)],
            users: [
              { id: 1, name: 'Carlos', username: 'carlos' },
              { id: 2, name: 'Alice', username: 'alice' },
              { id: 3, name: 'Bob', username: 'bob' },
            ],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Leaks relativos/ }))
    // Carlos (50%) está bem abaixo da média (76%) → aparece na tabela
    expect(await screen.findByText('Carlos')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    // Alice (90%) está acima da média → não aparece como leak relativo
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('Leaks relativos ordena por z asc (pior primeiro) por padrão e reordena ao clicar Jogador', async () => {
    const pr = (userId: number, correct: number) => ({ userId, rangeId: 1, rangeName: 'BTN RFI', total: 100, correct })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=player-ranges')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [pr(1, 40), pr(2, 50), pr(3, 95), pr(4, 90)],
            users: [
              { id: 1, name: 'Dave', username: 'dave' },
              { id: 2, name: 'Carlos', username: 'carlos' },
              { id: 3, name: 'Alice', username: 'alice' },
              { id: 4, name: 'Bob', username: 'bob' },
            ],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Leaks relativos/ }))
    await screen.findByText('Dave')
    let texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // Dave (40%, pior) antes de Carlos (50%) — z ascendente por padrão
    expect(texts.findIndex(t => t.includes('Dave'))).toBeLessThan(texts.findIndex(t => t.includes('Carlos')))
    fireEvent.click(screen.getByRole('button', { name: /Jogador/ }))
    texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // ordem alfabética: Carlos antes de Dave
    expect(texts.findIndex(t => t.includes('Carlos'))).toBeLessThan(texts.findIndex(t => t.includes('Dave')))
  })

  // --- Fatia: clicar linha Por range → carrega range-grid ---

  it('clicar numa linha da tabela Por range carrega a matriz 13×13', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=range-grid')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            cells: [
              { hand: 'AA', total: 20, correct: 16, graves: 2, consults: 1, correctAction: 'raise', topWrong: 'fold', played: { fold: 0, call: 0, raise: 20, allin: 0, extra: 0 } },
            ],
          }),
        } as unknown as Response)
      }
      if (url.includes('view=by-range')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [{ rangeId: 1, rangeName: 'BTN RFI', hands: 50, accuracy: 70, graves: 3, imprecisos: 1, consults: 2, players: 1 }],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    fireEvent.click(await screen.findByText('BTN RFI'))
    // Matriz carregada: título e TopHandsPanel (instrução de clique visível)
    expect(await screen.findByText(/Matriz do range/)).toBeInTheDocument()
    expect(await screen.findByText(/Top 20 erros/)).toBeInTheDocument()
  })

  it('matriz do range: renderiza Range real/jogado e clicar mão no Top 20 abre o detalhe', async () => {
    const cell = (hand: string, accuracy: number) => ({
      hand, total: 20, correct: 5, accuracy, graves: 8, consults: 2, correctAction: 'raise',
      topWrong: { action: 'Fold', n: 8 },
      played: { fold: 10, call: 0, raise: 10, allin: 0, extra: 0 },
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=range-grid')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ cells: [cell('AA', 25), cell('KK', 60)] }) } as unknown as Response)
      }
      if (url.includes('view=by-range')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rows: [{ rangeId: 1, rangeName: 'BTN RFI', hands: 50, accuracy: 70, graves: 3, imprecisos: 1, consults: 2, players: 1 }] }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    const grid = makeEmptyGrid()
    grid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    useStore.setState({
      authToken: 'tok',
      ranges: [{ id: 1, name: 'BTN RFI', positions: ['BTN'], grid, scenarios: [], tableSize: 6 } as Range],
    })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Por range/ }))
    fireEvent.click(await screen.findByText('BTN RFI'))
    expect(await screen.findByText('Range real (gabarito)')).toBeInTheDocument()
    expect(screen.getByText('Range jogado (time)')).toBeInTheDocument()
    // clicar a mão AA no Top 20 (botão com precisão 25%) abre o HandDetailCard no slot fixo
    fireEvent.click(await screen.findByRole('button', { name: /AA.*25%/ }))
    expect(await screen.findByText('Como o time jogou esta mão')).toBeInTheDocument()
  })

  // --- Fatia: Maiores leaks com dados ---

  it('seção Maiores leaks exibe linha de mão quando há dados', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=leaks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [{ hand: 'AKo', rangeName: 'BTN RFI', total: 30, accuracy: 55, accuracyLower: 48, graves: 5, imprecisos: 3, consults: 2, confidence: 'high', impact: 4.5 }],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Maiores leaks/ }))
    expect(await screen.findByText('AKo')).toBeInTheDocument()
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
  })

  it('Maiores leaks ordena por Impacto desc por padrão e reordena ao clicar Blunder', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=leaks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rows: [
              { hand: 'AKo', rangeName: 'BTN RFI', total: 30, correct: 10, accuracy: 33, graves: 2, imprecisos: 15 },
              { hand: 'QJs', rangeName: 'CO RFI', total: 30, correct: 20, accuracy: 67, graves: 9, imprecisos: 0 },
            ],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Maiores leaks/ }))
    await screen.findByText('AKo')
    let texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // AKo (impacto 10.1) antes de QJs (impacto 9.7) — default desc por Impacto
    expect(texts.findIndex(t => t.includes('AKo'))).toBeLessThan(texts.findIndex(t => t.includes('QJs')))
    fireEvent.click(screen.getByRole('button', { name: /Blunder/ }))
    texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // QJs tem mais blunders (9 vs 2) — inverte a ordem
    expect(texts.findIndex(t => t.includes('QJs'))).toBeLessThan(texts.findIndex(t => t.includes('AKo')))
  })

  // --- Fatia: Consulta no drill ---

  function mockViews(byView: Record<string, unknown>) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      const m = url.match(/view=([a-z-]+)/)
      const view = m?.[1] ?? ''
      const base = { rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }
      const data = byView[view] ? { ...base, ...(byView[view] as object) } : base
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })
  }

  const consultRows = [
    { rangeId: 1, rangeName: 'CO RFI', totalConsults: 30, totalPlayed: 200, rate: 15 },
    { rangeId: 2, rangeName: 'BTN RFI', totalConsults: 10, totalPlayed: 50, rate: 20 },
  ]

  it('Consulta no drill lista ranges com taxa de consulta, ordenado por % Consultas/Mão desc por padrão', async () => {
    mockViews({ 'consult-by-range': { rows: consultRows } })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta no drill/ }))
    await screen.findByText('CO RFI')
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    const texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // BTN RFI (20%) antes de CO RFI (15%)
    expect(texts.findIndex(t => t.includes('BTN RFI'))).toBeLessThan(texts.findIndex(t => t.includes('CO RFI')))
  })

  it('clicar cabeçalho "Mãos consultadas" reordena a tabela de Consulta no drill', async () => {
    mockViews({ 'consult-by-range': { rows: consultRows } })
    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta no drill/ }))
    await screen.findByText('CO RFI')
    fireEvent.click(screen.getByRole('button', { name: /Mãos consultadas/ }))
    const texts = screen.getAllByRole('row').map(r => r.textContent ?? '')
    // desc por mãos consultadas: CO RFI (20) antes de BTN RFI (4)
    expect(texts.findIndex(t => t.includes('CO RFI'))).toBeLessThan(texts.findIndex(t => t.includes('BTN RFI')))
  })

  it('clicar uma linha da Consulta no drill expande o detalhe por mão', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=consult-by-range-hand')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rows: [{ hand: 'QJs', consults: 7, played: 20, pct: 35 }] }),
        } as unknown as Response)
      }
      if (url.includes('view=consult-by-range')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [consultRows[0]] }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta no drill/ }))
    fireEvent.click(await screen.findByText('CO RFI'))
    expect(await screen.findByText('QJs')).toBeInTheDocument()
    expect(screen.getByText('Top 20 consultas')).toBeInTheDocument()
    expect(screen.getByText('20x jogada · 35% consulta')).toBeInTheDocument()
  })

  it('detalhe da Consulta no drill mostra só o Top 20, ordenado por vezes consultada desc', async () => {
    const hands = Array.from({ length: 25 }, (_, i) => ({
      hand: `H${i}`, consults: 25 - i, played: 100, pct: 25 - i,
    }))
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) } as unknown as Response)
      }
      if (url.includes('view=consult-by-range-hand')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: hands }) } as unknown as Response)
      }
      if (url.includes('view=consult-by-range')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [consultRows[0]] }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], team: null, cells: [], byHand: [], byAction: [], users: [] }) } as unknown as Response)
    })
    useStore.setState({ authToken: 'tok' })

    render(<CoachPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta no drill/ }))
    fireEvent.click(await screen.findByText('CO RFI'))
    // top 20 (mais consultada primeiro): H0 aparece, H24 (a menos consultada) fica de fora
    expect(await screen.findByText('H0')).toBeInTheDocument()
    expect(screen.queryByText('H24')).not.toBeInTheDocument()
  })
})
