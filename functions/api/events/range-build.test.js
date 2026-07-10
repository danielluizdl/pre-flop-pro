import { describe, it, expect } from 'vitest'
import { validateRangeBuildPayload, validateWrongHands } from './range-build.js'

const valid = {
  rangeId: 11,
  rangeName: 'BTN RFI',
  stackRange: null,
  score: 87.5,
  roundsTotal: 3,
  session_uuid: '123e4567-e89b-42d3-a456-426614174000',
  client_event_id: '123e4567-e89b-42d3-a456-426614174001',
}

describe('validateRangeBuildPayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateRangeBuildPayload(valid)).toBe(true)
  })

  it('aceita campos opcionais ausentes/nulos', () => {
    expect(validateRangeBuildPayload({ rangeId: 0, score: 0 })).toBe(true)
    expect(validateRangeBuildPayload({ ...valid, stackRange: '<=100', roundsTotal: null, session_uuid: null, client_event_id: null })).toBe(true)
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateRangeBuildPayload(null)).toBe(false)
    expect(validateRangeBuildPayload('x')).toBe(false)
  })

  it('rejeita rangeId inválido', () => {
    expect(validateRangeBuildPayload({ ...valid, rangeId: -1 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, rangeId: 1.5 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, rangeId: '11' })).toBe(false)
  })

  it('rejeita score fora de [0,100] ou não numérico', () => {
    expect(validateRangeBuildPayload({ ...valid, score: -1 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, score: 100.1 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, score: NaN })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, score: '90' })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, score: undefined })).toBe(false)
  })

  it('rejeita stackRange longo demais ou não-string', () => {
    expect(validateRangeBuildPayload({ ...valid, stackRange: 'x'.repeat(51) })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, stackRange: 42 })).toBe(false)
  })

  it('aceita attempt válido ou ausente e rejeita attempt inválido', () => {
    expect(validateRangeBuildPayload({ ...valid, attempt: 1 })).toBe(true)
    expect(validateRangeBuildPayload({ ...valid, attempt: 3 })).toBe(true)
    expect(validateRangeBuildPayload({ ...valid, attempt: null })).toBe(true)
    expect(validateRangeBuildPayload({ ...valid, attempt: 0 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, attempt: 1.5 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, attempt: '2' })).toBe(false)
  })

  it('rejeita roundsTotal inválido', () => {
    expect(validateRangeBuildPayload({ ...valid, roundsTotal: 0 })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, roundsTotal: 2.5 })).toBe(false)
  })

  it('rejeita uuids malformados', () => {
    expect(validateRangeBuildPayload({ ...valid, session_uuid: 'abc' })).toBe(false)
    expect(validateRangeBuildPayload({ ...valid, client_event_id: 'abc' })).toBe(false)
  })

  it('aceita wrongHands válido ou ausente e rejeita inválido', () => {
    expect(validateRangeBuildPayload({ ...valid, wrongHands: { AKs: 0.5, '22': 1 } })).toBe(true)
    expect(validateRangeBuildPayload({ ...valid, wrongHands: null })).toBe(true)
    expect(validateRangeBuildPayload({ ...valid, wrongHands: { XYZ: 0.5 } })).toBe(false)
  })
})

describe('validateWrongHands', () => {
  it('aceita ausente/nulo e objeto vazio', () => {
    expect(validateWrongHands(undefined)).toBe(true)
    expect(validateWrongHands(null)).toBe(true)
    expect(validateWrongHands({})).toBe(true)
  })

  it('aceita mapa de mãos válidas com frações em (0,1]', () => {
    expect(validateWrongHands({ AKo: 0.25, QQ: 1, T9s: 0.003 })).toBe(true)
  })

  it('rejeita não-objeto e array', () => {
    expect(validateWrongHands('x')).toBe(false)
    expect(validateWrongHands([{ AKs: 0.5 }])).toBe(false)
  })

  it('rejeita chave que não é mão', () => {
    expect(validateWrongHands({ 'AA1': 0.5 })).toBe(false)
    expect(validateWrongHands({ akS: 0.5 })).toBe(false)
  })

  it('rejeita valores fora de (0,1] ou não numéricos', () => {
    expect(validateWrongHands({ AKs: 0 })).toBe(false)
    expect(validateWrongHands({ AKs: 1.1 })).toBe(false)
    expect(validateWrongHands({ AKs: NaN })).toBe(false)
    expect(validateWrongHands({ AKs: '0.5' })).toBe(false)
  })

  it('rejeita mais de 169 entradas', () => {
    const big = {}
    for (let i = 0; i < 170; i++) big[`k${i}`] = 0.5
    expect(validateWrongHands(big)).toBe(false)
  })
})
