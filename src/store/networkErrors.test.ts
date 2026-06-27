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
    useStore.setState({ authToken: 'tok', currentUser: { id: 1, username: 'u', name: '', email: '', role: 'player', firstLogin: false } })
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
})
