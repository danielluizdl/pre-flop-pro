import { getAuthUser, json, handleOptions } from '../_utils.js'

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
  const { rangeNames, hands, correct, errors, consults, durationSeconds, startedAt } = body ?? {}
  const now = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    'INSERT INTO training_sessions (user_id, range_names, hands, correct, errors, consults, duration_seconds, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, JSON.stringify(rangeNames ?? []), hands ?? 0, correct ?? 0, errors ?? 0, consults ?? 0, durationSeconds ?? 0, Math.floor(startedAt ?? now), now).run()

  return json({ ok: true })
}
