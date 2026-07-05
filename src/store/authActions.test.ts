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
    return {
      ok,
      status,
      json: async () => r.body,
    } as Response
  }) as unknown as typeof fetch
}

describe('store: ações de auth (caminho feliz)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useStore.setState({ authToken: null, currentUser: null, userMode: null, justSignedUp: false })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('authLogin sucesso: seta token/currentUser, persiste em sessionStorage e vira visitor', async () => {
    mockFetch((url) => {
      if (url.includes('/api/auth/login')) {
        return { body: { token: 'tok-123', user: { id: 7, username: 'ana', name: 'Ana', email: 'a@x.com', role: 'player', first_login: 0 } } }
      }
      if (url.includes('/api/ranges/list')) return { body: { ranges: [], version: 0 } }
      return { body: {} }
    })
    const r = await useStore.getState().authLogin('ana', 'senha')
    expect(r.ok).toBe(true)
    expect(sessionStorage.getItem('pfp-auth-token')).toBe('tok-123')
    const s = useStore.getState()
    expect(s.authToken).toBe('tok-123')
    expect(s.currentUser).toMatchObject({ id: 7, username: 'ana', role: 'player', firstLogin: false })
    expect(s.userMode).toBe('visitor')
    expect(s.justSignedUp).toBe(false)
  })

  it('authLogin coach: userMode vira admin e firstLogin reflete first_login=1', async () => {
    mockFetch((url) => {
      if (url.includes('/api/auth/login')) {
        return { body: { token: 'tk', user: { id: 1, username: 'admin001', role: 'coach', first_login: 1 } } }
      }
      return { body: { ranges: [] } }
    })
    const r = await useStore.getState().authLogin('admin001', 'x')
    expect(r.ok).toBe(true)
    const s = useStore.getState()
    expect(s.userMode).toBe('admin')
    expect(s.currentUser?.firstLogin).toBe(true)
  })

  it('authLogin falha do servidor: retorna erro do body e não persiste token', async () => {
    mockFetch(() => ({ status: 401, body: { error: 'credenciais inválidas' } }))
    const r = await useStore.getState().authLogin('ana', 'errada')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('credenciais inválidas')
    expect(sessionStorage.getItem('pfp-auth-token')).toBeNull()
  })

  it('authSignup sucesso: justSignedUp=true e seta currentUser', async () => {
    mockFetch((url) => {
      if (url.includes('/api/auth/signup')) {
        return { body: { token: 'ntok', user: { id: 9, username: 'novo', role: 'player', first_login: 0 } } }
      }
      return { body: { ranges: [] } }
    })
    const r = await useStore.getState().authSignup('novo', 'senha', 'TEAM', 'Novo', 'n@x.com')
    expect(r.ok).toBe(true)
    const s = useStore.getState()
    expect(s.justSignedUp).toBe(true)
    expect(s.authToken).toBe('ntok')
    expect(sessionStorage.getItem('pfp-auth-token')).toBe('ntok')
  })

  it('authLogout com token: chama /api/auth/logout, limpa sessionStorage e estado', async () => {
    useStore.setState({ authToken: 'tok', currentUser: { id: 1, username: 'u', name: '', email: '', role: 'player', firstLogin: false }, userMode: 'visitor' })
    sessionStorage.setItem('pfp-auth-token', 'tok')
    const calls: string[] = []
    mockFetch((url) => { calls.push(url); return { body: {} } })
    await useStore.getState().authLogout()
    expect(calls.some(u => u.includes('/api/auth/logout'))).toBe(true)
    expect(sessionStorage.getItem('pfp-auth-token')).toBeNull()
    const s = useStore.getState()
    expect(s.authToken).toBeNull()
    expect(s.currentUser).toBeNull()
    expect(s.userMode).toBeNull()
  })

  it('changePassword sucesso: zera firstLogin do currentUser', async () => {
    useStore.setState({ authToken: 'tok', currentUser: { id: 1, username: 'u', name: '', email: '', role: 'player', firstLogin: true } })
    mockFetch(() => ({ body: { ok: true } }))
    const r = await useStore.getState().changePassword('novasenhaforte')
    expect(r.ok).toBe(true)
    expect(useStore.getState().currentUser?.firstLogin).toBe(false)
  })

  it('changePassword sem token: retorna erro sem chamar rede', async () => {
    useStore.setState({ authToken: null })
    const spy = vi.fn()
    globalThis.fetch = spy as unknown as typeof fetch
    const r = await useStore.getState().changePassword('x')
    expect(r.ok).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('listDevices sucesso: devolve a lista de devices', async () => {
    useStore.setState({ authToken: 'tok' })
    mockFetch(() => ({ body: { devices: [{ id: 1 }, { id: 2 }] } }))
    const r = await useStore.getState().listDevices()
    expect(r.ok).toBe(true)
    expect(r.devices).toHaveLength(2)
  })

  it('revokeDevice sucesso e revokeOtherDevices sucesso', async () => {
    useStore.setState({ authToken: 'tok' })
    mockFetch(() => ({ body: { ok: true } }))
    expect((await useStore.getState().revokeDevice(3)).ok).toBe(true)
    expect((await useStore.getState().revokeOtherDevices()).ok).toBe(true)
  })

  it('restoreSession sucesso: restaura currentUser a partir do token salvo', async () => {
    sessionStorage.setItem('pfp-auth-token', 'saved-tok')
    mockFetch((url) => {
      if (url.includes('/api/auth/me')) {
        return { body: { user: { id: 5, username: 'volta', role: 'player', first_login: 0 } } }
      }
      return { body: { ranges: [] } }
    })
    await useStore.getState().restoreSession()
    const s = useStore.getState()
    expect(s.authToken).toBe('saved-tok')
    expect(s.currentUser?.username).toBe('volta')
  })

  it('restoreSession com /me falhando: remove o token salvo', async () => {
    sessionStorage.setItem('pfp-auth-token', 'stale')
    mockFetch(() => ({ status: 401, body: {} }))
    await useStore.getState().restoreSession()
    expect(sessionStorage.getItem('pfp-auth-token')).toBeNull()
  })

  it('restoreSession sem token: no-op silencioso', async () => {
    sessionStorage.clear()
    const spy = vi.fn()
    globalThis.fetch = spy as unknown as typeof fetch
    await useStore.getState().restoreSession()
    expect(spy).not.toHaveBeenCalled()
  })

  it('authSignup falha do servidor: retorna o erro do body e não persiste token', async () => {
    mockFetch(() => ({ status: 400, body: { error: 'código de time inválido' } }))
    const r = await useStore.getState().authSignup('u', 'p', 'bad', 'Nome', 'e@e.com')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('código de time inválido')
    expect(sessionStorage.getItem('pfp-auth-token')).toBeNull()
  })

  it('changePassword falha do servidor: retorna o erro do body', async () => {
    useStore.setState({ authToken: 'tok', currentUser: { id: 1, username: 'u', name: '', email: '', role: 'player', firstLogin: false } })
    mockFetch(() => ({ status: 400, body: { error: 'senha fraca' } }))
    const r = await useStore.getState().changePassword('123')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('senha fraca')
  })

  it('listDevices/revokeDevice/revokeOtherDevices falha do servidor: retornam erro do body', async () => {
    useStore.setState({ authToken: 'tok' })
    mockFetch(() => ({ status: 500, body: { error: 'servidor' } }))
    expect((await useStore.getState().listDevices()).error).toBe('servidor')
    expect((await useStore.getState().revokeDevice(1)).error).toBe('servidor')
    expect((await useStore.getState().revokeOtherDevices()).error).toBe('servidor')
  })

  it('syncTeamRanges com versão mais nova mescla os ranges do time', async () => {
    useStore.setState({ authToken: 'tok', ranges: [] })
    localStorage.removeItem('team-ranges-version')
    mockFetch((url) => {
      if (url.includes('/api/ranges/list')) {
        return { body: { version: Date.now(), ranges: [{ id: 7, name: 'Time BTN', positions: ['BTN'], grid: {}, scenarios: [], tableSize: 8 }] } }
      }
      return { body: {} }
    })
    await useStore.getState().syncTeamRanges()
    expect(useStore.getState().ranges.some(r => r.id === 7)).toBe(true)
    expect(useStore.getState().teamRangeIds).toContain(7)
  })
})
