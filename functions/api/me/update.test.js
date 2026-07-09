import { describe, it, expect } from 'vitest'
import { validateAccountUpdatePayload } from './update.js'

const valid = { name: 'Jogador Um', email: 'jogador1@example.com', tier: 'fundamentals', turma: 'A' }

describe('validateAccountUpdatePayload', () => {
  it('aceita payload válido completo', () => {
    expect(validateAccountUpdatePayload(valid)).toEqual({ ok: true, turma: 'A' })
  })

  it('aceita tier main sem turma e zera turma no retorno', () => {
    expect(validateAccountUpdatePayload({ ...valid, tier: 'main', turma: undefined })).toEqual({ ok: true, turma: null })
    expect(validateAccountUpdatePayload({ ...valid, tier: 'main', turma: 'A' })).toEqual({ ok: true, turma: null })
  })

  it('rejeita body inválido ou não-objeto', () => {
    expect(validateAccountUpdatePayload(null).ok).toBe(false)
    expect(validateAccountUpdatePayload('x').ok).toBe(false)
  })

  it('rejeita name vazio ou longo demais', () => {
    expect(validateAccountUpdatePayload({ ...valid, name: '' }).ok).toBe(false)
    expect(validateAccountUpdatePayload({ ...valid, name: 'x'.repeat(81) }).ok).toBe(false)
  })

  it('rejeita e-mail ausente, malformado ou longo demais', () => {
    expect(validateAccountUpdatePayload({ ...valid, email: '' }).ok).toBe(false)
    expect(validateAccountUpdatePayload({ ...valid, email: 'nao-e-email' }).ok).toBe(false)
    expect(validateAccountUpdatePayload({ ...valid, email: `${'a'.repeat(115)}@x.com` }).ok).toBe(false)
  })

  it('rejeita tier fora da lista permitida', () => {
    expect(validateAccountUpdatePayload({ ...valid, tier: 'inexistente' }).ok).toBe(false)
  })

  it('rejeita turma fora de A-D quando tier não é main', () => {
    expect(validateAccountUpdatePayload({ ...valid, turma: 'E' }).ok).toBe(false)
    expect(validateAccountUpdatePayload({ ...valid, turma: undefined }).ok).toBe(false)
  })

  it('aceita qualquer um dos 3 tiers com turma válida', () => {
    expect(validateAccountUpdatePayload({ ...valid, tier: 'evolution', turma: 'B' }).ok).toBe(true)
    expect(validateAccountUpdatePayload({ ...valid, tier: 'metamorphosis', turma: 'D' }).ok).toBe(true)
  })

  it('não aceita nem valida userId — sempre opera no usuário autenticado', () => {
    // Diferente de admin/update-user.js: este endpoint nunca lê um userId do
    // body (blindagem contra editar a conta de outra pessoa). Um userId no
    // payload é simplesmente ignorado pela validação.
    expect(validateAccountUpdatePayload({ ...valid, userId: 999 })).toEqual({ ok: true, turma: 'A' })
  })
})
