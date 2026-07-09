import { describe, it, expect, beforeEach, vi } from 'vitest'
import { captureError } from '../utils/sentry'
import { useStore } from './useStore'

vi.mock('../utils/sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureError: vi.fn(),
}))

describe('store: erros de rede capturados (#15 FASE 2)', () => {
  beforeEach(() => {
    vi.mocked(captureError).mockClear()
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
  })

  it('authLogin: falha de rede → {ok:false} e captureError', async () => {
    const r = await useStore.getState().authLogin('u', 'p')
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'auth-login' })
  })

  it('changePassword: falha de rede → {ok:false} e captureError', async () => {
    useStore.setState({ authToken: 'tok', currentUser: { id: 1, username: 'u', name: '', email: '', role: 'player', firstLogin: false, tier: '', turma: null } })
    const r = await useStore.getState().changePassword('novasenha')
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'change-password' })
  })

  it('listDevices: falha de rede → {ok:false} e captureError', async () => {
    useStore.setState({ authToken: 'tok' })
    const r = await useStore.getState().listDevices()
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'list-devices' })
  })

  it('publishTeamRanges: falha de rede → {ok:false} e captureError', async () => {
    useStore.setState({ authToken: 'tok' })
    const r = await useStore.getState().publishTeamRanges()
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'publish-team-ranges' })
  })

  it('authSignup: falha de rede → {ok:false} e captureError', async () => {
    const r = await useStore.getState().authSignup('u', 'p', 'code', 'Nome', 'e@e.com', 'fundamentals', 'A')
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'auth-signup' })
  })

  it('revokeDevice: falha de rede → {ok:false} e captureError', async () => {
    useStore.setState({ authToken: 'tok' })
    const r = await useStore.getState().revokeDevice(5)
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'revoke-device' })
  })

  it('revokeOtherDevices: falha de rede → {ok:false} e captureError', async () => {
    useStore.setState({ authToken: 'tok' })
    const r = await useStore.getState().revokeOtherDevices()
    expect(r.ok).toBe(false)
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'revoke-other-devices' })
  })

  it('adminSaveRanges: falha de rede → "error" e captureError', async () => {
    useStore.setState({ adminWorkerUrl: 'https://x', adminToken: null })
    const r = await useStore.getState().adminSaveRanges('senha')
    expect(r).toBe('error')
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'admin-save-ranges' })
  })

  it('syncTeamRanges: falha de rede → no-op silencioso e captureError', async () => {
    useStore.setState({ authToken: 'tok' })
    await useStore.getState().syncTeamRanges()
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'sync-team-ranges' })
  })

  it('revokeDevice/revokeOtherDevices/listDevices sem token: erro sem tocar a rede', async () => {
    useStore.setState({ authToken: null })
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockClear()
    expect((await useStore.getState().listDevices()).ok).toBe(false)
    expect((await useStore.getState().revokeDevice(1)).ok).toBe(false)
    expect((await useStore.getState().revokeOtherDevices()).ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
