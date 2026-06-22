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
    'SELECT u.id, u.username, u.name, u.email, u.role, u.first_login FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
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

// Rate limit em memória (Map no escopo do módulo): best-effort, reseta a cada
// novo isolate do Pages Functions. Complementar com WAF/Turnstile no Cloudflare.
const RATE_LIMIT_MAX = 8
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const authAttempts = new Map()

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

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
