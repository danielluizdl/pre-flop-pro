import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { StatsPage } from './StatsPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { TrainingSession, Range } from '../../types'

const SESSION: TrainingSession = {
  id: 1, timestamp: Date.now(), rangeNames: ['BTN RFI'], tableSize: 8,
  hands: 50, correct: 44, errors: 6, consults: 2, durationSeconds: 300,
}

function rangeNamed(name: string, id: number, extra: Partial<Range> = {}): Range {
  return { id, name, positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 6, ...extra }
}

describe('StatsPage', () => {
  it('mostra o cabeçalho e o estado vazio sem sessões', () => {
    useStore.setState({ trainingHistory: [], currentUser: null })
    render(<StatsPage />)
    expect(screen.getByText('Histórico de Treinos')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma sessão registrada ainda.')).toBeInTheDocument()
  })

  it('mostra os totais quando há histórico de sessões', () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    render(<StatsPage />)
    expect(screen.getByText('Precisão Global')).toBeInTheDocument()
    expect(screen.getByText('Mãos Totais')).toBeInTheDocument()
  })

  it('alterna para a aba Desempenho Global sem quebrar', () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Desempenho Global' }))
    expect(screen.queryByText('Nenhuma sessão registrada ainda.')).not.toBeInTheDocument()
  })

  it('exibe a precisão global calculada (88%)', () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    render(<StatsPage />)
    expect(screen.getAllByText('88%').length).toBeGreaterThan(0)
  })

  it('abre o detalhe da sessão pelo botão Ver detalhes e volta', () => {
    useStore.setState({ trainingHistory: [SESSION], ranges: [], currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    expect(screen.getByRole('button', { name: /Voltar/ })).toBeInTheDocument()
    expect(screen.getByText('Ranges desta sessão não encontrados.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(screen.getByText('Histórico de Sessões')).toBeInTheDocument()
  })

  it('detalhe da sessão: expande o range e mostra precisão por mão + toggle de visão', () => {
    const range = rangeNamed('BTN RFI', 42)
    const withPerf: TrainingSession = { ...SESSION, id: 2, handPerf: { 42: { AA: { c: 8, t: 10 } } } }
    useStore.setState({ trainingHistory: [withPerf], ranges: [range], currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    // acordeão do range da sessão
    fireEvent.click(screen.getByRole('button', { name: /BTN RFI/ }))
    // 80% (8/10) aparece na linha do range
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0)
    // alterna para a visão de ações
    fireEvent.click(screen.getByRole('button', { name: 'Ver Range' }))
    expect(screen.getByRole('button', { name: 'Ver Range' })).toBeInTheDocument()
  })

  it('detalhe da sessão: range multi-stack mostra botões de stack', () => {
    const g = makeEmptyGrid()
    const range = rangeNamed('SB 3bet', 7, {
      stackGrids: [
        { stackRange: '0-40', grid: g },
        { stackRange: '40-100', grid: g },
      ],
    })
    const withPerf: TrainingSession = { ...SESSION, id: 3, rangeNames: ['SB 3bet'], handPerf: { 7: { AA: { c: 1, t: 1 } } } }
    useStore.setState({ trainingHistory: [withPerf], ranges: [range], currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    fireEvent.click(screen.getByRole('button', { name: /SB 3bet/ }))
    expect(screen.getByRole('button', { name: '0-40' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '40-100' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '40-100' }))
    expect(screen.getByRole('button', { name: '40-100' })).toBeInTheDocument()
  })

  it('aba Desempenho Global: agrupa ranges treinados por posição e expande', () => {
    const range = rangeNamed('BTN RFI', 42)
    useStore.setState({ trainingHistory: [SESSION], ranges: [range], handPerformance: { 42: { AA: { c: 8, t: 10 } } }, currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Desempenho Global' }))
    // grupo por posição BTN
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
  })

  it('Desempenho Global: abrir range multi-stack mostra seletor de stack e toggle de visão', () => {
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range = rangeNamed('BTN multi', 9, {
      stackGrids: [
        { stackRange: '<=40', grid: g },
        { stackRange: '>40', grid: g },
      ],
    })
    useStore.setState({
      trainingHistory: [SESSION], ranges: [range], currentUser: null,
      handPerformance: {
        9: { AA: { c: 8, t: 10 } },
        '9|||<=40': { AA: { c: 4, t: 5 } },
        '9|||>40': { AA: { c: 4, t: 5 } },
      },
    })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Desempenho Global' }))
    fireEvent.click(screen.getByRole('button', { name: /^BTN/ }))
    // abre o acordeão do range
    fireEvent.click(screen.getByRole('button', { name: /BTN multi/ }))
    // seletor de stack presente e alterna
    fireEvent.click(screen.getByRole('button', { name: '>40' }))
    // toggle da visão de ações
    fireEvent.click(screen.getByRole('button', { name: 'Ver Range' }))
    expect(screen.getByRole('button', { name: 'Ver Range' })).toBeInTheDocument()
  })

  it('botão Exportar CSV baixa o arquivo da sessão', () => {
    const range = rangeNamed('BTN RFI', 42)
    const withPerf: TrainingSession = { ...SESSION, id: 4, handPerf: { 42: { AA: { c: 8, t: 10 } } } }
    useStore.setState({ trainingHistory: [withPerf], ranges: [range], currentUser: null })
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    expect(createSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore(); revokeSpy.mockRestore(); clickSpy.mockRestore()
  })

  it('aba Range Check: estado vazio sem sessões do modo', () => {
    useStore.setState({ trainingHistory: [SESSION], buildHistory: [], currentUser: null })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    expect(screen.getByText('Nenhuma sessão ainda.')).toBeInTheDocument()
  })

  it('aba Range Check: lista sessões do modo e expande os rounds com tentativa', () => {
    useStore.setState({
      trainingHistory: [], currentUser: null,
      buildHistory: [{
        id: 10, timestamp: Date.now(), rangeNames: ['BTN RFI'], avgScore: 91.5,
        rounds: [
          { label: 'BTN RFI', score: 83, attempt: 1 },
          { label: 'BTN RFI', score: 100, attempt: 2 },
        ],
      }],
    })
    render(<StatsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Range Check' }))
    expect(screen.getByText('91.5')).toBeInTheDocument()
    expect(screen.getByText('2 rounds')).toBeInTheDocument()
    fireEvent.click(screen.getByText('91.5'))
    expect(screen.getByText('83/100')).toBeInTheDocument()
    expect(screen.getByText('100/100')).toBeInTheDocument()
    expect(screen.getByText('Tentativa 2')).toBeInTheDocument()
  })

  it('só mostra a aba de nuvem quando há usuário logado', () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    const { rerender } = render(<StatsPage />)
    expect(screen.queryByRole('button', { name: 'Meus dados na nuvem' })).not.toBeInTheDocument()
    useStore.setState({ currentUser: { id: 1, username: 'p1', name: 'P1', email: '', role: 'player', firstLogin: false, tier: '', turma: null } })
    rerender(<StatsPage />)
    expect(screen.getByRole('button', { name: 'Meus dados na nuvem' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    useStore.setState({ trainingHistory: [SESSION], currentUser: null })
    const { container } = render(<StatsPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
