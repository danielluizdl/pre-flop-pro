import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
export const sentryEnabled = !!DSN

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const TOKEN_RE = /Bearer\s+[A-Za-z0-9._-]+|\b[0-9a-f]{32,}\b/gi

export function redactString(s: string): string {
  return s.replace(EMAIL_RE, '[email]').replace(TOKEN_RE, '[redacted]')
}

export function scrubEvent<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return redactString(value) as unknown as T
  if (Array.isArray(value)) return value.map(v => scrubEvent(v, seen)) as unknown as T
  if (value && typeof value === 'object') {
    if (seen.has(value as object)) return value
    seen.add(value as object)
    const obj = value as Record<string, unknown>
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'cookie') {
        delete obj[k]
        continue
      }
      obj[k] = scrubEvent(obj[k], seen)
    }
  }
  return value
}

export function initSentry() {
  if (!DSN) {
    console.warn('VITE_SENTRY_DSN ausente — observabilidade Sentry desativada (fail-open)')
    return
  }
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: event => scrubEvent(event),
  })
}

export function captureError(error: unknown, info?: Record<string, unknown>) {
  if (!sentryEnabled) return
  Sentry.captureException(error, info ? { extra: info } : undefined)
}
