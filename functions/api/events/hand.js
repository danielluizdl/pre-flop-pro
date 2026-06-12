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
  const { rangeId, rangeName, hand, actionTaken, correctAction, isCorrect, severity, rng, stackRange, stackGridIdx } = body ?? {}

  await env.DB.prepare(
    'INSERT INTO hand_events (user_id, range_id, range_name, hand, action_taken, correct_action, is_correct, severity, rng, stack_range, stack_grid_idx) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, rangeId, rangeName, hand, actionTaken, correctAction, isCorrect, severity ?? null, rng ?? null, stackRange ?? null, stackGridIdx ?? -1).run()

  return json({ ok: true })
}
