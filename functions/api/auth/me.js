import { getAuthUser, json, handleOptions } from '../_utils.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const user = await getAuthUser(request, env)
  if (!user) return json({ error: 'Não autenticado' }, 401)

  return json({ user: { id: user.id, username: user.username, role: user.role, first_login: user.first_login } })
}
