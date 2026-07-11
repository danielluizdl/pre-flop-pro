export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const PBKDF2_ITERATIONS = 100000

async function pbkdf2Hex(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' },
    key, 256,
  )
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password, salt) {
  const hex = await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${hex}`
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function isLegacyHash(storedHash) {
  return typeof storedHash === 'string' && !storedHash.startsWith('pbkdf2$')
}

export async function verifyPassword(password, salt, storedHash) {
  if (typeof storedHash !== 'string' || typeof salt !== 'string') return false
  if (storedHash.startsWith('pbkdf2$')) {
    const [, itersStr, expected] = storedHash.split('$')
    const iterations = Number(itersStr)
    if (!Number.isInteger(iterations) || iterations <= 0) return false
    const hex = await pbkdf2Hex(password, salt, iterations)
    return constantTimeEqual(hex, expected)
  }
  const legacy = await sha256Hex(salt + ':' + password)
  return constantTimeEqual(legacy, storedHash)
}

// Equaliza o custo de CPU quando o usuário não existe, para não vazar
// quem está cadastrado via timing da resposta de login.
export async function equalizeTiming(password) {
  await pbkdf2Hex(typeof password === 'string' ? password : '', 'equalize-timing-salt', PBKDF2_ITERATIONS)
}

export function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function getAuthUser(request, env) {
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return null
  const tokenHash = await sha256Hex(bearer)
  const now = Math.floor(Date.now() / 1000)
  return await env.DB.prepare(
    'SELECT u.id, u.username, u.name, u.email, u.role, u.first_login, u.tier, u.turma FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(tokenHash, now).first() ?? null
}

export async function emailDomainExists(domain) {
  // DNS over HTTPS: domínio precisa ter MX ou A. Fail-open se o DoH falhar.
  try {
    for (const type of ['MX', 'A']) {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
        headers: { Accept: 'application/dns-json' },
      })
      if (!res.ok) return true
      const data = await res.json()
      if (Array.isArray(data.Answer) && data.Answer.length > 0) return true
    }
    return false
  } catch { return true }
}

export function isUuidOrNull(v) {
  if (v === null || v === undefined) return true
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export function isHand(v) {
  return typeof v === 'string' && v.length <= 4 && /^[AKQJT2-9]{2}[so]?$/.test(v)
}

export function isShortStr(v, max) {
  return typeof v === 'string' && v.length <= max
}

// Valida um grid esparso (só as mãos jogáveis, formato de src/utils/sparseGrid.ts)
// vindo do cliente antes de gravar em D1 — usado pelo replay do Range Check
// (userGrid/answerGrid). Cada célula tem fold/call/raise/allin numéricos
// 0-100, extra opcional e size opcional (número ou texto curto do raise).
export function validateSparseGrid(v) {
  if (v === null || v === undefined) return true
  if (typeof v !== 'object' || Array.isArray(v)) return false
  const keys = Object.keys(v)
  if (keys.length > 169) return false
  for (const k of keys) {
    if (!isHand(k)) return false
    const cell = v[k]
    if (!cell || typeof cell !== 'object') return false
    for (const f of ['fold', 'call', 'raise', 'allin']) {
      if (typeof cell[f] !== 'number' || !Number.isFinite(cell[f]) || cell[f] < 0 || cell[f] > 100) return false
    }
    if (cell.extra !== undefined && (typeof cell.extra !== 'number' || !Number.isFinite(cell.extra) || cell.extra < 0 || cell.extra > 100)) return false
    if (cell.size !== undefined && typeof cell.size !== 'number' && !isShortStr(cell.size, 20)) return false
  }
  return true
}

// Rate limit em memória (Map no escopo do módulo): best-effort, reseta a cada
// novo isolate do Pages Functions. Complementar com WAF/Turnstile no Cloudflare.
const RATE_LIMIT_MAX = 8
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const authAttempts = new Map()
const adminAttempts = new Map()

export function checkRateLimit(ip, now = Date.now(), store = authAttempts) {
  const recent = (store.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    store.set(ip, recent)
    return false
  }
  recent.push(now)
  store.set(ip, recent)
  return true
}

// Rate limit persistente via KV (janela fixa por IP). Sobrevive a troca de
// isolate, ao contrário do Map em memória. Fail-open: sem binding KV cai no
// in-memory; se o KV falhar, libera (nunca trava login legítimo por infra).
// `scope` isola o balde de tentativas (ex.: 'auth' vs 'admin') para que ações
// administrativas não consumam/disputem o mesmo limite de login/signup do IP.
export async function checkRateLimitKV(env, ip, now = Date.now(), scope = 'auth') {
  const store = scope === 'admin' ? adminAttempts : authAttempts
  if (!env || !env.RATE_LIMIT) return checkRateLimit(ip, now, store)
  const key = `rl:${scope}:${ip}`
  const windowSec = RATE_LIMIT_WINDOW_MS / 1000
  const nowSec = Math.floor(now / 1000)
  try {
    const raw = await env.RATE_LIMIT.get(key)
    let count = 0
    let reset = nowSec + windowSec
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.e === 'number' && nowSec < parsed.e) {
        count = typeof parsed.c === 'number' ? parsed.c : 0
        reset = parsed.e
      }
    }
    if (count >= RATE_LIMIT_MAX) return false
    await env.RATE_LIMIT.put(key, JSON.stringify({ c: count + 1, e: reset }), { expirationTtl: windowSec })
    return true
  } catch {
    console.warn('KV rate limit falhou — fail-open')
    return true
  }
}

// Skeleton repetido nos endpoints de admin (create/update/delete-user,
// reset-password, create-invite-code): exige coach autenticado e aplica o
// rate limit no escopo 'admin'. Retorna { coach } em caso de sucesso, ou
// { response } já pronto pro chamador devolver (early return).
export async function requireCoach(request, env) {
  const coach = await getAuthUser(request, env)
  if (!coach) return { response: json({ error: 'Unauthorized' }, 401) }
  if (coach.role !== 'coach') return { response: json({ error: 'Forbidden' }, 403) }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!(await checkRateLimitKV(env, ip, Date.now(), 'admin'))) {
    return { response: json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429) }
  }
  return { coach }
}

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.warn('TURNSTILE_SECRET_KEY ausente — validação Turnstile ignorada (fail-open)')
    return true
  }
  if (!token) return false
  try {
    const form = new URLSearchParams()
    form.set('secret', env.TURNSTILE_SECRET_KEY)
    form.set('response', token)
    if (ip) form.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    const data = await res.json()
    return !!data.success
  } catch {
    // Secret configurado mas o siteverify falhou: fail-CLOSED (não deixa
    // passar sem verificar). O fail-open só vale quando não há secret.
    console.warn('Turnstile siteverify falhou — fail-closed (secret presente)')
    return false
  }
}

const ALLOWED_ORIGIN_EXACT = new Set([
  'https://pre-flop-pro.pages.dev',
  'https://danielluizdl.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])

export function isAllowedOrigin(origin) {
  if (typeof origin !== 'string' || !origin) return false
  if (ALLOWED_ORIGIN_EXACT.has(origin)) return true
  return /^https:\/\/[a-z0-9-]+\.pre-flop-pro\.pages\.dev$/i.test(origin)
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

// Escapa texto controlado pelo usuário (ex.: nome) antes de interpolar em
// templates de e-mail HTML — evita quebra de layout/injeção de markup.
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c])
}

// Log de auditoria best-effort das ações administrativas (criar/editar/
// excluir conta, resetar senha, gerar código de convite). Nunca trava a ação
// principal — se a tabela ainda não existir (migração pendente) ou o insert
// falhar, engole o erro silenciosamente, igual ao padrão fail-open do projeto.
export async function logAdminAction(env, actorId, action, targetId, detail) {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_audit_log (actor_id, action, target_id, detail) VALUES (?, ?, ?, ?)'
    ).bind(actorId, action, targetId ?? null, detail ? JSON.stringify(detail) : null).run()
  } catch { /* best-effort */ }
}
