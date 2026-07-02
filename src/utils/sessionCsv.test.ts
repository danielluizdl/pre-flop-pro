import { describe, it, expect } from 'vitest'
import { buildSessionCsv, sessionCsvFilename } from './sessionCsv'
import { makeEmptyGrid } from './hands'
import type { TrainingSession, Range } from '../types'

const RANGES: Range[] = [
  { id: 42, name: 'BTN RFI', positions: ['BTN'], grid: makeEmptyGrid(), scenarios: [], tableSize: 6 },
]

function session(handPerf?: TrainingSession['handPerf']): TrainingSession {
  return {
    id: 1, timestamp: Date.UTC(2026, 6, 2, 12), rangeNames: ['BTN RFI'], tableSize: 6,
    hands: 10, correct: 8, errors: 2, consults: 0, durationSeconds: 120,
    ...(handPerf ? { handPerf } : {}),
  }
}

describe('buildSessionCsv', () => {
  it('sessão sem handPerf: só o cabeçalho', () => {
    expect(buildSessionCsv(session(), RANGES)).toBe('range,stack,mao,tentativas,acertos,precisao')
  })

  it('resolve o nome do range pelo id e calcula a precisão por mão', () => {
    const csv = buildSessionCsv(session({ 42: { AA: { c: 8, t: 10 }, KK: { c: 1, t: 2 } } }), RANGES)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('range,stack,mao,tentativas,acertos,precisao')
    expect(lines).toContain('BTN RFI,,AA,10,8,80%')
    expect(lines).toContain('BTN RFI,,KK,2,1,50%')
  })

  it('chaves com stack têm precedência sobre a agregada do mesmo range', () => {
    const csv = buildSessionCsv(session({
      42: { AA: { c: 8, t: 10 } },
      '42|||<=40': { AA: { c: 4, t: 5 } },
      '42|||>40': { AA: { c: 4, t: 5 } },
    }), RANGES)
    const lines = csv.split('\n')
    // linha agregada (sem stack) não aparece — só as por stack
    expect(lines.filter(l => l.includes(',AA,'))).toHaveLength(2)
    expect(lines).toContain('BTN RFI,<=40,AA,5,4,80%')
    expect(lines).toContain('BTN RFI,>40,AA,5,4,80%')
  })

  it('sessão antiga chaveada por nome usa o nome direto', () => {
    const csv = buildSessionCsv(session({ 'SB 3bet': { QQ: { c: 0, t: 3 } } }), RANGES)
    expect(csv.split('\n')).toContain('SB 3bet,,QQ,3,0,0%')
  })

  it('id sem range correspondente cai no próprio id como nome', () => {
    const csv = buildSessionCsv(session({ 777: { JJ: { c: 1, t: 1 } } }), RANGES)
    expect(csv.split('\n')).toContain('777,,JJ,1,1,100%')
  })

  it('nome com vírgula ou aspas é escapado', () => {
    const csv = buildSessionCsv(session({ 'BTN, vs "3bet"': { TT: { c: 1, t: 1 } } }), RANGES)
    expect(csv.split('\n')).toContain('"BTN, vs ""3bet""",,TT,1,1,100%')
  })
})

describe('sessionCsvFilename', () => {
  it('usa a data da sessão no nome', () => {
    expect(sessionCsvFilename(session())).toBe('sessao-2026-07-02.csv')
  })
})
