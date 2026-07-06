import { getAuthUser, logAdminAction, checkRateLimitKV, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const coach = await getAuthUser(request, env)
  if (!coach) return json({ error: 'Unauthorized' }, 401)
  if (coach.role !== 'coach') return json({ error: 'Forbidden' }, 403)

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!(await checkRateLimitKV(env, ip, Date.now(), 'admin'))) {
    return json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId <= 0) return json({ error: 'userId inválido' }, 400)
  if (userId === coach.id) return json({ error: 'Você não pode excluir sua própria conta por aqui' }, 400)

  const target = await env.DB.prepare('SELECT id, username, role FROM users WHERE id = ?').bind(userId).first()
  if (!target) return json({ error: 'Conta não encontrada' }, 404)
  if (target.role !== 'player') return json({ error: 'Só é possível excluir contas de jogador' }, 403)

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  await logAdminAction(env, coach.id, 'delete_user', userId, { username: target.username })

  return json({ ok: true })
}
