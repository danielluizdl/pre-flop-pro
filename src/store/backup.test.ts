import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from './useStore'
import { makeEmptyGrid } from '../utils/hands'
import type { Range, TrainingSession } from '../types'

function sampleRange(id: number): Range {
  const grid = makeEmptyGrid()
  grid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0, size: 0 }
  return { id, name: `R${id}`, positions: ['BTN'], grid, scenarios: [], tableSize: 6 }
}

function sampleSession(id: number): TrainingSession {
  return {
    id, timestamp: id, rangeNames: ['R'], tableSize: 6,
    hands: 10, correct: 8, errors: 2, consults: 0, durationSeconds: 60,
  }
}

describe('backup export', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      ranges: [sampleRange(1), sampleRange(2)],
      trainingHistory: [sampleSession(100)],
      handPerformance: { 1: { AA: { c: 3, t: 4 } } },
      storageBlocked: false,
    })
  })

  it('exportData inclui ranges, histórico e performance', () => {
    const data = JSON.parse(useStore.getState().exportData())
    expect((data.ranges as Range[]).map(r => r.id)).toEqual([1, 2])
    expect((data.trainingHistory as TrainingSession[]).map(h => h.id)).toEqual([100])
    expect(data.handPerformance).toEqual({ 1: { AA: { c: 3, t: 4 } } })
  })
})

describe('cota de localStorage estourada', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ ranges: [sampleRange(1), sampleRange(2)], storageBlocked: false })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useStore.setState({ storageBlocked: false })
  })

  it('falha de setItem ao salvar seta o aviso storageBlocked', () => {
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      // Preserva a chave de persist do zustand (escrita em todo setState);
      // só estoura nas chaves de dados.
      if (key === 'fbr-ui-state') return real.call(this, key, value)
      throw new DOMException('quota', 'QuotaExceededError')
    })
    useStore.getState().deleteRange(2)
    expect(useStore.getState().storageBlocked).toBe(true)
  })

  it('save bem-sucedido limpa o aviso', () => {
    useStore.setState({ storageBlocked: true })
    useStore.getState().deleteRange(2)
    expect(useStore.getState().storageBlocked).toBe(false)
  })
})
