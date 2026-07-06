import { getAuthUser, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  try {
    const result = await env.DB.prepare(`
      SELECT l.id, l.action, l.target_id, l.detail, l.created_at,
        a.username AS actor_username, a.name AS actor_name,
        t.username AS target_username, t.name AS target_name
      FROM admin_audit_log l
      JOIN users a ON a.id = l.actor_id
      LEFT JOIN users t ON t.id = l.target_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `).all()
    return json({ entries: result.results ?? [] })
  } catch {
    // Fail-open enquanto a migração schema_v7 não for aplicada.
    return json({ entries: [] })
  }
}
