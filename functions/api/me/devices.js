import { getAuthUser, sha256Hex, json, handleOptions } from '../_utils.js'

export function toDeviceList(rows, currentTokenHash) {
  return (rows ?? []).map(r => ({
    id: r.id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    current: r.token_hash === currentTokenHash,
  }))
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const currentTokenHash = await sha256Hex(bearer)
  const now = Math.floor(Date.now() / 1000)

  if (request.method === 'GET') {
    const r = await env.DB.prepare(
      'SELECT id, token_hash, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC'
    ).bind(user.id, now).all()
    return json({ devices: toDeviceList(r.results, currentTokenHash) })
  }

  if (request.method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Body inválido' }, 400)
    }
    const action = body?.action

    if (action === 'revoke-others') {
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
        .bind(user.id, currentTokenHash).run()
      return json({ ok: true })
    }

    if (action === 'revoke') {
      const id = Number(body?.id)
      if (!Number.isInteger(id) || id <= 0) return json({ error: 'id inválido' }, 400)
      await env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').bind(id, user.id).run()
      return json({ ok: true })
    }

    return json({ error: 'Ação inválida' }, 400)
  }

  return json({ error: 'Method not allowed' }, 405)
}
