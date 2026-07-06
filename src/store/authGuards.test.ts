import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from './useStore'

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

describe('store: guards de "não autenticado"', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useStore.setState({ authToken: null, currentUser: null })
    globalThis.fetch = vi.fn(async () => { throw new Error('não deveria chamar rede') }) as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  it('listDevices sem token não chama rede', async () => {
    const r = await useStore.getState().listDevices()
    expect(r.ok).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('revokeDevice sem token não chama rede', async () => {
    const r = await useStore.getState().revokeDevice(1)
    expect(r.ok).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('revokeOtherDevices sem token não chama rede', async () => {
    const r = await useStore.getState().revokeOtherDevices()
    expect(r.ok).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('changePassword sem token não chama rede', async () => {
    const r = await useStore.getState().changePassword('nova')
    expect(r.ok).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('store: ramos de erro do servidor (res não-ok)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useStore.setState({ authToken: 'tok', currentUser: null })
  })
  afterEach(() => vi.restoreAllMocks())

  it('listDevices com erro do servidor devolve a mensagem do body', async () => {
    mockFetch(() => ({ status: 500, body: { error: 'boom' } }))
    const r = await useStore.getState().listDevices()
    expect(r).toEqual({ ok: false, error: 'boom' })
  })

  it('revokeDevice com erro do servidor devolve {ok:false}', async () => {
    mockFetch(() => ({ status: 403, body: { error: 'no' } }))
    const r = await useStore.getState().revokeDevice(9)
    expect(r).toEqual({ ok: false, error: 'no' })
  })

  it('revokeOtherDevices com erro do servidor devolve {ok:false}', async () => {
    mockFetch(() => ({ status: 500, body: {} }))
    const r = await useStore.getState().revokeOtherDevices()
    expect(r.ok).toBe(false)
  })

  it('revokeDevice: falha de rede vira {ok:false}', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    const r = await useStore.getState().revokeDevice(1)
    expect(r.ok).toBe(false)
  })

  it('revokeOtherDevices: falha de rede vira {ok:false}', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    const r = await useStore.getState().revokeOtherDevices()
    expect(r.ok).toBe(false)
  })

  it('changePassword com erro do servidor devolve a mensagem do body', async () => {
    mockFetch(() => ({ status: 400, body: { error: 'senha fraca' } }))
    const r = await useStore.getState().changePassword('123')
    expect(r).toEqual({ ok: false, error: 'senha fraca' })
  })
})

describe('store: authSignup falha', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useStore.setState({ authToken: null, currentUser: null, justSignedUp: false })
  })
  afterEach(() => vi.restoreAllMocks())

  it('signup com res não-ok retorna erro e não persiste token', async () => {
    mockFetch(() => ({ status: 409, body: { error: 'usuário já existe' } }))
    const r = await useStore.getState().authSignup('ana', 'senha', 'CODE', 'Ana', 'a@x.com', 'fundamentals', 'A')
    expect(r).toEqual({ ok: false, error: 'usuário já existe' })
    expect(sessionStorage.getItem('pfp-auth-token')).toBeNull()
    expect(useStore.getState().currentUser).toBeNull()
  })

  it('signup com falha de rede vira {ok:false}', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    const r = await useStore.getState().authSignup('ana', 'senha', 'CODE', 'Ana', 'a@x.com', 'fundamentals', 'A')
    expect(r.ok).toBe(false)
  })
})

describe('store: restoreSession e syncTeamRanges — ramos silenciosos', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useStore.setState({ authToken: null, currentUser: null })
  })
  afterEach(() => vi.restoreAllMocks())

  it('restoreSession com /me lançando erro remove o token salvo', async () => {
    sessionStorage.setItem('pfp-auth-token', 'tok')
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    await useStore.getState().restoreSession()
    expect(sessionStorage.getItem('pfp-auth-token')).toBeNull()
  })

  it('syncTeamRanges sem token é no-op', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('não deveria chamar') }) as unknown as typeof fetch
    await useStore.getState().syncTeamRanges()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('syncTeamRanges com lista vazia não muda os ranges', async () => {
    useStore.setState({ authToken: 'tok' })
    const before = useStore.getState().ranges.length
    mockFetch(() => ({ body: { ranges: [], version: 5 } }))
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().ranges.length).toBe(before)
  })

  it('syncTeamRanges com res não-ok é ignorado', async () => {
    useStore.setState({ authToken: 'tok' })
    const before = useStore.getState().ranges.length
    mockFetch(() => ({ status: 500, body: null }))
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().ranges.length).toBe(before)
  })
})
