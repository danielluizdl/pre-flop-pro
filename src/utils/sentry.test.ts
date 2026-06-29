import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const init = vi.fn()
const captureException = vi.fn()
const captureMessage = vi.fn()
const addBreadcrumb = vi.fn()

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => init(...args),
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: (...args: unknown[]) => captureMessage(...args),
  addBreadcrumb: (...args: unknown[]) => addBreadcrumb(...args),
}))

async function loadWithDsn(dsn: string | undefined) {
  vi.resetModules()
  if (dsn === undefined) vi.stubEnv('VITE_SENTRY_DSN', '')
  else vi.stubEnv('VITE_SENTRY_DSN', dsn)
  return import('./sentry')
}

describe('sentry', () => {
  beforeEach(() => {
    init.mockClear()
    captureException.mockClear()
    captureMessage.mockClear()
    addBreadcrumb.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('sentryEnabled', () => {
    it('é falso sem DSN', async () => {
      const { sentryEnabled } = await loadWithDsn(undefined)
      expect(sentryEnabled).toBe(false)
    })

    it('é verdadeiro com DSN definido', async () => {
      const { sentryEnabled } = await loadWithDsn('https://exemplo@sentry.io/1')
      expect(sentryEnabled).toBe(true)
    })
  })

  describe('initSentry', () => {
    it('não inicializa e avisa quando o DSN está ausente (fail-open)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { initSentry } = await loadWithDsn(undefined)
      initSentry()
      expect(init).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledOnce()
    })

    it('inicializa o Sentry com o DSN, sem tracing e sem PII por padrão', async () => {
      const dsn = 'https://exemplo@sentry.io/1'
      const { initSentry } = await loadWithDsn(dsn)
      initSentry()
      expect(init).toHaveBeenCalledOnce()
      expect(init.mock.calls[0][0]).toMatchObject({ dsn, tracesSampleRate: 0, sendDefaultPii: false })
      expect(typeof init.mock.calls[0][0].beforeSend).toBe('function')
    })
  })

  describe('scrubEvent / redactString', () => {
    it('redige e-mails e tokens longos em strings', async () => {
      const { redactString } = await loadWithDsn('https://exemplo@sentry.io/1')
      expect(redactString('login de joao@teste.com falhou')).toContain('[email]')
      expect(redactString('Authorization: Bearer abc.def-123')).toContain('[redacted]')
      expect(redactString('token ' + 'a'.repeat(40))).toContain('[redacted]')
    })

    it('remove headers Authorization/Cookie e redige valores aninhados', async () => {
      const { scrubEvent } = await loadWithDsn('https://exemplo@sentry.io/1')
      const event = {
        message: 'erro de user@dominio.com',
        request: { headers: { Authorization: 'Bearer segredo', 'Content-Type': 'application/json' } },
        extra: { nested: { cookie: 'x' } },
      }
      const out = scrubEvent(event) as typeof event & { extra: { nested: Record<string, unknown> } }
      expect(out.message).toBe('erro de [email]')
      expect(out.request.headers).not.toHaveProperty('Authorization')
      expect(out.request.headers['Content-Type']).toBe('application/json')
      expect(out.extra.nested).not.toHaveProperty('cookie')
    })

    it('não entra em loop com referências circulares', async () => {
      const { scrubEvent } = await loadWithDsn('https://exemplo@sentry.io/1')
      const a: Record<string, unknown> = { name: 'x' }
      a.self = a
      expect(() => scrubEvent(a)).not.toThrow()
    })
  })

  describe('captureError', () => {
    it('não envia nada quando o Sentry está desativado', async () => {
      const { captureError } = await loadWithDsn(undefined)
      captureError(new Error('falha'))
      expect(captureException).not.toHaveBeenCalled()
    })

    it('envia a exceção quando habilitado, sem extra se info ausente', async () => {
      const { captureError } = await loadWithDsn('https://exemplo@sentry.io/1')
      const err = new Error('falha')
      captureError(err)
      expect(captureException).toHaveBeenCalledWith(err, undefined)
    })

    it('inclui info como extra quando fornecido', async () => {
      const { captureError } = await loadWithDsn('https://exemplo@sentry.io/1')
      const err = new Error('falha')
      captureError(err, { rangeId: 7 })
      expect(captureException).toHaveBeenCalledWith(err, { extra: { rangeId: 7 } })
    })

    it('faz scrub de PII no extra', async () => {
      const { captureError } = await loadWithDsn('https://exemplo@sentry.io/1')
      captureError(new Error('x'), { email: 'joao@teste.com', token: 'a'.repeat(40) })
      const extra = captureException.mock.calls[0][1].extra
      expect(extra.email).toBe('[email]')
      expect(extra.token).toBe('[redacted]')
    })
  })

  describe('captureMessage', () => {
    it('não envia nada sem DSN', async () => {
      const { captureMessage: cm } = await loadWithDsn(undefined)
      cm('estado degradado')
      expect(captureMessage).not.toHaveBeenCalled()
    })

    it('envia mensagem redigida com o nível dado', async () => {
      const { captureMessage: cm } = await loadWithDsn('https://exemplo@sentry.io/1')
      cm('cota cheia para joao@teste.com', 'warning')
      expect(captureMessage).toHaveBeenCalledWith('cota cheia para [email]', 'warning')
    })

    it('usa nível info por padrão', async () => {
      const { captureMessage: cm } = await loadWithDsn('https://exemplo@sentry.io/1')
      cm('algo')
      expect(captureMessage).toHaveBeenCalledWith('algo', 'info')
    })
  })

  describe('addBreadcrumb', () => {
    it('não registra nada sem DSN', async () => {
      const { addBreadcrumb: ab } = await loadWithDsn(undefined)
      ab('drill', 'iniciou treino')
      expect(addBreadcrumb).not.toHaveBeenCalled()
    })

    it('registra a migalha redigindo mensagem e dados', async () => {
      const { addBreadcrumb: ab } = await loadWithDsn('https://exemplo@sentry.io/1')
      ab('auth', 'login de joao@teste.com', { token: 'a'.repeat(40) })
      const crumb = addBreadcrumb.mock.calls[0][0]
      expect(crumb).toMatchObject({ category: 'auth', message: 'login de [email]', level: 'info' })
      expect(crumb.data.token).toBe('[redacted]')
    })
  })
})
