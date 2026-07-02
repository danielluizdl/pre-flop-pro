import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// Testa o caminho HABILITADO do Turnstile: a chave é lida em nível de módulo,
// então o módulo precisa ser importado dinamicamente após stubEnv + resetModules.

type RenderOpts = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

describe('Turnstile habilitado (VITE_TURNSTILE_KEY presente)', () => {
  let renderSpy: ReturnType<typeof vi.fn>
  let removeSpy: ReturnType<typeof vi.fn>
  let lastOpts: RenderOpts | null

  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_KEY', 'test-site-key')
    vi.resetModules()
    lastOpts = null
    renderSpy = vi.fn((_el: HTMLElement, opts: RenderOpts) => { lastOpts = opts; return 'widget-1' })
    removeSpy = vi.fn()
    window.turnstile = { render: renderSpy, remove: removeSpy } as unknown as typeof window.turnstile
    // o script externo não carrega no jsdom: dispara onload manualmente
    const origAppend = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, 'appendChild').mockImplementation(((node: Node) => {
      const result = origAppend(node)
      if (node instanceof HTMLScriptElement && node.src.includes('turnstile')) {
        queueMicrotask(() => node.onload?.(new Event('load')))
      }
      return result
    }) as typeof document.head.appendChild)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    delete window.turnstile
  })

  it('renderiza o widget com a sitekey e repassa o token do callback', async () => {
    const { Turnstile, turnstileEnabled } = await import('./Turnstile')
    expect(turnstileEnabled).toBe(true)
    const onToken = vi.fn()
    const { container } = render(<Turnstile onToken={onToken} />)
    expect(container.firstChild).not.toBeNull()
    await waitFor(() => expect(renderSpy).toHaveBeenCalled())
    expect(lastOpts!.sitekey).toBe('test-site-key')
    lastOpts!.callback('tok-abc')
    expect(onToken).toHaveBeenCalledWith('tok-abc')
    lastOpts!['expired-callback']()
    expect(onToken).toHaveBeenCalledWith(null)
  })

  it('desmontar remove o widget', async () => {
    const { Turnstile } = await import('./Turnstile')
    const { unmount } = render(<Turnstile onToken={() => {}} />)
    await waitFor(() => expect(renderSpy).toHaveBeenCalled())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('widget-1')
  })
})
