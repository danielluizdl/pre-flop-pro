import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from './useStore'
import { makeEmptyGrid } from '../utils/hands'
import { encodeRanges } from '../utils/sparseGrid'
import type { Range } from '../types'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

type Route = (url: string, init?: RequestInit) => { status?: number; ok?: boolean; body?: unknown }

function mockFetch(route: Route) {
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const r = route(String(url), init)
    const status = r.status ?? 200
    const ok = r.ok ?? (status >= 200 && status < 300)
    return { ok, status, json: async () => r.body } as Response
  }) as unknown as typeof fetch
}

function rng(id: number, name: string): Range {
  const grid = makeEmptyGrid()
  grid['AA'] = { fold: 0, call: 0, raise: 100, allin: 0 }
  return { id, name, positions: ['BTN'], grid, scenarios: [], tableSize: 6 }
}

describe('store: syncTeamRanges', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ authToken: 'tok', ranges: [rng(1, 'User')] })
  })
  afterEach(() => vi.restoreAllMocks())

  it('sem token: no-op sem chamar rede', async () => {
    useStore.setState({ authToken: null })
    const spy = vi.fn()
    globalThis.fetch = spy as unknown as typeof fetch
    await useStore.getState().syncTeamRanges()
    expect(spy).not.toHaveBeenCalled()
  })

  it('versão nova: mescla ranges do time preservando os do usuário e grava a versão', async () => {
    const team = [rng(100, 'Coach A'), rng(200, 'Coach B')]
    mockFetch((url) => {
      if (url.includes('/api/ranges/list')) return { body: { ranges: encodeRanges(team), version: 5 } }
      return { body: {} }
    })
    await useStore.getState().syncTeamRanges()
    const ids = useStore.getState().ranges.map(r => r.id).sort((a, b) => a - b)
    expect(ids).toEqual([1, 100, 200])
    expect(localStorage.getItem('team-ranges-version')).toBe('5')
  })

  it('versão nova: persiste os IDs do time em pfp-team-range-ids e no estado', async () => {
    const team = [rng(100, 'Coach A'), rng(200, 'Coach B')]
    mockFetch((url) => {
      if (url.includes('/api/ranges/list')) return { body: { ranges: encodeRanges(team), version: 6 } }
      return { body: {} }
    })
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().teamRangeIds.sort((a, b) => a - b)).toEqual([100, 200])
    expect(JSON.parse(localStorage.getItem('pfp-team-range-ids')!).sort((a: number, b: number) => a - b)).toEqual([100, 200])
  })

  it('versão já vista: não sobrescreve os ranges', async () => {
    localStorage.setItem('team-ranges-version', '5')
    mockFetch((url) => {
      if (url.includes('/api/ranges/list')) return { body: { ranges: encodeRanges([rng(100, 'Coach')]), version: 5 } }
      return { body: {} }
    })
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().ranges.map(r => r.id)).toEqual([1])
  })

  it('lista vazia: no-op', async () => {
    mockFetch((url) => {
      if (url.includes('/api/ranges/list')) return { body: { ranges: [], version: 9 } }
      return { body: {} }
    })
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().ranges.map(r => r.id)).toEqual([1])
    expect(localStorage.getItem('team-ranges-version')).toBeNull()
  })

  it('resposta não-ok: no-op silencioso', async () => {
    mockFetch(() => ({ status: 500, body: {} }))
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().ranges.map(r => r.id)).toEqual([1])
  })
})

describe('store: publishTeamRanges', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ authToken: 'tok', ranges: [rng(1, 'A')] })
  })
  afterEach(() => vi.restoreAllMocks())

  it('sem token: retorna erro sem chamar rede', async () => {
    useStore.setState({ authToken: null })
    const r = await useStore.getState().publishTeamRanges()
    expect(r.ok).toBe(false)
  })

  it('sucesso: grava versão e retorna contagem', async () => {
    mockFetch((url) => {
      if (url.includes('/api/admin/ranges/publish')) return { body: { ok: true, version: 12, count: 3 } }
      return { body: {} }
    })
    const r = await useStore.getState().publishTeamRanges()
    expect(r.ok).toBe(true)
    expect(r.version).toBe(12)
    expect(r.count).toBe(3)
    expect(localStorage.getItem('team-ranges-version')).toBe('12')
  })

  it('erro do servidor: retorna ok=false com a mensagem', async () => {
    mockFetch(() => ({ status: 403, body: { ok: false, error: 'sem permissão' } }))
    const r = await useStore.getState().publishTeamRanges()
    expect(r.ok).toBe(false)
    expect(r.error).toBe('sem permissão')
  })
})

describe('store: adminSaveRanges', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ ranges: [rng(1, 'A')], adminToken: null, adminLastError: '', adminWorkerUrl: 'https://w.example' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('senha correta: retorna ok', async () => {
    mockFetch(() => ({ status: 200, body: {} }))
    expect(await useStore.getState().adminSaveRanges('senha')).toBe('ok')
  })

  it('senha incorreta: retorna wrong_password', async () => {
    mockFetch(() => ({ status: 401, body: {} }))
    expect(await useStore.getState().adminSaveRanges('errada')).toBe('wrong_password')
  })

  it('token expirado: limpa adminToken e retorna token_expired', async () => {
    useStore.setState({ adminToken: { token: 'tk', expiresAt: Date.now() + 1000 } })
    mockFetch(() => ({ status: 401, body: {} }))
    expect(await useStore.getState().adminSaveRanges()).toBe('token_expired')
    expect(useStore.getState().adminToken).toBeNull()
  })

  it('erro com code invalid_token: grava adminLastError e retorna o code', async () => {
    mockFetch(() => ({ status: 400, body: { code: 'invalid_token', message: 'token ruim' } }))
    expect(await useStore.getState().adminSaveRanges('s')).toBe('invalid_token')
    expect(useStore.getState().adminLastError).toBe('token ruim')
  })

  it('erro genérico sem body JSON: grava HTTP status', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500, json: async () => { throw new Error('no json') },
    } as unknown as Response)) as unknown as typeof fetch
    expect(await useStore.getState().adminSaveRanges('s')).toBe('error')
    expect(useStore.getState().adminLastError).toBe('HTTP 500')
  })
})
