import { describe, it, expect } from 'vitest'
import { onRequest } from './_middleware.js'

function ctx(origin) {
  const headers = new Headers()
  if (origin) headers.set('Origin', origin)
  return {
    request: new Request('https://pre-flop-pro.pages.dev/api/auth/me', { headers }),
    next: async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  }
}

describe('_middleware CORS', () => {
  it('ecoa o Origin permitido em Access-Control-Allow-Origin + Vary', async () => {
    const res = await onRequest(ctx('https://pre-flop-pro.pages.dev'))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pre-flop-pro.pages.dev')
    expect(res.headers.get('Vary')).toContain('Origin')
  })

  it('não adiciona ACAO para origem não permitida', async () => {
    const res = await onRequest(ctx('https://evil.com'))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('não adiciona ACAO quando não há Origin (same-origin)', async () => {
    const res = await onRequest(ctx(null))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('preserva corpo e status da resposta original', async () => {
    const res = await onRequest(ctx('https://pre-flop-pro.pages.dev'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
