import { getAuthUser, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let version = 0
  let ranges = []
  try {
    const meta = await env.DB.prepare('SELECT version FROM team_ranges_meta WHERE id = 1').first()
    version = meta?.version ?? 0
    const rows = await env.DB.prepare('SELECT data FROM team_ranges ORDER BY id').all()
    ranges = (rows.results ?? []).map(r => {
      try { return JSON.parse(r.data) } catch { return null }
    }).filter(Boolean)
  } catch {
    // Tabelas ainda nao migradas: responde vazio para o app seguir com o seed local.
    return json({ version: 0, ranges: [] })
  }

  return json({ version, ranges })
}
