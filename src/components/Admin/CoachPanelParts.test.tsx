import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TopHandsPanel, HandDetailCard, PlayerQuickSummary } from './CoachPanel'
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
})
