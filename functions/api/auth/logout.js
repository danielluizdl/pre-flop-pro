import { sha256Hex, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (bearer) {
    const tokenHash = await sha256Hex(bearer)
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
  }
  return json({ ok: true })
}
