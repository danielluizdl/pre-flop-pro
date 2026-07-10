import { describe, it, expect } from 'vitest'
import { validateBuildSessionPayload } from './build-session-end.js'

const valid = {
  roundsTotal: 3,
  roundsPlayed: 3,
  avgScore: 87.5,
  durationSeconds: 240,
  startedAt: 1720000000,
  session_uuid: '123e4567-e89b-42d3-a456-426614174000',
}

describe('validateBuildSessionPayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateBuildSessionPayload(valid)).toBe(true)
  })

  it('aceita campos opcionais ausentes/nulos', () => {
    expect(validateBuildSessionPayload({ avgScore: 0 })).toBe(true)
    expect(validateBuildSessionPayload({ ...valid, roundsTotal: null, roundsPlayed: null, durationSeconds: null, startedAt: null, session_uuid: null })).toBe(true)
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateBuildSessionPayload(null)).toBe(false)
    expect(validateBuildSessionPayload('x')).toBe(false)
  })

  it('rejeita avgScore fora de [0,100] ou não numérico', () => {
    expect(validateBuildSessionPayload({ ...valid, avgScore: -1 })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, avgScore: 100.1 })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, avgScore: NaN })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, avgScore: '90' })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, avgScore: undefined })).toBe(false)
  })

  it('rejeita contadores negativos ou não-inteiros', () => {
    expect(validateBuildSessionPayload({ ...valid, roundsTotal: -1 })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, roundsPlayed: 1.5 })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, durationSeconds: '10' })).toBe(false)
  })

  it('rejeita startedAt não-inteiro', () => {
    expect(validateBuildSessionPayload({ ...valid, startedAt: 1.5 })).toBe(false)
    expect(validateBuildSessionPayload({ ...valid, startedAt: 'ontem' })).toBe(false)
  })

  it('rejeita session_uuid malformado', () => {
    expect(validateBuildSessionPayload({ ...valid, session_uuid: 'abc' })).toBe(false)
  })
})
