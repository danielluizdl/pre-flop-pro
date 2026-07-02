import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchAnalyticsCached, invalidateAnalyticsCache } from './analyticsCache'

describe('analyticsCache', () => {
  beforeEach(() => {
    invalidateAnalyticsCache()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    invalidateAnalyticsCache()
  })

  function mockFetch(payload: unknown) {
    const spy = vi.fn(async () => ({ ok: true, json: async () => payload }) as Response)
    globalThis.fetch = spy as unknown as typeof fetch
    return spy
  }

  it('primeiro fetch chama a rede; segundo com mesma URL usa cache (sem novo fetch)', async () => {
    const spy = mockFetch({ rows: [1, 2] })
    const a = await fetchAnalyticsCached('/api/admin/analytics?view=leaks', 'tok')
    const b = await fetchAnalyticsCached('/api/admin/analytics?view=leaks', 'tok')
    expect(a).toEqual({ rows: [1, 2] })
    expect(b).toEqual({ rows: [1, 2] })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('URLs diferentes disparam fetches distintos', async () => {
    const spy = mockFetch({ rows: [] })
    await fetchAnalyticsCached('/api/admin/analytics?view=leaks', 'tok')
    await fetchAnalyticsCached('/api/admin/analytics?view=segments', 'tok')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('passa o token no header Authorization', async () => {
    const spy = mockFetch({ ok: true })
    await fetchAnalyticsCached('/api/x', 'meu-token')
    expect(spy).toHaveBeenCalledWith('/api/x', { headers: { Authorization: 'Bearer meu-token' } })
  })

  it('invalidateAnalyticsCache força novo fetch na próxima chamada', async () => {
    const spy = mockFetch({ rows: [] })
    await fetchAnalyticsCached('/api/admin/analytics?view=leaks', 'tok')
    invalidateAnalyticsCache()
    await fetchAnalyticsCached('/api/admin/analytics?view=leaks', 'tok')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('expira após o TTL (refaz o fetch)', async () => {
    const spy = mockFetch({ rows: [] })
    await fetchAnalyticsCached('/api/y', 'tok', 10)
    await new Promise(r => setTimeout(r, 20))
    await fetchAnalyticsCached('/api/y', 'tok', 10)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('resposta não-ok rejeita e não popula o cache', async () => {
    const spy = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response)
    globalThis.fetch = spy as unknown as typeof fetch
    await expect(fetchAnalyticsCached('/api/z', 'tok')).rejects.toBeInstanceOf(Error)
    // segunda chamada tenta a rede de novo (nada em cache)
    await expect(fetchAnalyticsCached('/api/z', 'tok')).rejects.toBeInstanceOf(Error)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
