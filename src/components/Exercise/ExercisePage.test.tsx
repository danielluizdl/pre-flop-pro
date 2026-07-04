import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'

vi.mock('../../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('../../utils/eventQueue', () => ({
  enqueue: vi.fn(),
  flush: vi.fn(),
}))

import { ExercisePage } from './ExercisePage'
import { useStore } from '../../store/useStore'
import { makeEmptyGrid } from '../../utils/hands'
import type { HandData, Range } from '../../types'

function gridWith(hands: Record<string, Partial<HandData>>): Record<string, HandData> {
  const g = makeEmptyGrid()
  for (const [h, d] of Object.entries(hands)) {
    const call = d.call ?? 0, raise = d.raise ?? 0, allin = d.allin ?? 0, extra = d.extra ?? 0
    g[h] = { call, raise, allin, extra, fold: Math.max(0, 100 - call - raise - allin - extra) }
  }
  return g
}

const btnRfi: Range = {
  id: 1, name: 'BTN RFI', positions: ['BTN'],
  grid: gridWith({ AA: { raise: 100 } }), scenarios: [], tableSize: 6,
}

const sbMulti: Range = {
  id: 2, name: 'SB Push', positions: ['SB'],
  grid: gridWith({ KK: { allin: 100 } }), scenarios: [], tableSize: 6,
  stackGrids: [
    { stackRange: '<=100', grid: gridWith({ KK: { allin: 100 } }) },
    { stackRange: '100-250', grid: gridWith({ QQ: { raise: 100 } }) },
  ],
}

function resetState(ranges: Range[] = [btnRfi, sbMulti]) {
  useStore.setState({
    ranges,
    buildSelectedRangeIds: [],
    buildRounds: [],
    buildRoundIdx: 0,
    buildResults: [],
    buildLastResult: null,
    buildConfirmed: false,
    buildHistory: [],
    rangeData: { id: null, name: '', grid: makeEmptyGrid(), positions: [], tableSize: 6, stackRange: '' },
    authToken: null,
  })
  localStorage.removeItem('pfp-build-history-v1')
}

describe('ExercisePage — seleção', () => {
  beforeEach(() => resetState())

  it('mostra o acordeão por posição e exige seleção antes de iniciar', () => {
    render(<ExercisePage />)
    expect(screen.getByText('Range Check')).toBeInTheDocument()
    expect(screen.getByText('BTN')).toBeInTheDocument()
    fireEvent.click(screen.getByText('INICIAR EXERCÍCIO'))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione pelo menos um range.')
    expect(useStore.getState().buildRounds).toHaveLength(0)
  })

  it('sem ranges mostra CTA para Meus Ranges', () => {
    resetState([])
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Ir para Meus Ranges'))
    expect(useStore.getState().page).toBe('ranges')
  })

  it('selecionar um range e iniciar mostra a confirmação e depois abre o round 1', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('BTN'))
    fireEvent.click(screen.getByText('BTN RFI'))
    fireEvent.click(screen.getByText('INICIAR EXERCÍCIO'))
    expect(screen.getByText('Confirme os rounds')).toBeInTheDocument()
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmar e começar'))
    expect(screen.getByText('Round 1/1')).toBeInTheDocument()
  })

  it('range multi-stack lista um round por faixa de stack na confirmação', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('SB'))
    fireEvent.click(screen.getByText('SB Push'))
    fireEvent.click(screen.getByText('INICIAR EXERCÍCIO'))
    expect(screen.getByText('SB Push — <=100')).toBeInTheDocument()
    expect(screen.getByText('SB Push — 100-250')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmar e começar'))
    expect(screen.getByText('Round 1/2')).toBeInTheDocument()
    expect(screen.getByText('SB Push — <=100')).toBeInTheDocument()
  })

  it('olho na confirmação abre o preview do gabarito do round certo (multi-stack)', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('SB'))
    fireEvent.click(screen.getByText('SB Push'))
    fireEvent.click(screen.getByText('INICIAR EXERCÍCIO'))
    const eyes = screen.getAllByRole('button', { name: 'Visualizar range' })
    expect(eyes).toHaveLength(2)
    fireEvent.click(eyes[1])
    const dialog = screen.getByRole('dialog', { name: 'SB Push — 100-250' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('100-250')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(eyes[0])
    expect(screen.getByRole('dialog', { name: 'SB Push — <=100' })).toBeInTheDocument()
  })

  it('Voltar na confirmação retorna à seleção mantendo os ranges marcados', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('BTN'))
    fireEvent.click(screen.getByText('BTN RFI'))
    fireEvent.click(screen.getByText('INICIAR EXERCÍCIO'))
    fireEvent.click(screen.getByText('Voltar'))
    expect(screen.getByText(/Selecione os ranges que você quer reproduzir/)).toBeInTheDocument()
    expect(useStore.getState().buildSelectedRangeIds).toEqual([1])
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<ExercisePage />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})

