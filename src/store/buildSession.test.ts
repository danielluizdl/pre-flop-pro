import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('../utils/eventQueue', () => ({
  enqueue: vi.fn(),
  flush: vi.fn(),
}))

import { useStore } from './useStore'
import { enqueue } from '../utils/eventQueue'
import { makeEmptyGrid } from '../utils/hands'
import type { HandData, Range } from '../types'

function gridWith(hands: Record<string, Partial<HandData>>): Record<string, HandData> {
  const g = makeEmptyGrid()
  for (const [h, d] of Object.entries(hands)) {
    const call = d.call ?? 0, raise = d.raise ?? 0, allin = d.allin ?? 0, extra = d.extra ?? 0
    g[h] = { call, raise, allin, extra, fold: Math.max(0, 100 - call - raise - allin - extra) }
  }
  return g
}

const simpleRange: Range = {
  id: 11, name: 'BTN RFI', positions: ['BTN'],
  grid: gridWith({ AA: { raise: 100 } }), scenarios: [], tableSize: 6,
}

const multiStackRange: Range = {
  id: 22, name: 'SB Push', positions: ['SB'],
  grid: gridWith({ KK: { allin: 100 } }), scenarios: [], tableSize: 6,
  customAction: { label: 'Limp', color: '#06b6d4' },
  stackGrids: [
    { stackRange: '<=100', grid: gridWith({ KK: { allin: 100 } }) },
    { stackRange: '100-250', grid: gridWith({ QQ: { raise: 100 } }), name: 'SB Push Deep' },
  ],
}

function resetBuildState() {
  useStore.setState({
    ranges: [simpleRange, multiStackRange],
    buildSelectedRangeIds: [],
    buildRounds: [],
    buildRoundIdx: 0,
    buildResults: [],
    buildLastResult: null,
    buildSessionUuid: '',
    buildConfirmed: false,
    buildHistory: [],
    authToken: 'tok',
  })
  localStorage.removeItem('pfp-build-history-v1')
  vi.mocked(enqueue).mockClear()
}

describe('startBuildSession', () => {
  beforeEach(resetBuildState)

  it('cria 1 round para range simples e 1 round por stackGrid no multi-stack', () => {
    useStore.setState({ buildSelectedRangeIds: [11, 22] })
    expect(useStore.getState().startBuildSession()).toBe(true)
    const rounds = useStore.getState().buildRounds
    expect(rounds).toHaveLength(3)
    expect(rounds[0].label).toBe('BTN RFI')
    expect(rounds[1].label).toBe('SB Push — <=100')
    expect(rounds[2].label).toBe('SB Push Deep — 100-250')
    expect(rounds[2].grid['QQ'].raise).toBe(100)
  })

  it('começa aguardando confirmação; confirmar libera e encerrar reseta', () => {
    useStore.setState({ buildSelectedRangeIds: [11], buildConfirmed: true })
    useStore.getState().startBuildSession()
    expect(useStore.getState().buildConfirmed).toBe(false)
    useStore.getState().confirmBuildSession()
    expect(useStore.getState().buildConfirmed).toBe(true)
    useStore.getState().stopBuildSession()
    expect(useStore.getState().buildConfirmed).toBe(false)
  })

  it('sem seleção não inicia', () => {
    expect(useStore.getState().startBuildSession()).toBe(false)
    expect(useStore.getState().buildRounds).toHaveLength(0)
  })

  it('reseta a grade de pintura e configura o pincel com a ação custom do range', () => {
    useStore.setState({ buildSelectedRangeIds: [22] })
    useStore.getState().startBuildSession()
    const s = useStore.getState()
    expect(Object.values(s.rangeData.grid).every(h => h.fold >= 100)).toBe(true)
    expect(s.brush.extraLabel).toBe('Limp')
    expect(s.brush.extraColor).toBe('#06b6d4')
    expect(s.buildSessionUuid).not.toBe('')
  })
})

