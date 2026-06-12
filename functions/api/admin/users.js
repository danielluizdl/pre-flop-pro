import { getAuthUser, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (user.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const result = await env.DB.prepare(`
    SELECT u.id, u.username, u.created_at,
      COUNT(h.id) as total_hands,
      CAST(SUM(h.is_correct) AS INTEGER) as correct_hands
    FROM users u
    LEFT JOIN hand_events h ON h.user_id = u.id
    WHERE u.role = 'player'
    GROUP BY u.id
    ORDER BY u.username COLLATE NOCASE
  `).all()

  return json({ users: result.results })
}
