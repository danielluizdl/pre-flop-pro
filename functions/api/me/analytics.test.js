import { describe, it, expect } from 'vitest'
import { onRequest, PLAYER_VIEWS } from './analytics.js'

const USER = { id: 7, username: 'p1', name: 'Player', email: '', role: 'player', first_login: 0, tier: 'main', turma: null }

function fakeDB(user) {
  const calls = []
  return {
    calls,
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds })
          return {
            first: async () => (sql.includes('FROM sessions') ? user : null),
            all: async () => ({ results: [] }),
          }
        },
      }
    },
  }
}

function makeContext(qs, { user = USER, auth = true } = {}) {
  const db = fakeDB(user)
  const request = new Request(`https://x.test/api/me/analytics?${qs}`, {
    headers: auth ? { Authorization: 'Bearer tok123' } : {},
  })
  return { context: { request, env: { DB: db } }, db }
}

describe('/api/me/analytics', () => {
  it('exige autenticação', async () => {
    const { context } = makeContext('view=by-range', { auth: false })
    const res = await onRequest(context)
    expect(res.status).toBe(401)
  })

  it('rejeita views fora da whitelist do jogador', async () => {
    for (const view of ['team-overview', 'player-ranges', 'trend', 'segments', 'build-overview', 'build-events']) {
      const { context } = makeContext(`view=${view}`)
      const res = await onRequest(context)
      expect(res.status, view).toBe(400)
    }
  })

  it('aceita todas as views da whitelist', async () => {
    for (const view of PLAYER_VIEWS) {
      const qs = view === 'consult-by-range-hand' || view === 'range-grid' || view === 'build-range-grid' ? `view=${view}&rangeId=1` : `view=${view}`
      const { context } = makeContext(qs)
      const res = await onRequest(context)
      expect(res.status, view).toBe(200)
    }
  })

  it('força user_id do token e ignora playerIds do cliente', async () => {
    const { context, db } = makeContext('view=by-range&playerIds=999,1000')
    const res = await onRequest(context)
    expect(res.status).toBe(200)
    const dataCalls = db.calls.filter(c => !c.sql.includes('FROM sessions'))
    expect(dataCalls.length).toBeGreaterThan(0)
    for (const c of dataCalls) {
      expect(c.sql).toContain('user_id IN (?)')
      expect(c.binds).toContain(USER.id)
      expect(c.binds).not.toContain(999)
      expect(c.binds).not.toContain(1000)
    }
  })

  it('valida days/rangeId como o endpoint do coach', async () => {
    for (const qs of ['view=by-range&days=0', 'view=by-range&days=abc', 'view=by-range&rangeId=-1']) {
      const { context } = makeContext(qs)
      const res = await onRequest(context)
      expect(res.status, qs).toBe(400)
    }
  })
})
