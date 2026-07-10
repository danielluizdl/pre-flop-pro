import { getAuthUser, json, handleOptions, isUuidOrNull } from '../_utils.js'

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0
}

export function validateBuildSessionPayload(body) {
  if (!body || typeof body !== 'object') return false
  for (const k of ['roundsTotal', 'roundsPlayed', 'durationSeconds']) {
    if (body[k] !== undefined && body[k] !== null && !isNonNegInt(body[k])) return false
  }
  if (typeof body.avgScore !== 'number' || !Number.isFinite(body.avgScore) || body.avgScore < 0 || body.avgScore > 100) return false
  if (body.startedAt !== undefined && body.startedAt !== null && !Number.isInteger(body.startedAt)) return false
  if (!isUuidOrNull(body.session_uuid)) return false
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
  if (!validateBuildSessionPayload(body)) return json({ ok: false, code: 'invalid_payload' }, 400)

  const { roundsTotal, roundsPlayed, avgScore, durationSeconds, startedAt } = body
  const now = Math.floor(Date.now() / 1000)

  // Fail-open enquanto a migração schema_v8 não for aplicada: um 500 aqui
  // travaria a fila FIFO de telemetria do cliente (flush para em erro != 400).
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO range_build_sessions (user_id, session_uuid, rounds_total, rounds_played, avg_score, duration_seconds, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      user.id, body.session_uuid ?? null, roundsTotal ?? 0, roundsPlayed ?? 0, avgScore,
      durationSeconds ?? 0, Math.floor(startedAt ?? now), now
    ).run()
  } catch {
    return json({ ok: false, code: 'db_error' })
  }

  return json({ ok: true })
}
