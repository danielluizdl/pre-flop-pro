import { describe, it, expect } from 'vitest'
import { onRequest } from './stats.js'

const USER = { id: 7, username: 'p1', name: 'Player', email: '', role: 'player', first_login: 0, tier: 'main', turma: null }

function fakeDB({ aggRows = [], rawRows = [] } = {}) {
  return {
    prepare(sql) {
      return {
        bind: () => ({
          first: async () => (sql.includes('FROM sessions') ? USER : null),
          all: async () => {
            if (sql.includes('GROUP BY range_id')) return { results: aggRows }
            if (sql.includes('wrong_hands AS wrongHands')) return { results: rawRows }
            return { results: [] }
          },
        }),
      }
    },
  }
}

function makeContext(qs, db) {
  const request = new Request(`https://x.test/api/me/stats?${qs}`, {
    headers: { Authorization: 'Bearer tok123' },
  })
  return { request, env: { DB: db } }
}

describe('/api/me/stats — build-by-range', () => {
  it('soma acertos/erros por mão de todas as tentativas de cada range', async () => {
    const db = fakeDB({
      aggRows: [
        { rangeId: 1, rangeName: 'RFI CO', attempts: 2, avgScore: 93.5, bestScore: 100, lastActivity: 1700000000 },
      ],
      rawRows: [
        {
          rangeId: 1,
          wrongHands: JSON.stringify({ AKs: 0.6 }),
          userGrid: JSON.stringify({
            AKs: { call: 0, raise: 100, allin: 0, extra: 0 },
            ATs: { call: 100, raise: 0, allin: 0, extra: 0 },
          }),
        },
        {
          rangeId: 1,
          wrongHands: null,
          userGrid: JSON.stringify({ AKs: { call: 0, raise: 100, allin: 0, extra: 0 } }),
        },
      ],
    })
    const res = await onRequest(makeContext('view=build-by-range', db))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0].attempts).toBe(2)
    // AKs: errou 0.6 na 1a tentativa, acertou na 2a => 1 correta, 1 errada.
    // ATs: só apareceu na 1a e nunca errou => 2 corretas (ausência = fold implícito correto), 0 erradas.
    expect(body.rows[0].correctHands).toBe(3)
    expect(body.rows[0].wrongHands).toBe(1)
  })

  it('sem wrong_hands/user_grid (schema antigo) devolve as linhas sem acertos/erros por mão', async () => {
    const db = {
      prepare(sql) {
        return {
          bind: () => ({
            first: async () => (sql.includes('FROM sessions') ? USER : null),
            all: async () => {
              if (sql.includes('GROUP BY range_id')) {
                return { results: [{ rangeId: 1, rangeName: 'RFI CO', attempts: 1, avgScore: 90, bestScore: 90, lastActivity: 1 }] }
              }
              throw new Error('coluna ausente')
            },
          }),
        }
      },
    }
    const res = await onRequest(makeContext('view=build-by-range', db))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toEqual([{ rangeId: 1, rangeName: 'RFI CO', attempts: 1, avgScore: 90, bestScore: 90, lastActivity: 1 }])
  })
})
