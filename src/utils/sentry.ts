import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
export const sentryEnabled = !!DSN

export function initSentry() {
  if (!DSN) {
    console.warn('VITE_SENTRY_DSN ausente — observabilidade Sentry desativada (fail-open)')
    return
  }
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })
}

export function captureError(error: unknown, info?: Record<string, unknown>) {
  if (!sentryEnabled) return
  Sentry.captureException(error, info ? { extra: info } : undefined)
}