describe('ExercisePage — round ativo', () => {
  beforeEach(() => {
    resetState()
    useStore.setState({ buildSelectedRangeIds: [1] })
    useStore.getState().startBuildSession()
    useStore.getState().confirmBuildSession()
  })

  it('mostra a matriz de pintura e o pincel antes de enviar', () => {
    render(<ExercisePage />)
    expect(screen.getByText(/Pinte a matriz/)).toBeInTheDocument()
    expect(screen.getByText('Combos por ação')).toBeInTheDocument()
    expect(screen.queryByText('Gabarito')).not.toBeInTheDocument()
  })

  it('botão de grupo Pares aplica o pincel atual a todos os pares', () => {
    const { brush } = useStore.getState()
    useStore.setState({ brush: { ...brush, raise: 100, call: 0, allin: 0, extra: 0 } })
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Pares'))
    const g = useStore.getState().rangeData.grid
    expect(g['AA'].raise).toBe(100)
    expect(g['22'].raise).toBe(100)
    expect(g['AKs'].raise).toBe(0)
  })

  it('enviar com grade idêntica mostra nota 100 e o gabarito lado a lado', () => {
    const { rangeData } = useStore.getState()
    useStore.setState({ rangeData: { ...rangeData, grid: gridWith({ AA: { raise: 100 } }) } })
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Enviar resposta'))
    expect(screen.getByText('100/100')).toBeInTheDocument()
    expect(screen.getByText('Seu range')).toBeInTheDocument()
    expect(screen.getByText('Gabarito')).toBeInTheDocument()
    expect(screen.getByText('Diferença por mão')).toBeInTheDocument()
  })

  it('Tentar novamente refaz o round e marca a tentativa 2', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Enviar resposta'))
    fireEvent.click(screen.getByText('Tentar novamente'))
    expect(screen.getByText(/Pinte a matriz/)).toBeInTheDocument()
    expect(screen.getByText('Tentativa 2')).toBeInTheDocument()
    expect(useStore.getState().buildResults).toHaveLength(1)
  })

  it('no último round o botão avança para o resumo', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Enviar resposta'))
    fireEvent.click(screen.getByText('Ver resumo →'))
    expect(screen.getByText('Resumo do Exercício')).toBeInTheDocument()
    expect(screen.getByText('Nota média')).toBeInTheDocument()
  })

  it('encerrar exercício sem resposta volta para a seleção sem gravar histórico', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Encerrar exercício'))
    expect(screen.getByText(/Selecione os ranges que você quer reproduzir/)).toBeInTheDocument()
    expect(useStore.getState().buildHistory).toHaveLength(0)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<ExercisePage />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})

describe('ExercisePage — resumo', () => {
  beforeEach(() => {
    resetState()
    useStore.setState({ buildSelectedRangeIds: [1] })
    useStore.getState().startBuildSession()
    useStore.getState().confirmBuildSession()
    const { rangeData } = useStore.getState()
    useStore.setState({ rangeData: { ...rangeData, grid: gridWith({ AA: { raise: 100 } }) } })
    useStore.getState().submitBuildRound()
    useStore.getState().nextBuildRound()
  })

  it('mostra nota média e nota por round', () => {
    render(<ExercisePage />)
    expect(screen.getByText('Nota média')).toBeInTheDocument()
    expect(screen.getAllByText('100/100')).toHaveLength(2)
    expect(screen.getByText('BTN RFI')).toBeInTheDocument()
  })

  it('clicar num round reabre a comparação completa daquele round', () => {
    render(<ExercisePage />)
    expect(screen.queryByText('Gabarito')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('BTN RFI'))
    expect(screen.getByText('Seu range')).toBeInTheDocument()
    expect(screen.getByText('Gabarito')).toBeInTheDocument()
    expect(screen.getByText('Diferença por mão')).toBeInTheDocument()
    fireEvent.click(screen.getByText('BTN RFI'))
    expect(screen.queryByText('Gabarito')).not.toBeInTheDocument()
  })

  it('Encerrar salva a sessão no histórico e volta para a seleção', () => {
    render(<ExercisePage />)
    fireEvent.click(screen.getByText('Encerrar'))
    expect(useStore.getState().buildHistory).toHaveLength(1)
    expect(useStore.getState().buildHistory[0].avgScore).toBe(100)
    expect(screen.getByText(/Selecione os ranges que você quer reproduzir/)).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<ExercisePage />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
