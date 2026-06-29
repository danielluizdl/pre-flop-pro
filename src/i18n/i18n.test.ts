import { describe, it, expect } from 'vitest'
import { t } from './index'
import { pt } from './pt'

describe('i18n', () => {
  it('t aponta para o dicionário pt', () => {
    expect(t).toBe(pt)
  })

  it('expõe as chaves de auth e common usadas na LoginPage', () => {
    expect(t.auth.login).toBe('Entrar')
    expect(t.auth.createAccount).toBe('Criar conta')
    expect(t.common.back).toBe('Voltar')
    expect(t.auth.errors.passwordMin).toMatch(/8 caracteres/)
  })
})
