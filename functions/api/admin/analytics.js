import { getAuthUser, json, handleOptions } from '../_utils.js'

function parseIntParam(raw, { min, max }) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (!/^-?\d+$/.test(raw)) return { ok: false }
  const v = parseInt(raw, 10)
  if (min !== undefined && v < min) return { ok: false }
  if (max !== undefined && v > max) return { ok: false }
  return { ok: true, value: v }
}

function parsePlayerIds(raw) {
  const parts = (raw ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const out = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null
    const v = parseInt(p, 10)
    if (v < 1) return null
    out.push(v)
  }
  return out
}

function playerCond(playerIds) {
  if (!playerIds.length) return { sql: '', binds: [] }
  return { sql: `user_id IN (${playerIds.map(() => '?').join(',')})`, binds: [...playerIds] }
}

function dateCond(field, { days, from, to }) {
  const conds = []
  const binds = []
  if (from !== null && to !== null) {
    conds.push(`${field} >= ?`, `${field} <= ?`); binds.push(from, to)
  } else if (from !== null) {
    conds.push(`${field} >= ?`); binds.push(from)
  } else if (to !== null) {
    conds.push(`${field} <= ?`); binds.push(to)
  } else if (days !== null) {
    conds.push(`${field} >= unixepoch() - ?`); binds.push(days * 86400)
  }
  return { conds, binds }
}

function handFilters(filters) {
  const conds = []
  const binds = []
  const pc = playerCond(filters.playerIds)
  if (pc.sql) { conds.push(pc.sql); binds.push(...pc.binds) }
  if (filters.rangeId !== null) { conds.push('range_id = ?'); binds.push(filters.rangeId) }
  const dc = dateCond('created_at', filters)
  conds.push(...dc.conds); binds.push(...dc.binds)
  return { clause: conds.length ? 'WHERE ' + conds.join(' AND ') : '', binds }
}