describe('submitBuildRound', () => {
  beforeEach(() => {
    resetBuildState()
    useStore.setState({ buildSelectedRangeIds: [11] })
    useStore.getState().startBuildSession()
  })

  it('grade idêntica dá nota 100 e registra resultado', () => {
    const { rangeData } = useStore.getState()
    useStore.setState({ rangeData: { ...rangeData, grid: gridWith({ AA: { raise: 100 } }) } })
    useStore.getState().submitBuildRound()
    const s = useStore.getState()
    expect(s.buildLastResult?.score).toBe(100)
    expect(s.buildResults).toHaveLength(1)
    expect(s.buildResults[0]).toMatchObject({ roundIdx: 0, label: 'BTN RFI', score: 100, attempt: 1 })
    expect(s.buildResults[0].userGrid['AA'].raise).toBe(100)
  })

  it('grade vazia dá nota proporcional aos combos que faltam', () => {
    useStore.getState().submitBuildRound()
    const s = useStore.getState()
    expect(s.buildLastResult?.score).toBeCloseTo(100 * (1 - 6 / 1326), 4)
    expect(s.buildLastResult?.perHand['AA']).toBe(1)
  })

  it('envia telemetria range-build com a nota e o token', () => {
    useStore.getState().submitBuildRound()
    expect(enqueue).toHaveBeenCalledTimes(1)
    const [path, body, token] = vi.mocked(enqueue).mock.calls[0]
    expect(path).toBe('range-build')
    expect(token).toBe('tok')
    const b = body as Record<string, unknown>
    expect(b.rangeId).toBe(11)
    expect(b.rangeName).toBe('BTN RFI')
    expect(b.stackRange).toBeNull()
    expect(b.attempt).toBe(1)
    expect(b.roundsTotal).toBe(1)
    expect(typeof b.score).toBe('number')
    expect(typeof b.client_event_id).toBe('string')
  })

  it('não reenvia se o round já foi submetido', () => {
    useStore.getState().submitBuildRound()
    useStore.getState().submitBuildRound()
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(useStore.getState().buildResults).toHaveLength(1)
  })

  it('retryBuildRound refaz o round do zero e a nova tentativa é registrada como attempt 2', () => {
    useStore.getState().submitBuildRound()
    useStore.getState().retryBuildRound()
    let s = useStore.getState()
    expect(s.buildLastResult).toBeNull()
    expect(s.buildAttempt).toBe(2)
    expect(Object.values(s.rangeData.grid).every(h => h.fold >= 100)).toBe(true)
    useStore.setState({ rangeData: { ...s.rangeData, grid: gridWith({ AA: { raise: 100 } }) } })
    useStore.getState().submitBuildRound()
    s = useStore.getState()
    expect(s.buildResults).toHaveLength(2)
    expect(s.buildResults[0]).toMatchObject({ attempt: 1, roundIdx: 0 })
    expect(s.buildResults[1]).toMatchObject({ attempt: 2, roundIdx: 0, score: 100 })
    expect(enqueue).toHaveBeenCalledTimes(2)
    const b = vi.mocked(enqueue).mock.calls[1][1] as Record<string, unknown>
    expect(b.attempt).toBe(2)
  })

  it('retryBuildRound sem resultado enviado não faz nada', () => {
    useStore.getState().retryBuildRound()
    expect(useStore.getState().buildAttempt).toBe(1)
  })
})

describe('nextBuildRound / stopBuildSession', () => {
  beforeEach(() => {
    resetBuildState()
    useStore.setState({ buildSelectedRangeIds: [22] })
    useStore.getState().startBuildSession()
  })

  it('avança limpando a grade e o resultado do round anterior', () => {
    const { rangeData } = useStore.getState()
    useStore.setState({ rangeData: { ...rangeData, grid: gridWith({ KK: { allin: 100 } }) } })
    useStore.getState().submitBuildRound()
    useStore.getState().nextBuildRound()
    const s = useStore.getState()
    expect(s.buildRoundIdx).toBe(1)
    expect(s.buildLastResult).toBeNull()
    expect(Object.values(s.rangeData.grid).every(h => h.fold >= 100)).toBe(true)
  })

  it('após o último round o índice passa do fim (sinal de resumo)', () => {
    useStore.getState().submitBuildRound()
    useStore.getState().nextBuildRound()
    useStore.getState().submitBuildRound()
    useStore.getState().nextBuildRound()
    expect(useStore.getState().buildRoundIdx).toBe(2)
    expect(useStore.getState().buildRounds).toHaveLength(2)
  })

  it('stopBuildSession salva a sessão no histórico local com nota média', () => {
    const { rangeData } = useStore.getState()
    useStore.setState({ rangeData: { ...rangeData, grid: gridWith({ KK: { allin: 100 } }) } })
    useStore.getState().submitBuildRound()
    useStore.getState().nextBuildRound()
    useStore.getState().submitBuildRound()
    useStore.getState().stopBuildSession()
    const s = useStore.getState()
    expect(s.buildRounds).toHaveLength(0)
    expect(s.buildResults).toHaveLength(0)
    expect(s.buildHistory).toHaveLength(1)
    const session = s.buildHistory[0]
    expect(session.rangeNames).toEqual(['SB Push'])
    expect(session.rounds).toHaveLength(2)
    expect(session.rounds[0].score).toBe(100)
    expect(session.rounds[0].attempt).toBe(1)
    expect(session.avgScore).toBeCloseTo((session.rounds[0].score + session.rounds[1].score) / 2, 1)
    const saved = JSON.parse(localStorage.getItem('pfp-build-history-v1') ?? '[]')
    expect(saved).toHaveLength(1)
  })

  it('stopBuildSession sem resultados não grava histórico', () => {
    useStore.getState().stopBuildSession()
    expect(useStore.getState().buildHistory).toHaveLength(0)
    expect(localStorage.getItem('pfp-build-history-v1')).toBeNull()
  })
})
