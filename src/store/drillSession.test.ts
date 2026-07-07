import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './useStore'
import { makeEmptyGrid } from '../utils/hands'
import type { HandData, Range } from '../types'

function rangeWith(grid: Record<string, HandData>, extra: Partial<Range> = {}): Range {
  return { id: 1, name: 'R', positions: ['BTN'], grid, scenarios: [], tableSize: 6, ...extra }
}

function drillState(grid: Record<string, HandData>, over: Record<string, unknown> = {}) {
  useStore.setState({
    activeDrillRange: rangeWith(grid),
    activeDrillStackGridIdx: -1,
    activeDrillStackRange: '',
    currentRng: 50,
    currentHandSuits: ['h', 's'],
    useRngForFrequency: false,
    handHistory: [],
    sessionHandPerf: {},
    handPerformance: {},
    sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
    sessionSeverity: { grave: 0, impreciso: 0 },
    ...over,
  })
}

describe('checkDrillAnswer — RNG desligado aceita qualquer frequência > 0', () => {
  beforeEach(() => {
    const g = makeEmptyGrid()
    // AA: 25% call, 75% raise (principal = Raise)
    g['AA'] = { fold: 0, call: 25, raise: 75, allin: 0, size: 0 }
    drillState(g, { activeHand: 'AA' })
  })

  it('ação secundária com freq>0 é aceita como válida e vira mensagem "Válido"', () => {
    const r = useStore.getState().checkDrillAnswer('Call')
    expect(r.correct).toBe(true)
    expect(r.severity).toBeUndefined()
    expect(r.message).toContain('Válido')
    expect(r.message).toContain('Raise')
  })

  it('ação com 0% ainda é erro grave (blunder)', () => {
    const r = useStore.getState().checkDrillAnswer('Allin')
    expect(r.correct).toBe(false)
    expect(r.severity).toBe('grave')
  })

  it('sem range ativo retorna incorreto e mensagem vazia', () => {
    useStore.setState({ activeDrillRange: null })
    const r = useStore.getState().checkDrillAnswer('Raise')
    expect(r.correct).toBe(false)
    expect(r.message).toBe('')
  })
})

describe('checkDrillAnswer — customAction (extra)', () => {
  it('aceita a ação extra (limp) quando é a principal', () => {
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 0, raise: 0, allin: 0, extra: 100, size: 0 }
    drillState(g, {
      activeHand: 'AA',
      activeDrillRange: rangeWith(g, { customAction: { label: 'Limp', color: '#123456' } }),
    })
    const r = useStore.getState().checkDrillAnswer('Limp')
    expect(r.correct).toBe(true)
  })
})

describe('startDrillSession', () => {
  it('zera stats/histórico e gera um sessionUuid novo', () => {
    useStore.setState({
      sessionStats: { hands: 9, correct: 5, errors: 4, consults: 3 },
      handHistory: [{ id: 1 } as never],
      sessionSeverity: { grave: 2, impreciso: 1 },
      sessionUuid: '',
      selectedDrillRangeIds: [1],
    })
    useStore.getState().startDrillSession()
    const s = useStore.getState()
    expect(s.sessionStats).toEqual({ hands: 0, correct: 0, errors: 0, consults: 0 })
    expect(s.handHistory).toEqual([])
    expect(s.sessionSeverity).toEqual({ grave: 0, impreciso: 0 })
    expect(s.sessionUuid).toMatch(/[0-9a-f-]{36}/)
  })
})

describe('stopDrill', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response) as unknown as typeof fetch
  })

  it('com mãos > 0, salva a sessão no trainingHistory', () => {
    useStore.setState({
      ranges: [rangeWith(makeEmptyGrid())],
      selectedDrillRangeIds: [1],
      currentTableSize: 6,
      sessionStartTime: Date.now() - 5000,
      trainingHistory: [],
      sessionHandPerf: { 1: { AA: { c: 1, t: 2 } } },
      sessionStats: { hands: 8, correct: 6, errors: 2, consults: 1 },
      activeDrillRange: rangeWith(makeEmptyGrid()),
    })
    useStore.getState().stopDrill()
    const s = useStore.getState()
    expect(s.trainingHistory).toHaveLength(1)
    expect(s.trainingHistory[0]).toMatchObject({ hands: 8, correct: 6, errors: 2, consults: 1, tableSize: 6 })
    expect(s.trainingHistory[0].rangeNames).toEqual(['R'])
    expect(s.trainingHistory[0].durationSeconds).toBeGreaterThanOrEqual(4)
    expect(s.activeDrillRange).toBeNull()
    expect(s.page).toBe('drill')
  })

  it('sem mãos, não grava sessão mas limpa o drill ativo', () => {
    useStore.setState({
      trainingHistory: [],
      sessionStats: { hands: 0, correct: 0, errors: 0, consults: 0 },
      activeDrillRange: rangeWith(makeEmptyGrid()),
    })
    useStore.getState().stopDrill()
    const s = useStore.getState()
    expect(s.trainingHistory).toHaveLength(0)
    expect(s.activeDrillRange).toBeNull()
  })
})

