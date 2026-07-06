import { describe, it, expect } from 'vitest'
import { validateUpdateUserPayload } from './update-user.js'

const valid = { userId: 1, name: 'Jogador Um', email: 'jogador1@example.com' }

describe('validateUpdateUserPayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateUpdateUserPayload(valid)).toBe(true)
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateUpdateUserPayload(null)).toBe(false)
    expect(validateUpdateUserPayload('x')).toBe(false)
  })

  it('rejeita userId inválido', () => {
    expect(validateUpdateUserPayload({ ...valid, userId: -1 })).toBe(false)
    expect(validateUpdateUserPayload({ ...valid, userId: 1.5 })).toBe(false)
    expect(validateUpdateUserPayload({ ...valid, userId: '1' })).toBe(false)
  })

  it('rejeita name vazio ou longo demais', () => {
    expect(validateUpdateUserPayload({ ...valid, name: '' })).toBe(false)
    expect(validateUpdateUserPayload({ ...valid, name: 'x'.repeat(81) })).toBe(false)
  })

  it('rejeita e-mail ausente, malformado ou longo demais', () => {
    expect(validateUpdateUserPayload({ ...valid, email: '' })).toBe(false)
    expect(validateUpdateUserPayload({ ...valid, email: 'nao-e-email' })).toBe(false)
    expect(validateUpdateUserPayload({ ...valid, email: `${'a'.repeat(115)}@x.com` })).toBe(false)
  })
})
