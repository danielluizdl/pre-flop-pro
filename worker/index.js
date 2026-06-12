/**
 * Cloudflare Worker — Pre-Flop Pro Admin
 *
 * Env vars (configure em Workers > Settings > Variables):
 *   ADMIN_PASSWORD  — senha para publicar ranges (também é a chave HMAC do token)
 *   GITHUB_TOKEN    — Personal Access Token (fine-grained) com contents:write no repo
 *   GITHUB_OWNER    — "danielluizdl"
 *   GITHUB_REPO     — "pre-flop-pro"
 *   GITHUB_BRANCH   — "main" (opcional, default "main")
 *
 * Rate limit em memória (Map no escopo do módulo): best-effort, reseta a cada
 * isolate. Para proteção robusta, complementar com regra de WAF na rota.
 */

const FILE_PATH = 'src/data/adminRanges.json'

const ALLOWED_ORIGINS = ['https://danielluizdl.github.io', 'http://localhost:5173']

const TOKEN_TTL_MS = 30 * 60 * 1000

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000

const passwordAttempts = new Map()

export function corsOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function constantTimeEqualBytes(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function sha256Bytes(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return new Uint8Array(buf)
}

export async function passwordMatches(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false
  if (received.length === 0 || expected.length === 0) return false
  const a = await sha256Bytes(received)
  const b = await sha256Bytes(expected)
  return constantTimeEqualBytes(a, b)
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bufToHex(sig)
}

export async function generateToken(secret, now = Date.now(), ttlMs = TOKEN_TTL_MS) {
  const expiresAt = now + ttlMs
  const payload = `v1.${expiresAt}`
  const sig = await hmacSha256Hex(secret, payload)
  return { token: `${payload}.${sig}`, expiresAt }
}

export async function verifyToken(secret, token, now = Date.now()) {
  if (typeof token !== 'string') return { valid: false, reason: 'malformed' }
  const parts = token.split('.')
  if (parts.length !== 3) return { valid: false, reason: 'malformed' }
  const [v, expStr, sig] = parts
  const expiresAt = Number(expStr)
  if (v !== 'v1' || !Number.isFinite(expiresAt)) return { valid: false, reason: 'malformed' }
  const expected = await hmacSha256Hex(secret, `${v}.${expStr}`)
  if (!constantTimeEqualHex(sig, expected)) return { valid: false, reason: 'bad_signature' }
  if (now > expiresAt) return { valid: false, reason: 'expired' }
  return { valid: true, expiresAt }
}

export function checkRateLimit(ip, now = Date.now(), store = passwordAttempts) {
  const recent = (store.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    store.set(ip, recent)
    return false
  }
  recent.push(now)
  store.set(ip, recent)
  return true
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin)
    }

    if (request.method !== 'POST') {
      return cors(new Response('Method not allowed', { status: 405 }), origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return cors(new Response('Invalid JSON', { status: 400 }), origin)
    }

    const { password, ranges, action } = body
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'

    if (action === 'validate') {
      if (!checkRateLimit(ip)) {
        return cors(json({ code: 'rate_limited', message: 'Muitas tentativas. Aguarde um minuto.' }, 429), origin)
      }
      if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
        return cors(new Response('Unauthorized', { status: 401 }), origin)
      }
      const { token, expiresAt } = await generateToken(env.ADMIN_PASSWORD)
      return cors(json({ ok: true, token, expiresAt }), origin)
    }

    // Publish: aceita Bearer token OU senha no body
    const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    let authorized = false
    if (bearer) {
      const result = await verifyToken(env.ADMIN_PASSWORD, bearer)
      authorized = result.valid
    }
    if (!authorized) {
      if (!checkRateLimit(ip)) {
        return cors(json({ code: 'rate_limited', message: 'Muitas tentativas. Aguarde um minuto.' }, 429), origin)
      }
      authorized = await passwordMatches(password, env.ADMIN_PASSWORD)
    }
    if (!authorized) {
      return cors(new Response('Unauthorized', { status: 401 }), origin)
    }

    if (!Array.isArray(ranges)) {
      return cors(new Response('ranges must be an array', { status: 400 }), origin)
    }

    const owner  = env.GITHUB_OWNER  ?? 'danielluizdl'
    const repo   = env.GITHUB_REPO   ?? 'pre-flop-pro'
    const branch = env.GITHUB_BRANCH ?? 'main'
    const token  = env.GITHUB_TOKEN

    if (!token) {
      return cors(json({ code: 'missing_token', message: 'GITHUB_TOKEN não configurado no Worker' }, 500), origin)
    }

    const gh = (path, opts = {}) => fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'pre-flop-pro-worker',
        ...(opts.headers ?? {}),
      },
    })

    // 1. Get current branch tip
    const refRes = await gh(`/git/ref/heads/${branch}`)
    if (refRes.status === 401) {
      return cors(json({ code: 'invalid_token', message: 'GITHUB_TOKEN inválido ou expirado' }, 500), origin)
    }
    if (!refRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao buscar ref: HTTP ${refRes.status}` }, 502), origin)
    }
    const { object: { sha: commitSha } } = await refRes.json()

    // 2. Get base tree SHA from commit
    const commitRes = await gh(`/git/commits/${commitSha}`)
    if (!commitRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao buscar commit: HTTP ${commitRes.status}` }, 502), origin)
    }
    const { tree: { sha: treeSha } } = await commitRes.json()

    // 3. Create blob with file content
    const content = JSON.stringify({ version: Date.now(), ranges })
    const blobRes = await gh('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content, encoding: 'utf-8' }),
    })
    if (!blobRes.ok) {
      const errText = await blobRes.text()
      return cors(json({ code: 'github_error', message: `Erro ao criar blob: ${errText.slice(0, 200)}` }, 502), origin)
    }
    const { sha: blobSha } = await blobRes.json()

    // 4. Create new tree
    const treeRes = await gh('/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: treeSha,
        tree: [{ path: FILE_PATH, mode: '100644', type: 'blob', sha: blobSha }],
      }),
    })
    if (!treeRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao criar tree: HTTP ${treeRes.status}` }, 502), origin)
    }
    const { sha: newTreeSha } = await treeRes.json()

    // 5. Create commit
    const newCommitRes = await gh('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `chore: update admin ranges [${new Date().toISOString().slice(0, 10)}]`,
        tree: newTreeSha,
        parents: [commitSha],
      }),
    })
    if (!newCommitRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao criar commit: HTTP ${newCommitRes.status}` }, 502), origin)
    }
    const { sha: newCommitSha } = await newCommitRes.json()

    // 6. Update branch ref
    const updateRes = await gh(`/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitSha }),
    })
    if (!updateRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao atualizar ref: HTTP ${updateRes.status}` }, 502), origin)
    }

    return cors(json({ ok: true }), origin)
  },
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(response, origin) {
  const headers = new Headers(response.headers)
  const allowed = corsOrigin(origin)
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', allowed)
    headers.set('Vary', 'Origin')
  }
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return new Response(response.body, { status: response.status, headers })
}
