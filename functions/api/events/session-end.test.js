import { describe, it, expect } from 'vitest'
import { validateSessionPayload } from './session-end.js'

const valid = {
  rangeNames: ['STR SQZ vs RFI'],
  hands: 10,
  correct: 8,
  errors: 2,
  consults: 1,
  durationSeconds: 300,
  startedAt: 1720000000,
  tableSize: 8,
  session_uuid: '123e4567-e89b-42d3-a456-426614174000',
}

describe('validateSessionPayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateSessionPayload(valid)).toBe(true)
  })

  it('aceita campos numéricos ausentes/nulos (default 0)', () => {
    expect(validateSessionPayload({ rangeNames: [] })).toBe(true)
    expect(validateSessionPayload({ ...valid, hands: null, tableSize: null, session_uuid: null })).toBe(true)
  })

  it('rejeita body inválido ou rangeNames que não é array', () => {
    expect(validateSessionPayload(null)).toBe(false)
    expect(validateSessionPayload({ rangeNames: 'x' })).toBe(false)
  })

  it('rejeita contadores negativos ou não-inteiros', () => {
    expect(validateSessionPayload({ ...valid, hands: -1 })).toBe(false)
    expect(validateSessionPayload({ ...valid, correct: 1.5 })).toBe(false)
  })

  it('aceita tableSize 6 ou 8, rejeita outros valores', () => {
    expect(validateSessionPayload({ ...valid, tableSize: 6 })).toBe(true)
    expect(validateSessionPayload({ ...valid, tableSize: 8 })).toBe(true)
    expect(validateSessionPayload({ ...valid, tableSize: 7 })).toBe(false)
    expect(validateSessionPayload({ ...valid, tableSize: '8' })).toBe(false)
  })

  it('rejeita uuid malformado', () => {
    expect(validateSessionPayload({ ...valid, session_uuid: 'abc' })).toBe(false)
  })
})
