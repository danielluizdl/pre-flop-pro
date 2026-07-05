import { describe, it, expect } from 'vitest'
import { formatInviteCode } from './create-invite-code.js'

describe('formatInviteCode', () => {
  it('deixa o código em maiúsculas', () => {
    expect(formatInviteCode('a1b2c3d4')).toBe('A1B2C3D4')
  })

  it('não altera dígitos ou letras já maiúsculas', () => {
    expect(formatInviteCode('1234ABCD')).toBe('1234ABCD')
  })
})
