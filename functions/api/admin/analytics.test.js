import { describe, it, expect } from 'vitest'
import { parseIntParam, parsePlayerIds, playerCond, dateCond, handFilters, ACC, buildRangeGridCells } from './analytics.js'

describe('parseIntParam', () => {
  it('aceita ausente/vazio como null', () => {
    expect(parseIntParam(null, {})).toEqual({ ok: true, value: null })
    expect(parseIntParam(undefined, {})).toEqual({ ok: true, value: null })
    expect(parseIntParam('', {})).toEqual({ ok: true, value: null })
  })

  it('aceita inteiro válido dentro do range', () => {
    expect(parseIntParam('30', { min: 1, max: 365 })).toEqual({ ok: true, value: 30 })
    expect(parseIntParam('-5', {})).toEqual({ ok: true, value: -5 })
  })

  it('rejeita não-inteiro ou fora do range', () => {
    expect(parseIntParam('abc', {})).toEqual({ ok: false })
    expect(parseIntParam('1.5', {})).toEqual({ ok: false })
    expect(parseIntParam('0', { min: 1 }).ok).toBe(false)
    expect(parseIntParam('366', { max: 365 }).ok).toBe(false)
  })
})

describe('parsePlayerIds', () => {
  it('retorna array vazio para ausente/vazio', () => {
    expect(parsePlayerIds(null)).toEqual([])
    expect(parsePlayerIds('')).toEqual([])
  })

  it('faz parse de CSV de ids válidos', () => {
    expect(parsePlayerIds('1,2,3')).toEqual([1, 2, 3])
    expect(parsePlayerIds(' 1 , 2 ')).toEqual([1, 2])
  })

  it('retorna null se algum id for inválido', () => {
    expect(parsePlayerIds('1,abc')).toBeNull()
    expect(parsePlayerIds('1,0')).toBeNull()
    expect(parsePlayerIds('1,-2')).toBeNull()
  })
})

describe('playerCond', () => {
  it('retorna cláusula vazia para lista vazia', () => {
    expect(playerCond([])).toEqual({ sql: '', binds: [] })
  })

  it('monta IN (?,?) com os binds', () => {
    expect(playerCond([1, 2])).toEqual({ sql: 'user_id IN (?,?)', binds: [1, 2] })
  })
})

describe('dateCond', () => {
  it('sem days/from/to não gera condição', () => {
    expect(dateCond('created_at', { days: null, from: null, to: null })).toEqual({ conds: [], binds: [] })
  })

  it('days vira janela relativa a unixepoch()', () => {
    expect(dateCond('created_at', { days: 7, from: null, to: null })).toEqual({
      conds: ['created_at >= unixepoch() - ?'], binds: [7 * 86400],
    })
  })

  it('from/to viram intervalo absoluto (from+to precede days)', () => {
    expect(dateCond('created_at', { days: 7, from: 100, to: 200 })).toEqual({
      conds: ['created_at >= ?', 'created_at <= ?'], binds: [100, 200],
    })
  })

  it('só from ou só to geram condição unilateral', () => {
    expect(dateCond('created_at', { days: null, from: 100, to: null })).toEqual({
      conds: ['created_at >= ?'], binds: [100],
    })
    expect(dateCond('created_at', { days: null, from: null, to: 200 })).toEqual({
      conds: ['created_at <= ?'], binds: [200],
    })
  })
})

describe('handFilters', () => {
  it('sem nenhum filtro retorna cláusula vazia', () => {
    expect(handFilters({ playerIds: [], rangeId: null, days: null, from: null, to: null }))
      .toEqual({ clause: '', binds: [] })
  })

  it('combina playerIds + rangeId + período numa única WHERE', () => {
    const r = handFilters({ playerIds: [1, 2], rangeId: 5, days: 30, from: null, to: null })
    expect(r.clause).toBe('WHERE user_id IN (?,?) AND range_id = ? AND created_at >= unixepoch() - ?')
    expect(r.binds).toEqual([1, 2, 5, 30 * 86400])
  })
})

describe('ACC', () => {
  it('retorna 0 para total zero (evita divisão por zero)', () => {
    expect(ACC(0, 0)).toBe(0)
  })

  it('calcula percentual arredondado em 1 casa decimal', () => {
    expect(ACC(1, 3)).toBe(33.3)
    expect(ACC(8, 10)).toBe(80)
  })
})

describe('buildRangeGridCells', () => {
  it('sem tentativas retorna array vazio', () => {
    expect(buildRangeGridCells([])).toEqual([])
  })

  it('mão nunca presente em wrongHands/userGrid não aparece no resultado', () => {
    const rows = [{ wrongHands: {}, userGrid: { AKs: { call: 0, raise: 100, allin: 0, extra: 0 } } }]
    const cells = buildRangeGridCells(rows)
    expect(cells.map(c => c.hand)).toEqual(['AKs'])
  })

  it('acumula erro/acerto/blunder e a soma de frequências jogadas ao longo de várias tentativas', () => {
    const rows = [
      {
        wrongHands: { AKs: 0.6 },
        userGrid: {
          AKs: { call: 0, raise: 100, allin: 0, extra: 0 },
          ATs: { call: 100, raise: 0, allin: 0, extra: 0 },
        },
      },
      {
        wrongHands: {},
        userGrid: { AKs: { call: 0, raise: 100, allin: 0, extra: 0 } },
      },
    ]
    const cells = buildRangeGridCells(rows)
    const byHand = Object.fromEntries(cells.map(c => [c.hand, c]))

    // AKs: errou 0.6 na 1a tentativa (>=0.5 => grave), acertou na 2a.
    expect(byHand.AKs.total).toBe(2)
    expect(byHand.AKs.correct).toBe(1)
    expect(byHand.AKs.graves).toBe(1)
    expect(byHand.AKs.accuracy).toBe(70)
    expect(byHand.AKs.played).toEqual({ fold: 0, call: 0, raise: 200, allin: 0, extra: 0 })

    // ATs: só apareceu na 1a tentativa, 100% call; ausente na 2a = fold:100
    // implícito (mesmo default do decodeSparse) — nunca contou como erro.
    expect(byHand.ATs.total).toBe(2)
    expect(byHand.ATs.correct).toBe(2)
    expect(byHand.ATs.graves).toBe(0)
    expect(byHand.ATs.accuracy).toBe(100)
    expect(byHand.ATs.played).toEqual({ fold: 100, call: 100, raise: 0, allin: 0, extra: 0 })
  })

  it('não expõe consults/correctAction/topWrong (conceitos que não existem no Range Check)', () => {
    const cells = buildRangeGridCells([{ wrongHands: { AA: 0 }, userGrid: {} }])
    expect(cells[0].consults).toBe(0)
    expect(cells[0].correctAction).toBeNull()
    expect(cells[0].topWrong).toBeNull()
  })
})
