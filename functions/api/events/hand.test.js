import { describe, it, expect } from 'vitest'
import { validateHandPayload } from './hand.js'

const valid = {
  rangeId: 5,
  hand: 'AKs',
  actionTaken: 'Raise',
  correctAction: 'Raise',
  isCorrect: 1,
  severity: null,
  rng: 42,
  stackGridIdx: -1,
  session_uuid: '123e4567-e89b-42d3-a456-426614174000',
  client_event_id: '123e4567-e89b-42d3-a456-426614174001',
}

describe('validateHandPayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateHandPayload(valid)).toBe(true)
  })

  it('aceita campos opcionais ausentes/nulos', () => {
    expect(validateHandPayload({ rangeId: 0, hand: 'AA', actionTaken: 'Fold', correctAction: 'Fold', isCorrect: 0, stackGridIdx: -1 })).toBe(true)
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateHandPayload(null)).toBe(false)
    expect(validateHandPayload('x')).toBe(false)
  })

  it('rejeita rangeId/hand/isCorrect/stackGridIdx inválidos', () => {
    expect(validateHandPayload({ ...valid, rangeId: -1 })).toBe(false)
    expect(validateHandPayload({ ...valid, hand: 'XYZ' })).toBe(false)
    expect(validateHandPayload({ ...valid, isCorrect: 2 })).toBe(false)
    expect(validateHandPayload({ ...valid, stackGridIdx: -2 })).toBe(false)
  })

  it('rejeita severity fora do enum e rng fora de [1,100]', () => {
    expect(validateHandPayload({ ...valid, severity: 'ruim' })).toBe(false)
    expect(validateHandPayload({ ...valid, rng: 0 })).toBe(false)
    expect(validateHandPayload({ ...valid, rng: 101 })).toBe(false)
  })

  it('aceita suits válido ([2 letras h/d/s/c]) e rejeita formato errado', () => {
    expect(validateHandPayload({ ...valid, suits: ['h', 'd'] })).toBe(true)
    expect(validateHandPayload({ ...valid, suits: null })).toBe(true)
    expect(validateHandPayload({ ...valid, suits: ['h'] })).toBe(false)
    expect(validateHandPayload({ ...valid, suits: ['h', 'x'] })).toBe(false)
    expect(validateHandPayload({ ...valid, suits: 'hd' })).toBe(false)
  })

  it('aceita raiseSize numérico ou string curta, rejeita tipos inválidos', () => {
    expect(validateHandPayload({ ...valid, raiseSize: 65 })).toBe(true)
    expect(validateHandPayload({ ...valid, raiseSize: '65bb' })).toBe(true)
    expect(validateHandPayload({ ...valid, raiseSize: null })).toBe(true)
    expect(validateHandPayload({ ...valid, raiseSize: 'x'.repeat(21) })).toBe(false)
    expect(validateHandPayload({ ...valid, raiseSize: {} })).toBe(false)
  })

  it('rejeita uuids malformados', () => {
    expect(validateHandPayload({ ...valid, session_uuid: 'abc' })).toBe(false)
    expect(validateHandPayload({ ...valid, client_event_id: 'abc' })).toBe(false)
  })
})
