import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TrainerPage } from './TrainerPage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
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

  it('não tem violações de acessibilidade na seleção de ranges (axe)', async () => {
    useStore.setState({ ranges: [RANGE], activeDrillRange: null })
    const { container } = render(<TrainerPage />)
    expect((await axe(container)).violations).toEqual([])
  })
})
