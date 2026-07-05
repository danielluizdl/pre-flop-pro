import { getAuthUser, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const result = await env.DB.prepare(`
    SELECT ic.id, ic.code, ic.created_at, ic.used_at,
      u.id as used_by_id, u.username as used_by_username, u.name as used_by_name
    FROM invite_codes ic
    LEFT JOIN users u ON u.id = ic.used_by
    ORDER BY ic.created_at DESC
    LIMIT 200
  `).all()

  return json({ codes: result.results })
}