describe('salvamento imediato do histórico do drill', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response) as unknown as typeof fetch
    const g = makeEmptyGrid()
    g['AA'] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 }
    drillState(g, {
      activeHand: 'AA',
      ranges: [rangeWith(g)],
      selectedDrillRangeIds: [1],
      currentTableSize: 6,
      sessionStartTime: Date.now() - 1000,
      trainingHistory: [],
    })
    localStorage.removeItem('fbr-training-history-v1')
  })

  it('a primeira mão respondida já grava a sessão em andamento no trainingHistory', () => {
    useStore.getState().checkDrillAnswer('Raise')
    const s = useStore.getState()
    expect(s.trainingHistory).toHaveLength(1)
    expect(s.trainingHistory[0]).toMatchObject({ hands: 1, correct: 1, errors: 0, tableSize: 6 })
    expect(s.trainingHistory[0].rangeNames).toEqual(['R'])
    expect(s.trainingHistory[0].handPerf?.[1]?.['AA']).toEqual({ c: 1, t: 1 })
    const saved = JSON.parse(localStorage.getItem('fbr-training-history-v1') ?? '[]')
    expect(saved).toHaveLength(1)
  })

  it('mãos seguintes atualizam a mesma sessão e stopDrill não duplica', () => {
    useStore.getState().checkDrillAnswer('Raise')
    useStore.setState({ activeHand: 'AA' })
    useStore.getState().checkDrillAnswer('Fold')
    let s = useStore.getState()
    expect(s.trainingHistory).toHaveLength(1)
    expect(s.trainingHistory[0]).toMatchObject({ hands: 2, correct: 1, errors: 1 })

    useStore.getState().stopDrill()
    s = useStore.getState()
    expect(s.trainingHistory).toHaveLength(1)
    expect(s.trainingHistory[0]).toMatchObject({ hands: 2, correct: 1, errors: 1 })
    const saved = JSON.parse(localStorage.getItem('fbr-training-history-v1') ?? '[]')
    expect(saved).toHaveLength(1)
  })

  it('sem sessão iniciada (sessionStartTime 0) não grava incremental', () => {
    useStore.setState({ sessionStartTime: 0 })
    useStore.getState().checkDrillAnswer('Raise')
    expect(useStore.getState().trainingHistory).toHaveLength(0)
  })
})

describe('gestão de ranges — clearHandPerformance / setRangePrereq', () => {
  it('clearHandPerformance remove o range e suas variações de stack', () => {
    useStore.setState({
      handPerformance: {
        7: { AA: { c: 1, t: 1 } },
        '7|||100-250': { KK: { c: 1, t: 1 } },
        9: { QQ: { c: 1, t: 1 } },
      },
    })
    useStore.getState().clearHandPerformance(7)
    const hp = useStore.getState().handPerformance
    expect(hp[7]).toBeUndefined()
    expect(hp['7|||100-250']).toBeUndefined()
    expect(hp[9]).toBeDefined()
  })

  it('setRangePrereq grava o prereqRangeId no range alvo', () => {
    useStore.setState({ ranges: [rangeWith(makeEmptyGrid(), { id: 5 })] })
    useStore.getState().setRangePrereq(5, 3)
    expect(useStore.getState().ranges.find(r => r.id === 5)?.prereqRangeId).toBe(3)
    useStore.getState().setRangePrereq(5, null)
    expect(useStore.getState().ranges.find(r => r.id === 5)?.prereqRangeId).toBeUndefined()
  })
})