const ACC = (correct, total) => (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0)

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (user.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const url = new URL(request.url)
  const view = url.searchParams.get('view') ?? 'team-overview'

  const playerIds = parsePlayerIds(url.searchParams.get('playerIds') ?? url.searchParams.get('playerId'))
  const pRange = parseIntParam(url.searchParams.get('rangeId'), { min: 0 })
  const pDays = parseIntParam(url.searchParams.get('days'), { min: 1, max: 365 })
  const pFrom = parseIntParam(url.searchParams.get('from'), { min: 0, max: 4102444800 })
  const pTo = parseIntParam(url.searchParams.get('to'), { min: 0, max: 4102444800 })
  if (playerIds === null || !pRange.ok || !pDays.ok || !pFrom.ok || !pTo.ok) return json({ error: 'Parâmetro inválido' }, 400)
  const filters = { playerIds, rangeId: pRange.value, days: pDays.value, from: pFrom.value, to: pTo.value }

  if (view === 'team-overview') {
    const hf = handFilters(filters)
    const handAgg = await env.DB.prepare(
      `SELECT user_id AS userId, COUNT(*) AS hands,
        CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos,
        MAX(created_at) AS lastActivity
       FROM hand_events ${hf.clause} GROUP BY user_id`
    ).bind(...hf.binds).all()

    const cConds = []
    const cBinds = []
    const cPc = playerCond(filters.playerIds)
    if (cPc.sql) { cConds.push(cPc.sql); cBinds.push(...cPc.binds) }
    if (filters.rangeId !== null) { cConds.push('range_id = ?'); cBinds.push(filters.rangeId) }
    { const dc = dateCond('created_at', filters); cConds.push(...dc.conds); cBinds.push(...dc.binds) }
    const consultAgg = await env.DB.prepare(
      `SELECT user_id AS userId, COUNT(*) AS consults FROM consult_events ${cConds.length ? 'WHERE ' + cConds.join(' AND ') : ''} GROUP BY user_id`
    ).bind(...cBinds).all()

    const sConds = []
    const sBinds = []
    const sPc = playerCond(filters.playerIds)
    if (filters.rangeId !== null) {
      // Sem range_id em training_sessions: vincula via session_uuid das maos daquele range.
      const subConds = ['range_id = ?', 'session_uuid IS NOT NULL']
      const subBinds = [filters.rangeId]
      if (sPc.sql) { subConds.push(sPc.sql); subBinds.push(...sPc.binds) }
      { const dc = dateCond('created_at', filters); subConds.push(...dc.conds); subBinds.push(...dc.binds) }
      sConds.push(`session_uuid IN (SELECT DISTINCT session_uuid FROM hand_events WHERE ${subConds.join(' AND ')})`)
      sBinds.push(...subBinds)
      if (sPc.sql) { sConds.push(sPc.sql); sBinds.push(...sPc.binds) }
    } else {
      if (sPc.sql) { sConds.push(sPc.sql); sBinds.push(...sPc.binds) }
      { const dc = dateCond('ended_at', filters); sConds.push(...dc.conds); sBinds.push(...dc.binds) }
    }
    const sessionAgg = await env.DB.prepare(
      `SELECT user_id AS userId, COUNT(*) AS sessions, CAST(COALESCE(SUM(duration_seconds), 0) AS INTEGER) AS duration
       FROM training_sessions ${sConds.length ? 'WHERE ' + sConds.join(' AND ') : ''} GROUP BY user_id`
    ).bind(...sBinds).all()

    const uPc = filters.playerIds.length ? ` AND id IN (${filters.playerIds.map(() => '?').join(',')})` : ''
    const usersRes = await env.DB.prepare(
      `SELECT id, username, name FROM users WHERE role = 'player'${uPc} ORDER BY name COLLATE NOCASE, username COLLATE NOCASE`
    ).bind(...filters.playerIds).all()

    const hMap = new Map((handAgg.results ?? []).map(r => [r.userId, r]))
    const cMap = new Map((consultAgg.results ?? []).map(r => [r.userId, r]))
    const sMap = new Map((sessionAgg.results ?? []).map(r => [r.userId, r]))

    const rows = (usersRes.results ?? []).map(u => {
      const h = hMap.get(u.id)
      const c = cMap.get(u.id)
      const s = sMap.get(u.id)
      const hands = h?.hands ?? 0
      const correct = h?.correct ?? 0
      return {
        userId: u.id,
        username: u.username,
        name: u.name,
        hands,
        correct,
        accuracy: ACC(correct, hands),
        graves: h?.graves ?? 0,
        imprecisos: h?.imprecisos ?? 0,
        consults: c?.consults ?? 0,
        sessions: s?.sessions ?? 0,
        durationSeconds: s?.duration ?? 0,
        lastActivity: h?.lastActivity ?? 0,
      }
    })

    const totalHands = rows.reduce((a, r) => a + r.hands, 0)
    const totalCorrect = rows.reduce((a, r) => a + r.correct, 0)
    const team = {
      hands: totalHands,
      accuracy: ACC(totalCorrect, totalHands),
      graves: rows.reduce((a, r) => a + r.graves, 0),
      imprecisos: rows.reduce((a, r) => a + r.imprecisos, 0),
      consults: rows.reduce((a, r) => a + r.consults, 0),
      sessions: rows.reduce((a, r) => a + r.sessions, 0),
      durationSeconds: rows.reduce((a, r) => a + r.durationSeconds, 0),
      lastActivity: rows.reduce((a, r) => Math.max(a, r.lastActivity), 0),
    }
    return json({ view, rows, team })
  }

  if (view === 'leaks') {
    const hf = handFilters(filters)
    // Impacto = erros ponderados por gravidade (espelha leakImpact em src/utils/coachStats.ts).
    // errors = total-correct; graves*1.0 + imprecisos*0.4 + untagged*0.7. ORDER/LIMIT por impacto
    // para não truncar leaks de alto custo (o JS re-ranqueia pelo mesmo critério via util).
    const res = await env.DB.prepare(
      `SELECT range_id AS rangeId, MAX(range_name) AS rangeName, hand,
        COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos
       FROM hand_events ${hf.clause}
       GROUP BY range_id, hand
       HAVING total >= 3
       ORDER BY (
         SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) * 1.0
         + SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) * 0.4
         + (COUNT(*) - CAST(SUM(is_correct) AS INTEGER)
            - SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END)
            - SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END)) * 0.7
       ) DESC
       LIMIT 100`
    ).bind(...hf.binds).all()
    const rows = (res.results ?? []).map(r => ({ ...r, accuracy: ACC(r.correct, r.total) }))
    return json({ view, rows })
  }

  if (view === 'player-ranges') {
    const hf = handFilters(filters)
    const res = await env.DB.prepare(
      `SELECT user_id AS userId, range_id AS rangeId, MAX(range_name) AS rangeName,
        COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct
       FROM hand_events ${hf.clause} GROUP BY user_id, range_id`
    ).bind(...hf.binds).all()

    const uPc = filters.playerIds.length ? ` AND id IN (${filters.playerIds.map(() => '?').join(',')})` : ''
    const usersRes = await env.DB.prepare(
      `SELECT id, username, name FROM users WHERE role = 'player'${uPc} ORDER BY name COLLATE NOCASE, username COLLATE NOCASE`
    ).bind(...filters.playerIds).all()

    return json({ view, rows: res.results ?? [], users: usersRes.results ?? [] })
  }

  if (view === 'knowledge-gaps') {
    const hf = handFilters(filters)
    const handAgg = await env.DB.prepare(
      `SELECT range_id AS rangeId, MAX(range_name) AS rangeName, hand,
        COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos
       FROM hand_events ${hf.clause} GROUP BY range_id, hand`
    ).bind(...hf.binds).all()

    const cConds = ['hand IS NOT NULL']
    const cBinds = []
    const cPc = playerCond(filters.playerIds)
    if (cPc.sql) { cConds.push(cPc.sql); cBinds.push(...cPc.binds) }
    if (filters.rangeId !== null) { cConds.push('range_id = ?'); cBinds.push(filters.rangeId) }
    { const dc = dateCond('created_at', filters); cConds.push(...dc.conds); cBinds.push(...dc.binds) }
    const consultAgg = await env.DB.prepare(
      `SELECT range_id AS rangeId, MAX(range_name) AS rangeName, hand, COUNT(*) AS consults
       FROM consult_events WHERE ${cConds.join(' AND ')}
       GROUP BY range_id, hand ORDER BY consults DESC LIMIT 300`
    ).bind(...cBinds).all()

    const key = (rangeId, hand) => `${rangeId}|${hand}`
    const hMap = new Map((handAgg.results ?? []).map(r => [key(r.rangeId, r.hand), r]))
    const rows = (consultAgg.results ?? []).map(c => {
      const h = hMap.get(key(c.rangeId, c.hand))
      return {
        rangeId: c.rangeId,
        rangeName: h?.rangeName ?? c.rangeName,
        hand: c.hand,
        consults: c.consults,
        total: h?.total ?? 0,
        correct: h?.correct ?? 0,
        graves: h?.graves ?? 0,
        imprecisos: h?.imprecisos ?? 0,
      }
    })
    return json({ view, rows })
  }

  if (view === 'segments') {
    const hf = handFilters(filters)
    const byHand = await env.DB.prepare(
      `SELECT hand, COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos
       FROM hand_events ${hf.clause} GROUP BY hand`
    ).bind(...hf.binds).all()
    const byAction = await env.DB.prepare(
      `SELECT correct_action AS action, COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos
       FROM hand_events ${hf.clause} GROUP BY correct_action ORDER BY total DESC`
    ).bind(...hf.binds).all()
    const actionRows = (byAction.results ?? []).map(r => ({ ...r, accuracy: ACC(r.correct, r.total) }))
    return json({ view, byHand: byHand.results ?? [], byAction: actionRows })
  }

  if (view === 'trend') {
    const hf = handFilters(filters)
    // Bucket semanal absoluto (604800s = 7 dias). Precisao por jogador/semana;
    // a inclinacao (regressao linear) e calculada no front via src/utils/coachTrend.ts.
    const res = await env.DB.prepare(
      `SELECT user_id AS userId, created_at / 604800 AS week,
        COUNT(*) AS hands, CAST(SUM(is_correct) AS INTEGER) AS correct
       FROM hand_events ${hf.clause}
       GROUP BY user_id, week
       ORDER BY userId, week`
    ).bind(...hf.binds).all()

    const uPc = filters.playerIds.length ? ` AND id IN (${filters.playerIds.map(() => '?').join(',')})` : ''
    const usersRes = await env.DB.prepare(
      `SELECT id, username, name FROM users WHERE role = 'player'${uPc} ORDER BY name COLLATE NOCASE, username COLLATE NOCASE`
    ).bind(...filters.playerIds).all()

    return json({ view, rows: res.results ?? [], users: usersRes.results ?? [] })
  }

  if (view === 'consult-hotspots') {
    const conds = []
    const binds = []
    const pc = playerCond(filters.playerIds)
    if (pc.sql) { conds.push(pc.sql); binds.push(...pc.binds) }
    if (filters.rangeId !== null) { conds.push('range_id = ?'); binds.push(filters.rangeId) }
    { const dc = dateCond('created_at', filters); conds.push(...dc.conds); binds.push(...dc.binds) }
    const res = await env.DB.prepare(
      `SELECT range_id AS rangeId, MAX(range_name) AS rangeName, hand, COUNT(*) AS count
       FROM consult_events ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
       GROUP BY range_id, hand
       ORDER BY count DESC
       LIMIT 100`
    ).bind(...binds).all()
    return json({ view, rows: res.results ?? [] })
  }

  if (view === 'by-range') {
    const hf = handFilters(filters)
    const handRes = await env.DB.prepare(
      `SELECT range_id AS rangeId, MAX(range_name) AS rangeName,
        COUNT(*) AS hands, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves,
        SUM(CASE WHEN severity = 'impreciso' THEN 1 ELSE 0 END) AS imprecisos,
        COUNT(DISTINCT user_id) AS players
       FROM hand_events ${hf.clause}
       GROUP BY range_id
       ORDER BY hands DESC`
    ).bind(...hf.binds).all()

    const cConds = []
    const cBinds = []
    const cPc = playerCond(filters.playerIds)
    if (cPc.sql) { cConds.push(cPc.sql); cBinds.push(...cPc.binds) }
    if (filters.rangeId !== null) { cConds.push('range_id = ?'); cBinds.push(filters.rangeId) }
    { const dc = dateCond('created_at', filters); cConds.push(...dc.conds); cBinds.push(...dc.binds) }
    const consultRes = await env.DB.prepare(
      `SELECT range_id AS rangeId, COUNT(*) AS consults FROM consult_events ${cConds.length ? 'WHERE ' + cConds.join(' AND ') : ''} GROUP BY range_id`
    ).bind(...cBinds).all()
    const cMap = new Map((consultRes.results ?? []).map(r => [r.rangeId, r.consults]))

    const rows = (handRes.results ?? []).map(r => ({
      ...r,
      accuracy: ACC(r.correct, r.hands),
      consults: cMap.get(r.rangeId) ?? 0,
    }))
    return json({ view, rows })
  }

  if (view === 'range-grid') {
    if (filters.rangeId === null) return json({ error: 'rangeId obrigatório' }, 400)

    const pStack = parseIntParam(url.searchParams.get('stackGridIdx'), { min: -1 })
    if (!pStack.ok) return json({ error: 'stackGridIdx inválido' }, 400)

    const conds = ['range_id = ?']
    const binds = [filters.rangeId]
    const pc = playerCond(filters.playerIds)
    if (pc.sql) { conds.push(pc.sql); binds.push(...pc.binds) }
    if (pStack.value !== null) { conds.push('stack_grid_idx = ?'); binds.push(pStack.value) }
    { const dc = dateCond('created_at', filters); conds.push(...dc.conds); binds.push(...dc.binds) }
    const clause = 'WHERE ' + conds.join(' AND ')

    const gridRes = await env.DB.prepare(
      `SELECT hand, COUNT(*) AS total, CAST(SUM(is_correct) AS INTEGER) AS correct,
        SUM(CASE WHEN severity = 'grave' THEN 1 ELSE 0 END) AS graves
       FROM hand_events ${clause} GROUP BY hand`
    ).bind(...binds).all()

    const wrongRes = await env.DB.prepare(
      `SELECT hand, action_taken AS action, COUNT(*) AS n
       FROM hand_events ${clause} AND is_correct = 0
       GROUP BY hand, action_taken`
    ).bind(...binds).all()

    const correctRes = await env.DB.prepare(
      `SELECT hand, correct_action AS action, COUNT(*) AS n
       FROM hand_events ${clause} GROUP BY hand, correct_action`
    ).bind(...binds).all()

    // consult_events NAO tem coluna stack_grid_idx: usa clausula propria (sem o filtro de stack).
    const cConds = ['range_id = ?']
    const cBinds = [filters.rangeId]
    if (pc.sql) { cConds.push(pc.sql); cBinds.push(...pc.binds) }
    { const dc = dateCond('created_at', filters); cConds.push(...dc.conds); cBinds.push(...dc.binds) }
    const consultRes = await env.DB.prepare(
      `SELECT hand, COUNT(*) AS n FROM consult_events WHERE ${cConds.join(' AND ')} AND hand IS NOT NULL GROUP BY hand`
    ).bind(...cBinds).all()

    // Distribuicao das acoes REALMENTE jogadas por mao (reconstroi o "range jogado").
    // LOWER porque dados antigos/novos variam a capitalizacao de action_taken.
    const playedRes = await env.DB.prepare(
      `SELECT hand, LOWER(action_taken) AS action, COUNT(*) AS n FROM hand_events ${clause} GROUP BY hand, LOWER(action_taken)`
    ).bind(...binds).all()
    const playedMap = new Map()
    for (const r of playedRes.results ?? []) {
      const cur = playedMap.get(r.hand) ?? { fold: 0, call: 0, raise: 0, allin: 0, extra: 0 }
      const a = (r.action || '').replace(/[\s-]/g, '')
      const bucket = a === 'fold' ? 'fold' : a === 'call' ? 'call' : a === 'raise' ? 'raise' : a === 'allin' ? 'allin' : 'extra'
      cur[bucket] += r.n
      playedMap.set(r.hand, cur)
    }

    const topByHand = (rows) => {
      const map = new Map()
      for (const r of rows ?? []) {
        const cur = map.get(r.hand)
        if (!cur || r.n > cur.n) map.set(r.hand, { action: r.action, n: r.n })
      }
      return map
    }
    const wrongMap = topByHand(wrongRes.results)
    const correctMap = topByHand(correctRes.results)
    const consultMap = new Map((consultRes.results ?? []).map(r => [r.hand, r.n]))

    const cells = (gridRes.results ?? []).map(r => ({
      hand: r.hand,
      total: r.total,
      correct: r.correct,
      accuracy: ACC(r.correct, r.total),
      graves: r.graves,
      consults: consultMap.get(r.hand) ?? 0,
      correctAction: correctMap.get(r.hand)?.action ?? null,
      topWrong: wrongMap.get(r.hand) ?? null,
      played: playedMap.get(r.hand) ?? { fold: 0, call: 0, raise: 0, allin: 0, extra: 0 },
    }))
    return json({ view, cells })
  }

  // Views do modo Range Check (range_build_events). Fail-open enquanto a
  // migração schema_v4 não for aplicada: tabela ausente devolve dados vazios.
  if (view === 'build-overview') {
    const hf = handFilters(filters)
    try {
      const agg = await env.DB.prepare(
        `SELECT user_id AS userId, COUNT(*) AS attempts, SUM(score) AS scoreSum,
          MAX(score) AS bestScore, COUNT(DISTINCT range_id) AS ranges, MAX(created_at) AS lastActivity
         FROM range_build_events ${hf.clause} GROUP BY user_id`
      ).bind(...hf.binds).all()

      const uPc = filters.playerIds.length ? ` AND id IN (${filters.playerIds.map(() => '?').join(',')})` : ''
      const usersRes = await env.DB.prepare(
        `SELECT id, username, name FROM users WHERE role = 'player'${uPc} ORDER BY name COLLATE NOCASE, username COLLATE NOCASE`
      ).bind(...filters.playerIds).all()

      const aMap = new Map((agg.results ?? []).map(r => [r.userId, r]))
      const rows = (usersRes.results ?? []).map(u => {
        const a = aMap.get(u.id)
        const attempts = a?.attempts ?? 0
        return {
          userId: u.id,
          username: u.username,
          name: u.name,
          attempts,
          avgScore: attempts > 0 ? Math.round(((a?.scoreSum ?? 0) / attempts) * 10) / 10 : 0,
          bestScore: Math.round((a?.bestScore ?? 0) * 10) / 10,
          ranges: a?.ranges ?? 0,
          lastActivity: a?.lastActivity ?? 0,
        }
      })

      const totalAttempts = rows.reduce((s, r) => s + r.attempts, 0)
      const totalScore = (agg.results ?? []).reduce((s, r) => s + (r.scoreSum ?? 0), 0)
      const team = {
        attempts: totalAttempts,
        avgScore: totalAttempts > 0 ? Math.round((totalScore / totalAttempts) * 10) / 10 : 0,
        bestScore: rows.reduce((s, r) => Math.max(s, r.bestScore), 0),
        ranges: rows.reduce((s, r) => Math.max(s, r.ranges), 0),
        lastActivity: rows.reduce((s, r) => Math.max(s, r.lastActivity), 0),
      }
      return json({ view, rows, team })
    } catch {
      return json({ view, rows: [], team: null })
    }
  }

  if (view === 'build-by-range') {
    const hf = handFilters(filters)
    try {
      const res = await env.DB.prepare(
        `SELECT range_id AS rangeId, MAX(range_name) AS rangeName, COUNT(*) AS attempts,
          ROUND(AVG(score), 1) AS avgScore, ROUND(MAX(score), 1) AS bestScore,
          COUNT(DISTINCT user_id) AS players, MAX(created_at) AS lastActivity
         FROM range_build_events ${hf.clause} GROUP BY range_id ORDER BY attempts DESC`
      ).bind(...hf.binds).all()
      return json({ view, rows: res.results ?? [] })
    } catch {
      return json({ view, rows: [] })
    }
  }

  if (view === 'build-events') {
    const hf = handFilters(filters)
    try {
      const res = await env.DB.prepare(
        `SELECT user_id AS userId,
          (SELECT COALESCE(NULLIF(u.name, ''), u.username) FROM users u WHERE u.id = user_id) AS playerName,
          range_id AS rangeId, range_name AS rangeName, stack_range AS stackRange,
          ROUND(score, 1) AS score, attempt, created_at AS createdAt
         FROM range_build_events ${hf.clause} ORDER BY created_at DESC LIMIT 100`
      ).bind(...hf.binds).all()
      return json({ view, rows: res.results ?? [] })
    } catch {
      return json({ view, rows: [] })
    }
  }

  return json({ error: 'view inválida' }, 400)
}
