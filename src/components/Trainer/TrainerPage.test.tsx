import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TrainerPage } from './TrainerPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import { getRenderCount, resetRenderCount } from '../../test/renderCount'
import type { Range } from '../../types'

const RANGE: Range = { id: 1, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 8 }

afterEach(() => {
  useStore.setState({ activeDrillRange: null, activeHand: undefined })
})

describe('TrainerPage', () => {
  it('mostra a seleção de ranges (Drill) sem treino ativo', () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null })
    render(<TrainerPage />)
    expect(screen.getByText('Drill')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /BTN/ })).toBeInTheDocument()
  })

  it('estado vazio sem ranges', () => {
    useStore.setState({ ranges: [], activeDrillRange: null })
    render(<TrainerPage />)
    expect(screen.getByText('Nenhum range criado.')).toBeInTheDocument()
  })

  it('CONTINUAR sem range selecionado mostra aviso inline (não alert)', () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [] })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione pelo menos um range.')
  })

  it('renderiza o drill ativo com o botão FOLD', () => {
    useStore.setState({
      ranges: [RANGE],
      activeDrillRange: RANGE,
      activeDrillStackRange: '',
      activeDrillStackGridIdx: 0,
      activeHand: 'AA',
      currentHandSuits: ['s', 'h'],
      currentScenario: {},
      currentRng: 50,
      currentHeroRaiseSize: 0,
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
    })
    render(<TrainerPage />)
    expect(screen.getByRole('button', { name: /FOLD/ })).toBeInTheDocument()
  })

  it('responder a ação errada mostra feedback de Blunder', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      useRngForFrequency: false, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /FOLD/ }))
    expect(screen.getByText(/Blunder/)).toBeInTheDocument()
  })

  it('responder a ação principal mostra acerto', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 2.5, currentScenario: {},
      useRngForFrequency: false, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /RAISE/ }))
    expect(screen.getByText(/Raise!/)).toBeInTheDocument()
  })

  it('atalho de teclado F responde Fold (Blunder)', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      useRngForFrequency: false, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.keyDown(window, { key: 'f' })
    expect(screen.getByText(/Blunder/)).toBeInTheDocument()
  })

  it('"Ver Range" abre o diálogo e registra a consulta', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver Range' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useStore.getState().sessionStats.consults).toBe(1)
  })

  it('Esc fecha o diálogo "Ver Range"', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver Range' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('auto-advance ("2s") chama nextDrillHand após 2s da resposta', () => {
    vi.useFakeTimers()
    const nextDrillHand = vi.fn(() => true)
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
      nextDrillHand,
    })
    try {
      render(<TrainerPage />)
      fireEvent.click(screen.getByRole('button', { name: '2s' }))
      fireEvent.click(screen.getByRole('button', { name: /FOLD/ }))
      expect(nextDrillHand).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(2000) })
      expect(nextDrillHand).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('"Encerrar e ver resumo" abre o resumo com precisão e severidade', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: { 1: { KK: { c: 8, t: 10 } } }, handPerformance: {},
      selectedDrillRangeIds: [1],
      sessionStats: { hands: 10, correct: 8, errors: 2, consults: 1 },
      sessionSeverity: { grave: 1, impreciso: 1 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e ver resumo' }))
    expect(screen.getByText('Resumo do Treino')).toBeInTheDocument()
    expect(screen.getByText('Blunders:')).toBeInTheDocument()
    expect(screen.getByText('Imprecisos:')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('clicar em HISTÓRICO abre o modal de histórico de treino', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {}, trainingHistory: [],
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /HISTÓRICO/ }))
    expect(screen.getByText('Histórico de Treino')).toBeInTheDocument()
  })

  it('alternar auto-advance ("2s") não re-renderiza a sidebar de histórico (memo)', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
    })
    render(<TrainerPage />)
    resetRenderCount('historySidebar')
    fireEvent.click(screen.getByRole('button', { name: '2s' }))
    fireEvent.click(screen.getByRole('button', { name: '2s' }))
    expect(getRenderCount('historySidebar')).toBe(0)
  })

  it('não tem violações de acessibilidade na seleção de ranges (axe)', async () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null })
    const { container } = render(<TrainerPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
