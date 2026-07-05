import { describe, it, expect } from 'vitest'
import { validateCreateUserPayload } from './create-user.js'

const valid = { username: 'jogador1', name: 'Jogador Um', email: 'jogador1@example.com' }

describe('validateCreateUserPayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateCreateUserPayload(valid)).toBe(true)
  })

  it('aceita e-mail ausente, nulo ou vazio', () => {
    expect(validateCreateUserPayload({ username: 'jogador1', name: 'J' })).toBe(true)
    expect(validateCreateUserPayload({ ...valid, email: null })).toBe(true)
    expect(validateCreateUserPayload({ ...valid, email: '' })).toBe(true)
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateCreateUserPayload(null)).toBe(false)
    expect(validateCreateUserPayload('x')).toBe(false)
  })

  it('rejeita username curto, longo demais ou não-string', () => {
    expect(validateCreateUserPayload({ ...valid, username: 'abc' })).toBe(false)
    expect(validateCreateUserPayload({ ...valid, username: 'x'.repeat(41) })).toBe(false)
    expect(validateCreateUserPayload({ ...valid, username: 123456 })).toBe(false)
  })

  it('rejeita name vazio ou longo demais', () => {
    expect(validateCreateUserPayload({ ...valid, name: '' })).toBe(false)
    expect(validateCreateUserPayload({ ...valid, name: 'x'.repeat(81) })).toBe(false)
  })

  it('rejeita e-mail malformado ou longo demais', () => {
    expect(validateCreateUserPayload({ ...valid, email: 'nao-e-email' })).toBe(false)
    expect(validateCreateUserPayload({ ...valid, email: `${'a'.repeat(115)}@x.com` })).toBe(false)
  })
})
