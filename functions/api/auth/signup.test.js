import { describe, it, expect } from 'vitest'
import { validateSignupFields } from './signup.js'

const valid = {
  username: 'jogador1', password: 'senha123', inviteCode: 'ABCD1234',
  name: 'Jogador Um', email: 'jogador1@example.com', tier: 'fundamentals', turma: 'A',
}

describe('validateSignupFields', () => {
  it('aceita payload válido completo', () => {
    expect(validateSignupFields(valid)).toEqual({ ok: true, turma: 'A' })
  })

  it('aceita tier main sem turma e zera turma no retorno', () => {
    expect(validateSignupFields({ ...valid, tier: 'main', turma: undefined })).toEqual({ ok: true, turma: null })
    expect(validateSignupFields({ ...valid, tier: 'main', turma: 'A' })).toEqual({ ok: true, turma: null })
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateSignupFields(null).ok).toBe(false)
    expect(validateSignupFields('x').ok).toBe(false)
  })

  it('rejeita campos obrigatórios ausentes', () => {
    expect(validateSignupFields({ ...valid, username: '' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, password: '' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, inviteCode: '' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, name: '' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, email: '' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, tier: '' }).ok).toBe(false)
  })

  it('rejeita username curto', () => {
    expect(validateSignupFields({ ...valid, username: 'abc' }).ok).toBe(false)
  })

  it('rejeita senha curta (mínimo 6)', () => {
    expect(validateSignupFields({ ...valid, password: '12345' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, password: '123456' }).ok).toBe(true)
  })

  it('rejeita e-mail malformado', () => {
    expect(validateSignupFields({ ...valid, email: 'nao-e-email' }).ok).toBe(false)
  })

  it('rejeita tier fora da lista permitida', () => {
    expect(validateSignupFields({ ...valid, tier: 'inexistente' }).ok).toBe(false)
  })

  it('rejeita turma fora de A-D quando tier não é main', () => {
    expect(validateSignupFields({ ...valid, turma: 'E' }).ok).toBe(false)
    expect(validateSignupFields({ ...valid, turma: undefined }).ok).toBe(false)
  })

  it('aceita qualquer um dos 3 tiers com turma válida', () => {
    expect(validateSignupFields({ ...valid, tier: 'evolution', turma: 'B' }).ok).toBe(true)
    expect(validateSignupFields({ ...valid, tier: 'metamorphosis', turma: 'D' }).ok).toBe(true)
  })
})
