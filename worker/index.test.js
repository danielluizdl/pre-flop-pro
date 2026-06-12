import { describe, it, expect } from 'vitest'
import {
  corsOrigin, passwordMatches, generateToken, verifyToken, checkRateLimit,
} from './index.js'

describe('corsOrigin', () => {
  it('ecoa origens da allowlist', () => {
    expect(corsOrigin('https://danielluizdl.github.io')).toBe('https://danielluizdl.github.io')
    expect(corsOrigin('http://localhost:5173')).toBe('http://localhost:5173')
  })
  it('rejeita origens fora da allowlist', () => {
    expect(corsOrigin('https://evil.example.com')).toBeNull()
    expect(corsOrigin('http://localhost:3000')).toBeNull()
    expect(corsOrigin(null)).toBeNull()
    expect(corsOrigin('')).toBeNull()
  })
})

describe('passwordMatches', () => {
  it('aceita senha igual', async () => {
    expect(await passwordMatches('s3nh4-secreta', 's3nh4-secreta')).toBe(true)
  })
  it('rejeita senha diferente', async () => {
    expect(await passwordMatches('errada', 's3nh4-secreta')).toBe(false)
  })
  it('rejeita vazio ou tipos inválidos', async () => {
    expect(await passwordMatches('', 's3nh4')).toBe(false)
    expect(await passwordMatches('s3nh4', '')).toBe(false)
    expect(await passwordMatches(undefined, 's3nh4')).toBe(false)
    expect(await passwordMatches(null, 's3nh4')).toBe(false)
  })
})

describe('token de sessão', () => {
  const secret = 'chave-admin'

  it('gera e verifica token válido', async () => {
    const now = 1_000_000
    const { token, expiresAt } = await generateToken(secret, now)
    expect(expiresAt).toBe(now + 30 * 60 * 1000)
    const res = await verifyToken(secret, token, now + 1000)
    expect(res.valid).toBe(true)
    expect(res.expiresAt).toBe(expiresAt)
  })

  it('rejeita token expirado', async () => {
    const now = 1_000_000
    const { token, expiresAt } = await generateToken(secret, now)
    const res = await verifyToken(secret, token, expiresAt + 1)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('expired')
  })

  it('rejeita token adulterado (payload alterado)', async () => {
    const now = 1_000_000
    const { token } = await generateToken(secret, now)
    const parts = token.split('.')
    const tampered = `v1.${now + 999_999_999}.${parts[2]}`
    const res = await verifyToken(secret, tampered, now + 1000)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('bad_signature')
  })

  it('rejeita token assinado com outra chave', async () => {
    const now = 1_000_000
    const { token } = await generateToken('outra-chave', now)
    const res = await verifyToken(secret, token, now + 1000)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('bad_signature')
  })

  it('rejeita token malformado', async () => {
    expect((await verifyToken(secret, 'lixo')).valid).toBe(false)
    expect((await verifyToken(secret, 'a.b')).valid).toBe(false)
    expect((await verifyToken(secret, null)).valid).toBe(false)
  })
})

describe('checkRateLimit', () => {
  it('permite até 5 tentativas e bloqueia a 6a na mesma janela', () => {
    const store = new Map()
    const ip = '1.2.3.4'
    const now = 10_000
    for (let i = 0; i < 5; i++) expect(checkRateLimit(ip, now, store)).toBe(true)
    expect(checkRateLimit(ip, now, store)).toBe(false)
  })

  it('libera novamente após a janela de 1 minuto', () => {
    const store = new Map()
    const ip = '1.2.3.4'
    for (let i = 0; i < 5; i++) checkRateLimit(ip, 0, store)
    expect(checkRateLimit(ip, 0, store)).toBe(false)
    expect(checkRateLimit(ip, 61_000, store)).toBe(true)
  })

  it('isola contagem por IP', () => {
    const store = new Map()
    for (let i = 0; i < 5; i++) checkRateLimit('a', 0, store)
    expect(checkRateLimit('a', 0, store)).toBe(false)
    expect(checkRateLimit('b', 0, store)).toBe(true)
  })
})
