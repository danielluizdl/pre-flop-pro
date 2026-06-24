import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  constantTimeEqual,
  isLegacyHash,
  equalizeTiming,
  sha256Hex,
  checkRateLimit,
  isAllowedOrigin,
} from './_utils.js'

describe('hashPassword', () => {
  it('gera formato pbkdf2$<iters>$<hash> com 64 hex', async () => {
    const h = await hashPassword('senha123', 'salt-abc')
    const [scheme, iters, hex] = h.split('$')
    expect(scheme).toBe('pbkdf2')
    expect(Number(iters)).toBeGreaterThanOrEqual(100000)
    expect(hex).toMatch(/^[0-9a-f]{64}$/)
  })

  it('mesmo password+salt produz o mesmo hash', async () => {
    expect(await hashPassword('p', 's')).toBe(await hashPassword('p', 's'))
  })

  it('salts diferentes produzem hashes diferentes', async () => {
    expect(await hashPassword('p', 's1')).not.toBe(await hashPassword('p', 's2'))
  })
})

describe('verifyPassword', () => {
  it('valida um hash pbkdf2 correto', async () => {
    const salt = 'salt-xyz'
    const stored = await hashPassword('correta', salt)
    expect(await verifyPassword('correta', salt, stored)).toBe(true)
    expect(await verifyPassword('errada', salt, stored)).toBe(false)
  })

  it('valida hash legado SHA-256(salt:senha) para compatibilidade', async () => {
    const salt = 'legacy-salt'
    const legacy = await sha256Hex(salt + ':' + 'antiga')
    expect(isLegacyHash(legacy)).toBe(true)
    expect(await verifyPassword('antiga', salt, legacy)).toBe(true)
    expect(await verifyPassword('outra', salt, legacy)).toBe(false)
  })

  it('retorna false para entradas inválidas sem lançar', async () => {
    expect(await verifyPassword('x', 's', null)).toBe(false)
    expect(await verifyPassword('x', null, 'pbkdf2$100000$abc')).toBe(false)
    expect(await verifyPassword('x', 's', 'pbkdf2$abc$def')).toBe(false)
  })
})

describe('constantTimeEqual', () => {
  it('true para strings iguais, false para diferentes ou tamanhos distintos', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'ab')).toBe(false)
    expect(constantTimeEqual('abc', 123)).toBe(false)
  })
})

describe('isLegacyHash', () => {
  it('distingue formato pbkdf2 do legado', () => {
    expect(isLegacyHash('pbkdf2$100000$abc')).toBe(false)
    expect(isLegacyHash('a'.repeat(64))).toBe(true)
  })
})

describe('equalizeTiming', () => {
  it('não lança para password string ou não-string', async () => {
    await expect(equalizeTiming('qualquer')).resolves.toBeUndefined()
    await expect(equalizeTiming(undefined)).resolves.toBeUndefined()
  })
})

describe('isAllowedOrigin', () => {
  it('aceita produção, github pages e localhost', () => {
    expect(isAllowedOrigin('https://pre-flop-pro.pages.dev')).toBe(true)
    expect(isAllowedOrigin('https://danielluizdl.github.io')).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
  })

  it('aceita previews *.pre-flop-pro.pages.dev', () => {
    expect(isAllowedOrigin('https://feature-auth-telemetry.pre-flop-pro.pages.dev')).toBe(true)
  })

  it('rejeita origens desconhecidas e valores inválidos', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
    expect(isAllowedOrigin('https://pre-flop-pro.pages.dev.evil.com')).toBe(false)
    expect(isAllowedOrigin('http://pre-flop-pro.pages.dev')).toBe(false)
    expect(isAllowedOrigin(null)).toBe(false)
    expect(isAllowedOrigin('')).toBe(false)
  })
})

describe('checkRateLimit', () => {
  it('libera até o limite e bloqueia o excedente na mesma janela', () => {
    const store = new Map()
    const now = 1_000_000
    for (let i = 0; i < 8; i++) expect(checkRateLimit('ip1', now, store)).toBe(true)
    expect(checkRateLimit('ip1', now, store)).toBe(false)
  })

  it('reseta após a janela de 1 minuto', () => {
    const store = new Map()
    expect(checkRateLimit('ip2', 0, store)).toBe(true)
    expect(checkRateLimit('ip2', 61_000, store)).toBe(true)
  })
})
