import { describe, it, expect, beforeEach, vi } from 'vitest'
import { captureMessage } from './sentry'
import { enqueue, flush } from './eventQueue'

vi.mock('./sentry', () => ({ captureMessage: vi.fn() }))

const KEY = 'pfp-event-queue'

function getQueue(): Array<{ path: string; body: { n: unknown }; ts: number }> {
  return JSON.parse(localStorage.getItem(KEY) || '[]')
}

function seed(items: Array<{ path: string; body: object; ts: number }>) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

describe('eventQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('sem token não enfileira', () => {
    enqueue('hand', { n: 1 }, null)
    expect(getQueue()).toHaveLength(0)
  })

  it('flush envia em ordem e remove em sucesso', async () => {
    const sent: unknown[] = []
    globalThis.fetch = vi.fn(async (_url: string, opts: { body: string }) => {
      sent.push(JSON.parse(opts.body).n)
      return { ok: true, status: 200 } as Response
    }) as unknown as typeof fetch
    seed([
      { path: 'hand', body: { n: 'a' }, ts: 1 },
      { path: 'hand', body: { n: 'b' }, ts: 2 },
      { path: 'hand', body: { n: 'c' }, ts: 3 },
    ])
    await flush('tok')
    expect(sent).toEqual(['a', 'b', 'c'])
    expect(getQueue()).toHaveLength(0)
  })

  it('para o flush em falha de rede e retoma depois', async () => {
    let fail = true
    globalThis.fetch = vi.fn(async () => {
      if (fail) throw new Error('network')
      return { ok: true, status: 200 } as Response
    }) as unknown as typeof fetch
    seed([{ path: 'hand', body: { n: 'a' }, ts: 1 }])
    await flush('tok')
    expect(getQueue()).toHaveLength(1)
    fail = false
    await flush('tok')
    expect(getQueue()).toHaveLength(0)
  })

  it('descarta item em resposta 400', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 400 } as Response)) as unknown as typeof fetch
    seed([{ path: 'hand', body: { n: 'a' }, ts: 1 }])
    await flush('tok')
    expect(getQueue()).toHaveLength(0)
  })

  it('mantém item em erro 500 (retentável)', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 } as Response)) as unknown as typeof fetch
    seed([{ path: 'hand', body: { n: 'a' }, ts: 1 }])
    await flush('tok')
    expect(getQueue()).toHaveLength(1)
  })

  it('cap de 500 descarta os mais antigos e reporta uma vez', async () => {
    vi.mocked(captureMessage).mockClear()
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network')
    }) as unknown as typeof fetch
    for (let i = 0; i < 600; i++) enqueue('hand', { n: i }, 'tok')
    const q = getQueue()
    expect(q.length).toBe(500)
    expect(q[0].body.n).toBe(100)
    expect(q[499].body.n).toBe(599)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('cheia'), 'warning')
    await new Promise(r => setTimeout(r, 0))
  })

  it('reporta falha de gravação por cota uma única vez', () => {
    vi.mocked(captureMessage).mockClear()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      enqueue('hand', { n: 1 }, 'tok')
      enqueue('hand', { n: 2 }, 'tok')
    } finally {
      spy.mockRestore()
    }
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('gravar'), 'warning')
  })
})
