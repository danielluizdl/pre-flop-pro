import { getAuthUser, json, handleOptions, isUuidOrNull, isHand, isShortStr } from '../_utils.js'

const SUIT_RE = /^[hdsc]$/

export function validateHandPayload(body) {
  if (!body || typeof body !== 'object') return false
  const { rangeId, hand, actionTaken, correctAction, isCorrect, severity, rng, stackGridIdx } = body
  if (!Number.isInteger(rangeId) || rangeId < 0) return false
  if (!isHand(hand)) return false
  if (!isShortStr(actionTaken, 30)) return false
  if (!isShortStr(correctAction, 30)) return false
  if (isCorrect !== 0 && isCorrect !== 1) return false
  if (severity !== null && severity !== undefined && severity !== 'grave' && severity !== 'impreciso') return false
  if (rng !== null && rng !== undefined && (!Number.isInteger(rng) || rng < 1 || rng > 100)) return false
  if (!Number.isInteger(stackGridIdx) || stackGridIdx < -1) return false
  if (!isUuidOrNull(body.session_uuid)) return false
  if (!isUuidOrNull(body.client_event_id)) return false
  if (body.suits !== null && body.suits !== undefined) {
    if (!Array.isArray(body.suits) || body.suits.length !== 2) return false
    if (!body.suits.every(s => typeof s === 'string' && SUIT_RE.test(s))) return false
  }
  if (body.raiseSize !== null && body.raiseSize !== undefined) {
    if (typeof body.raiseSize !== 'number' && !isShortStr(body.raiseSize, 20)) return false
  }
  return true
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ ok: false, code: 'unauthenticated' })

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  if (!validateHandPayload(body)) return json({ ok: false, code: 'invalid_payload' }, 400)

  const { rangeId, rangeName, hand, actionTaken, correctAction, isCorrect, severity, rng, stackRange, stackGridIdx } = body
  const suits = Array.isArray(body.suits) ? body.suits.join('') : null
  const raiseSize = body.raiseSize !== null && body.raiseSize !== undefined ? String(body.raiseSize) : null

  // Fail-open enquanto a migração schema_v9 não for aplicada: se as colunas
  // suits/raise_size ainda não existirem, regrava sem elas em vez de 500
  // (travaria a fila FIFO de telemetria do cliente).
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO hand_events (user_id, range_id, range_name, hand, action_taken, correct_action, is_correct, severity, rng, stack_range, stack_grid_idx, session_uuid, client_event_id, suits, raise_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      user.id, rangeId, String(rangeName ?? ''), hand, actionTaken, correctAction, isCorrect,
      severity ?? null, rng ?? null, stackRange ?? null, stackGridIdx,
      body.session_uuid ?? null, body.client_event_id ?? null, suits, raiseSize
    ).run()
  } catch {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO hand_events (user_id, range_id, range_name, hand, action_taken, correct_action, is_correct, severity, rng, stack_range, stack_grid_idx, session_uuid, client_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      user.id, rangeId, String(rangeName ?? ''), hand, actionTaken, correctAction, isCorrect,
      severity ?? null, rng ?? null, stackRange ?? null, stackGridIdx,
      body.session_uuid ?? null, body.client_event_id ?? null
    ).run()
  }

  return json({ ok: true })
}
