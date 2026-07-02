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

  it('atalho de teclado V abre o "Ver Range" e registra consulta', () => {
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
    fireEvent.keyDown(window, { key: 'v' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useStore.getState().sessionStats.consults).toBe(1)
    fireEvent.keyDown(window, { key: 'v' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('atalho de teclado R responde Raise (acerto)', () => {
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
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByText(/Raise!/)).toBeInTheDocument()
  })

  it('RNG ligado: responder a ação da faixa correta é acerto', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 2.5, currentScenario: {},
      useRngForFrequency: true, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /RAISE/ }))
    expect(screen.getByText(/Raise!/)).toBeInTheDocument()
  })

  it('acceptAnyFreq: responder ação secundária com frequência > 0 é "Válido"', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 40, raise: 60, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 2.5, currentScenario: {},
      useRngForFrequency: false, acceptAnyFreq: true, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CALL/ }))
    expect(screen.getByText(/Válido/)).toBeInTheDocument()
  })

  it('range com customAction mostra o botão da ação extra', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 0, allin: 0, extra: 100 }
    const range: Range = { ...RANGE, grid: g, customAction: { label: 'ISO', color: '#a855f7' } }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      useRngForFrequency: false, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    expect(screen.getByRole('button', { name: /ISO/ })).toBeInTheDocument()
  })

  it('botão "Erro / Acerto" do topo abre o diálogo SEM registrar consulta', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Erro / Acerto' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useStore.getState().sessionStats.consults).toBe(0)
  })

  it('RNG ligado: feedback mostra a linha das faixas do RNG', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 30, raise: 70, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 2.5, currentScenario: {},
      useRngForFrequency: true, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /RAISE/ }))
    // linha das faixas: "RNG 50: 1–70 Raise · 71–100 Call"
    expect(screen.getByText(/RNG 50:/)).toBeInTheDocument()
    expect(screen.getByText(/1–70 Raise/)).toBeInTheDocument()
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
      fireEvent.click(screen.getByRole('button', { name: 'Avanço automático em 2 segundos' }))
      fireEvent.click(screen.getByRole('button', { name: /FOLD/ }))
      expect(nextDrillHand).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(2000) })
      expect(nextDrillHand).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ao acabar as mãos, "Próxima Mão" abre o resumo (sem alert)', () => {
    const nextDrillHand = vi.fn(() => false)
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {}, selectedDrillRangeIds: [1],
      sessionStats: { hands: 1, correct: 0, errors: 1, consults: 0 }, sessionSeverity: { grave: 1, impreciso: 0 },
      nextDrillHand,
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /FOLD/ }))
    fireEvent.click(screen.getByRole('button', { name: /Próxima Mão/ }))
    expect(nextDrillHand).toHaveBeenCalled()
    expect(screen.getByText('Resumo do Treino')).toBeInTheDocument()
  })

  it('"← Anterior" mostra a mão anterior e "← Mão atual" volta', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    const nextDrillHand = vi.fn(() => { useStore.setState({ activeHand: 'AA' }); return true })
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      useRngForFrequency: false, acceptAnyFreq: false, handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 }, sessionSeverity: { grave: 0, impreciso: 0 },
      nextDrillHand,
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /FOLD/ }))
    expect(screen.getByText(/Blunder/)).toBeInTheDocument()
    const prev = screen.getByRole('button', { name: '← Anterior' })
    expect(prev).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Próxima Mão/ }))
    expect(nextDrillHand).toHaveBeenCalled()
    expect(prev).toBeEnabled()
    fireEvent.click(prev)
    const back = screen.getByRole('button', { name: '← Mão atual' })
    expect(back).toBeInTheDocument()
    expect(screen.getByText(/Blunder/)).toBeInTheDocument()
    fireEvent.click(back)
    expect(screen.queryByRole('button', { name: '← Mão atual' })).not.toBeInTheDocument()
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

  it('HistoryModal: expandir sessão mostra o SessionDetail com range, stacks e toggle de visão', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const multi: Range = {
      ...RANGE, id: 30, name: 'STR multi', positions: ['STR'], grid: g,
      stackGrids: [
        { stackRange: '<=40', grid: g },
        { stackRange: '>40', grid: g },
      ],
    }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range, multi], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      trainingHistory: [{
        id: 99, timestamp: 1700000000000, rangeNames: ['STR multi'], tableSize: 8,
        hands: 10, correct: 8, errors: 2, consults: 1, durationSeconds: 120,
        handPerf: {
          30: { KK: { c: 8, t: 10 } },
          '30|||<=40': { KK: { c: 4, t: 5 } },
          '30|||>40': { KK: { c: 4, t: 5 } },
        },
      }],
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /HISTÓRICO/ }))
    // expande a sessão
    fireEvent.click(screen.getByText('STR multi', { exact: false }))
    // range da sessão com precisão 80%
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0)
    // expande o acordeão do range dentro do detalhe (2º botão que casa: o 1º é a linha da sessão)
    const accordions = screen.getAllByRole('button', { name: /STR multi.*80%/ })
    fireEvent.click(accordions[accordions.length - 1])
    // seletor de stack + alterna variante
    fireEvent.click(screen.getByRole('button', { name: '>40' }))
    // toggle da visão de ações
    fireEvent.click(screen.getByRole('button', { name: 'Ver Range' }))
    expect(screen.getByRole('button', { name: 'Ver Range' })).toBeInTheDocument()
  })

  it('HistoryModal: sessão antiga sem handPerf mostra aviso de indisponível', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [], sessionHandPerf: {}, handPerformance: {},
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      trainingHistory: [{
        id: 98, timestamp: 1700000000000, rangeNames: ['BTN RFI'], tableSize: 8,
        hands: 5, correct: 3, errors: 2, consults: 0, durationSeconds: 60,
      }],
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /HISTÓRICO/ }))
    fireEvent.click(screen.getByText('BTN RFI', { exact: false }))
    fireEvent.click(screen.getByRole('button', { name: /BTN RFI.*sem dados/ }))
    expect(screen.getByText('Dados por mão não disponíveis para sessões anteriores.')).toBeInTheDocument()
  })

  it('clicar numa mão da sidebar reabre o replay dela e "← Mão atual" volta', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      sessionHandPerf: {}, handPerformance: {},
      handHistory: [{
        id: 1, hand: 'AA', suits: ['s', 'd'], actionTaken: 'Fold', correctAction: 'Raise',
        rng: 33, correct: false, rangeName: 'BTN RFI', rangeId: 1, stackGridIdx: -1, severity: 'grave',
      }],
      sessionStats: { hands: 1, correct: 0, errors: 1, consults: 0 },
    })
    render(<TrainerPage />)
    // item da sidebar mostra a jogada errada (Fold → Raise)
    fireEvent.click(screen.getByText('Fold'))
    // replay aberto: feedback com a ação correta e botão de voltar à mão atual
    expect(screen.getByText('✗ Correto: Raise')).toBeInTheDocument()
    const backBtn = screen.getByRole('button', { name: '← Mão atual' })
    fireEvent.click(backBtn)
    expect(screen.queryByText('✗ Correto: Raise')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'Avanço automático em 2 segundos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Avanço automático em 2 segundos' }))
    expect(getRenderCount('historySidebar')).toBe(0)
  })

  it('expande o grupo e "Selecionar todos" seleciona os ranges da posição', () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [] })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /BTN/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }))
    expect(useStore.getState().selectedDrillRangeIds).toEqual([1])
  })

  it('selecionar um range e CONTINUAR avança para o filtro de mãos', () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1] })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    expect(screen.getByRole('button', { name: 'INICIAR TREINO' })).toBeInTheDocument()
  })

  it('INICIAR TREINO sem mãos disponíveis mostra aviso inline', () => {
    useStore.setState({
      ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1],
      startDrillSession: vi.fn(), nextDrillHand: vi.fn(() => false),
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    fireEvent.click(screen.getByRole('button', { name: 'INICIAR TREINO' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Nenhuma mão selecionada/)
  })

  it('não tem violações de acessibilidade na seleção de ranges (axe)', async () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null })
    const { container } = render(<TrainerPage />)
    expect((await axe(container)).violations).toEqual([])
  })

  it('HandFilterGrid: clicar numa mão a exclui e arrastar exclui as seguintes', () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1], drillExcludedHands: [] })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    fireEvent.mouseDown(screen.getByText('AA'))
    expect(useStore.getState().drillExcludedHands).toContain('AA')
    // arrastar sobre KK também exclui
    fireEvent.mouseOver(screen.getByText('KK'))
    expect(useStore.getState().drillExcludedHands).toContain('KK')
    // soltar encerra o arrasto
    fireEvent.mouseUp(screen.getByText('KK'))
    fireEvent.mouseOver(screen.getByText('QQ'))
    expect(useStore.getState().drillExcludedHands).not.toContain('QQ')
  })

  it('HandFilterGrid: clicar numa mão excluída a inclui de volta', () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1], drillExcludedHands: ['AA'] })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    fireEvent.mouseDown(screen.getByText('AA'))
    expect(useStore.getState().drillExcludedHands).not.toContain('AA')
  })

  it('HandFilterGrid: alterna RNG e "Focar erros"', () => {
    useStore.setState({
      ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1],
      useRngForFrequency: false, focusErrors: false, acceptAnyFreq: false,
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    expect(useStore.getState().useRngForFrequency).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Não' }))
    expect(useStore.getState().useRngForFrequency).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Focar erros/ }))
    expect(useStore.getState().focusErrors).toBe(true)
  })

  // --- Fatia: HandFilterGrid — botões Tudo / Nada ---

  it('botão "Tudo ✓" limpa todas as mãos excluídas', () => {
    useStore.setState({
      ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1],
      drillExcludedHands: ['AA', 'KK', 'QQ'],
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tudo ✓' }))
    expect(useStore.getState().drillExcludedHands).toEqual([])
  })

  it('botão "Nada ✗" exclui todas as mãos disponíveis', () => {
    useStore.setState({
      ranges: [RANGE], activeDrillRange: null, selectedDrillRangeIds: [1],
      drillExcludedHands: [],
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: /CONTINUAR/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Nada ✗' }))
    expect(useStore.getState().drillExcludedHands.length).toBeGreaterThan(0)
  })

  // --- Fatia: DrillSummary — accuracy por range e expansão do acordeão ---

  it('DrillSummary com range multi-stack alterna as variantes de stack e a visão', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const multi: Range = {
      ...RANGE, id: 5, name: 'BTN multi', grid: g,
      stackGrids: [
        { stackRange: '<=40', grid: g },
        { stackRange: '>40', grid: g },
      ],
    }
    useStore.setState({
      ranges: [multi], activeDrillRange: multi, activeDrillStackGridIdx: 0, activeDrillStackRange: '<=40',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [],
      sessionHandPerf: { 5: { KK: { c: 4, t: 5 } }, '5|||<=40': { KK: { c: 4, t: 5 } } },
      handPerformance: { 5: { KK: { c: 4, t: 5 } }, '5|||<=40': { KK: { c: 4, t: 5 } }, '5|||>40': { KK: { c: 1, t: 1 } } },
      selectedDrillRangeIds: [5],
      sessionStats: { hands: 5, correct: 4, errors: 1, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 1 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e ver resumo' }))
    // linha extra de severidade (1 impreciso)
    expect(screen.getByText(/Imprecisos/)).toBeInTheDocument()
    // expande o range multi-stack
    fireEvent.click(screen.getByRole('button', { name: /BTN multi/ }))
    // seletor de variantes de stack + alternância
    fireEvent.click(screen.getByRole('button', { name: '>40' }))
    fireEvent.click(screen.getByRole('button', { name: '<=40' }))
    // toggle da visão de ações
    fireEvent.click(screen.getByRole('button', { name: 'Ver Range' }))
    expect(screen.getByRole('button', { name: 'Ver Range' })).toBeInTheDocument()
  })

  it('DrillSummary mostra accuracy por range a partir do sessionHandPerf', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [],
      sessionHandPerf: { 1: { KK: { c: 9, t: 10 } } },
      handPerformance: {},
      selectedDrillRangeIds: [1],
      sessionStats: { hands: 10, correct: 9, errors: 1, consults: 0 },
      sessionSeverity: { grave: 1, impreciso: 0 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e ver resumo' }))
    // Nome do range aparece no acordeão por range
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    // Accuracy 90% (9/10) — aparece na linha do range (pode haver mais de um)
    expect(screen.getAllByText(/90%/).length).toBeGreaterThan(0)
  })

  it('DrillSummary — clicar no range expande o heatmap acumulativo', () => {
    const g = makeEmptyGrid()
    g['KK'] = { fold: 0, call: 0, raise: 100, allin: 0 }
    const range: Range = { ...RANGE, grid: g }
    useStore.setState({
      ranges: [range], activeDrillRange: range, activeDrillStackGridIdx: -1, activeDrillStackRange: '',
      activeHand: 'KK', currentHandSuits: ['h', 's'], currentRng: 50, currentHeroRaiseSize: 0, currentScenario: {},
      handHistory: [],
      sessionHandPerf: { 1: { KK: { c: 8, t: 10 } } },
      handPerformance: { 1: { KK: { c: 8, t: 10 } } },
      selectedDrillRangeIds: [1],
      sessionStats: { hands: 10, correct: 8, errors: 2, consults: 0 },
      sessionSeverity: { grave: 0, impreciso: 2 },
    })
    render(<TrainerPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e ver resumo' }))
    fireEvent.click(screen.getByRole('button', { name: /BTN RFI/ }))
    // HandMatrix renderiza 169 células (data-hand)
    expect(document.querySelectorAll('[data-hand]').length).toBe(169)
  })
})
