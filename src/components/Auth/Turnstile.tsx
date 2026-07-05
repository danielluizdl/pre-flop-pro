import { useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_KEY ?? import.meta.env.VITE_TURNSTILE_SITE_KEY) as string | undefined
export const turnstileEnabled = !!SITE_KEY

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile load failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const darkMode = useStore(s => s.darkMode)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current) return
        const ts = window.turnstile
        if (!ts) return
        widgetId.current = ts.render(ref.current, {
          sitekey: SITE_KEY,
          theme: darkMode ? 'dark' : 'light',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => { console.warn('Turnstile não carregou — seguindo sem widget') })
    return () => {
      cancelled = true
      const ts = window.turnstile
      if (ts && widgetId.current) { try { ts.remove(widgetId.current) } catch { /* noop */ } }
    }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center" />
}
