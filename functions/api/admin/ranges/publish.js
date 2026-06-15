import { getAuthUser, json, handleOptions } from '../../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  const ranges = body?.ranges
  if (!Array.isArray(ranges)) return json({ error: 'Campo ranges deve ser um array' }, 400)
  for (const r of ranges) {
    if (!r || typeof r.id !== 'number' || typeof r.name !== 'string') {
      return json({ error: 'Cada range precisa de id (number) e name (string)' }, 400)
    }
  }

  const meta = await env.DB.prepare('SELECT version FROM team_ranges_meta WHERE id = 1').first()
  const newVersion = (meta?.version ?? 0) + 1
  const now = Math.floor(Date.now() / 1000)

  const stmts = [env.DB.prepare('DELETE FROM team_ranges')]
  const insert = env.DB.prepare('INSERT INTO team_ranges (id, data, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)')
  for (const r of ranges) {
    stmts.push(insert.bind(r.id, JSON.stringify(r), newVersion, now, coach.id))
  }
  stmts.push(env.DB.prepare('UPDATE team_ranges_meta SET version = ? WHERE id = 1').bind(newVersion))
  await env.DB.batch(stmts)

  return json({ ok: true, version: newVersion, count: ranges.length })
}
