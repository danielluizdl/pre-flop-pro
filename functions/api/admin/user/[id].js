import { getAuthUser, json, handleOptions } from '../../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (user.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const userId = Number(context.params.id)
  if (!Number.isFinite(userId)) return json({ error: 'Id inválido' }, 400)
  const tab = new URL(request.url).searchParams.get('tab') ?? 'hands'

  let result
  if (tab === 'consults') {
    result = await env.DB.prepare(
      'SELECT range_name, hand, COUNT(*) as count FROM consult_events WHERE user_id = ? GROUP BY range_name, hand ORDER BY count DESC LIMIT 100'
    ).bind(userId).all()
  } else if (tab === 'sessions') {
    result = await env.DB.prepare(
      'SELECT * FROM training_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50'
    ).bind(userId).all()
  } else {
    result = await env.DB.prepare(
      'SELECT * FROM hand_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 200'
    ).bind(userId).all()
  }

  return json({ data: result.results })
}
