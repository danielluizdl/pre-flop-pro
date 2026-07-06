import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TopHandsPanel, HandDetailCard, PlayerQuickSummary, AdminView } from './CoachPanel'
import type { GridCell } from './RangeHeatGrid'

const cell = (over: Partial<GridCell>): GridCell => ({
  hand: 'AA', total: 10, correct: 9, accuracy: 90, graves: 0, consults: 0,
  correctAction: 'Raise', topWrong: null, ...over,
})

describe('TopHandsPanel', () => {
  const cells: GridCell[] = [
    cell({ hand: 'KK', total: 8, correct: 2, accuracy: 25, graves: 3, consults: 1, topWrong: { action: 'Call', n: 3 } }),
    cell({ hand: 'AA', total: 10, correct: 9, accuracy: 90, consults: 5 }),
    cell({ hand: '72o', total: 2, correct: 0, accuracy: 0 }),
  ]

  it('aba de erros lista mãos com total >= 3 ordenadas por precisão', () => {
    render(<TopHandsPanel cells={cells} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('KK')).toBeInTheDocument()
    // 72o tem total < 3 → não entra na lista de erros
    expect(screen.queryByText('72o')).not.toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('troca para a aba de consultas e mostra as mais consultadas', () => {
    render(<TopHandsPanel cells={cells} selected={null} onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Top 20 consultas' }))
    expect(screen.getByText('5x')).toBeInTheDocument()
  })

  it('clicar numa mão chama onSelect', () => {
    const onSelect = vi.fn()
    render(<TopHandsPanel cells={cells} selected={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('KK'))
    expect(onSelect).toHaveBeenCalledWith('KK')
  })

  it('voltar para a aba de erros restaura a lista de erros', () => {
    render(<TopHandsPanel cells={cells} selected={null} onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Top 20 consultas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Top 20 erros' }))
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('estado vazio quando não há dados', () => {
    render(<TopHandsPanel cells={[]} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('Sem dados.')).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<TopHandsPanel cells={cells} selected="KK" onSelect={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})

describe('HandDetailCard', () => {
  it('mostra precisão, contadores e ações da mão', () => {
    render(<HandDetailCard cell={cell({ hand: 'QQ', total: 12, correct: 10, accuracy: 83, graves: 1, consults: 2, correctAction: 'Raise', topWrong: { action: 'Call', n: 2 } })} />)
    expect(screen.getByText('QQ')).toBeInTheDocument()
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.getByText(/Correto: Raise/)).toBeInTheDocument()
    expect(screen.getByText(/Call \(2x\)/)).toBeInTheDocument()
  })

  it('renderiza a barra "como o time jogou" quando há dados de played', () => {
    render(<HandDetailCard cell={cell({ played: { fold: 10, call: 0, raise: 90, allin: 0, extra: 0 } })} />)
    expect(screen.getByText('Como o time jogou esta mão')).toBeInTheDocument()
    expect(screen.getByText('Raise 90%')).toBeInTheDocument()
  })

  it('não mostra a barra "como o time jogou" quando o total jogado é zero', () => {
    render(<HandDetailCard cell={cell({ played: { fold: 0, call: 0, raise: 0, allin: 0, extra: 0 } })} />)
    expect(screen.queryByText('Como o time jogou esta mão')).not.toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<HandDetailCard cell={cell({})} />)
    expect((await axe(container)).violations).toEqual([])
  })
})

describe('PlayerQuickSummary', () => {
  afterEach(() => vi.restoreAllMocks())

  function mockRows(rows: unknown[]) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({ rows }) } as unknown as Response)
  }

  it('mostra as três colunas com os ranges do jogador', async () => {
    mockRows([
      { rangeId: 1, rangeName: 'BTN RFI', hands: 120, accuracy: 70, graves: 5, imprecisos: 2, consults: 4, players: 1 },
      { rangeId: 2, rangeName: 'CO RFI', hands: 40, accuracy: 55, graves: 8, imprecisos: 3, consults: 9, players: 1 },
    ])
    render(<PlayerQuickSummary userId={1} days={30} from={null} to={null} token="tok" />)
    expect(await screen.findByText('Mais treinados')).toBeInTheDocument()
    expect(screen.getByText('Onde mais erra')).toBeInTheDocument()
    expect(screen.getByText('Mais consultados')).toBeInTheDocument()
    expect(screen.getByText('120 mãos')).toBeInTheDocument()
  })

  it('estado vazio sem dados de range', async () => {
    mockRows([])
    render(<PlayerQuickSummary userId={1} days={null} from={null} to={null} token="tok" />)
    expect(await screen.findByText('Sem dados de range para este jogador.')).toBeInTheDocument()
  })

  it('não mostra mais o botão de resetar senha (movido para Funcionalidades de Admin)', async () => {
    mockRows([{ rangeId: 1, rangeName: 'BTN RFI', hands: 120, accuracy: 70, graves: 5, imprecisos: 2, consults: 4, players: 1 }])
    render(<PlayerQuickSummary userId={1} days={7} from={null} to={null} token="tok" />)
    await screen.findByText('Mais treinados')
    expect(screen.queryByRole('button', { name: 'Resetar senha' })).not.toBeInTheDocument()
  })
})

describe('AdminView', () => {
  afterEach(() => vi.restoreAllMocks())

  const users = [
    { id: 1, username: 'jogador1', name: 'Jogador Um', email: 'j1@example.com', created_at: 1700000000, total_hands: 100, correct_hands: 80 },
    { id: 2, username: 'jogador2', name: 'Jogador Dois', email: '', created_at: 1700000100, total_hands: 0, correct_hands: null },
  ]

  function mockUsers(list = users) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: list }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
  }

  it('lista as contas com mãos e precisão', async () => {
    mockUsers()
    render(<AdminView token="tok" />)
    expect(await screen.findByText('Jogador Um')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Jogador Dois')).toBeInTheDocument()
  })

  it('busca filtra por nome/usuário/e-mail', async () => {
    mockUsers()
    render(<AdminView token="tok" />)
    await screen.findByText('Jogador Um')
    fireEvent.change(screen.getByPlaceholderText('Buscar jogador…'), { target: { value: 'dois' } })
    expect(screen.queryByText('Jogador Um')).not.toBeInTheDocument()
    expect(screen.getByText('Jogador Dois')).toBeInTheDocument()
  })

  it('criar conta chama o endpoint e mostra a senha temporária', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/admin/create-user')) {
        expect(JSON.parse(String(init?.body))).toEqual({ username: 'novojogador', name: 'Novo', email: '' })
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, tempPassword: 'abc123' }) } as unknown as Response)
      }
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
    render(<AdminView token="tok" />)
    await screen.findByText('Jogador Um')
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar conta' }))
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'novojogador' } })
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Novo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('abc123')).toBeInTheDocument()
    expect(screen.getByText(/Conta "novojogador" criada/)).toBeInTheDocument()
  })

  it('clicar numa conta expande as ações (editar/resetar/excluir)', async () => {
    mockUsers()
    render(<AdminView token="tok" />)
    const row = await screen.findByText('Jogador Um')
    expect(screen.queryByRole('button', { name: 'Resetar senha' })).not.toBeInTheDocument()
    fireEvent.click(row)
    expect(await screen.findByRole('button', { name: 'Resetar senha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar dados' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
  })

  it('resetar senha pede confirmação no modal e mostra a senha temporária', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/admin/reset-password')) {
        expect(JSON.parse(String(init?.body))).toEqual({ userId: 1 })
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, tempPassword: 'reset999' }) } as unknown as Response)
      }
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
    render(<AdminView token="tok" />)
    fireEvent.click(await screen.findByText('Jogador Um'))
    fireEvent.click(await screen.findByRole('button', { name: 'Resetar senha' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Resetar senha?')).toBeInTheDocument()
    expect(screen.getByText(/deixará de funcionar imediatamente/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Resetar senha' })[1])
    expect(await screen.findByText('reset999')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelar no modal não chama o endpoint de reset', async () => {
    const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
    vi.stubGlobal('fetch', fetchSpy)
    render(<AdminView token="tok" />)
    fireEvent.click(await screen.findByText('Jogador Um'))
    fireEvent.click(await screen.findByRole('button', { name: 'Resetar senha' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.every(c => !String(c[0]).includes('reset-password'))).toBe(true)
  })

  it('editar dados mostra o diff no modal e salva', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/admin/update-user')) {
        expect(JSON.parse(String(init?.body))).toEqual({ userId: 1, name: 'Jogador Editado', email: 'j1@example.com' })
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as unknown as Response)
      }
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
    render(<AdminView token="tok" />)
    fireEvent.click(await screen.findByText('Jogador Um'))
    fireEvent.click(await screen.findByRole('button', { name: 'Editar dados' }))
    const nameInput = screen.getByLabelText('Nome')
    fireEvent.change(nameInput, { target: { value: 'Jogador Editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Salvar alterações?')).toBeInTheDocument()
    expect(screen.getAllByText('Jogador Um').length).toBeGreaterThan(0)
    expect(screen.getByText('Jogador Editado')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar alterações' })[1])
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText('Jogador Editado').length).toBeGreaterThan(0)
  })

  it('excluir conta pede confirmação no modal e remove da lista', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/admin/delete-user')) {
        expect(JSON.parse(String(init?.body))).toEqual({ userId: 1 })
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as unknown as Response)
      }
      if (url.includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
    render(<AdminView token="tok" />)
    fireEvent.click(await screen.findByText('Jogador Um'))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Excluir conta?')).toBeInTheDocument()
    expect(screen.getByText(/serão apagados permanentemente/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1])
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByText('Jogador Um')).not.toBeInTheDocument()
  })

  it('cancelar no modal de exclusão não chama o endpoint', async () => {
    const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response)
    })
    vi.stubGlobal('fetch', fetchSpy)
    render(<AdminView token="tok" />)
    fireEvent.click(await screen.findByText('Jogador Um'))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(fetchSpy.mock.calls.every(c => !String(c[0]).includes('delete-user'))).toBe(true)
  })

  it('gerar código de convite chama o endpoint e mostra o código', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/create-invite-code')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, code: 'ABCD1234' }) } as unknown as Response)
      }
      if (url.includes('/admin/invite-codes')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ codes: [] }) } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
    })
    render(<AdminView token="tok" />)
    await screen.findByText('Jogador Um')
    fireEvent.click(screen.getByText('Códigos de convite'))
    fireEvent.click(await screen.findByRole('button', { name: '+ Gerar código' }))
    expect(await screen.findByText('ABCD1234')).toBeInTheDocument()
  })

  it('lista os códigos de convite com o status de uso', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/invite-codes')) {
        return Promise.resolve({
          ok: true, json: () => Promise.resolve({
            codes: [
              { id: 1, code: 'AAAA1111', created_at: 1700000000, used_at: 1700000500, used_by_id: 1, used_by_username: 'jogador1', used_by_name: 'Jogador Um' },
              { id: 2, code: 'BBBB2222', created_at: 1700000100, used_at: null, used_by_id: null, used_by_username: null, used_by_name: null },
            ],
          }),
        } as unknown as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ users }) } as unknown as Response)
    })
    render(<AdminView token="tok" />)
    await screen.findByText('Jogador Um')
    fireEvent.click(screen.getByText('Códigos de convite'))
    expect(await screen.findByText('AAAA1111')).toBeInTheDocument()
    expect(screen.getByText('Usado por Jogador Um')).toBeInTheDocument()
    expect(screen.getByText('BBBB2222')).toBeInTheDocument()
    expect(screen.getByText('Não utilizado')).toBeInTheDocument()
  })

  it('modal de confirmação (Excluir) não tem violações de acessibilidade (axe)', async () => {
    mockUsers()
    const { container } = render(<AdminView token="tok" />)
    fireEvent.click(await screen.findByText('Jogador Um'))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    await screen.findByRole('dialog')
    expect((await axe(container)).violations).toEqual([])
  })
})
