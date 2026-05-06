/**
 * Cloudflare Worker — Pre-Flop Pro Admin
 *
 * Env vars (configure em Workers > Settings > Variables):
 *   ADMIN_PASSWORD  — senha para publicar ranges
 *   GITHUB_TOKEN    — Personal Access Token com escopo "repo"
 *   GITHUB_OWNER    — "danielluizdl"
 *   GITHUB_REPO     — "pre-flop-pro"
 *   GITHUB_BRANCH   — "main" (opcional, default "main")
 */

const FILE_PATH = 'src/data/adminRanges.json'

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }))
    }

    if (request.method !== 'POST') {
      return cors(new Response('Method not allowed', { status: 405 }))
    }

    let body
    try {
      body = await request.json()
    } catch {
      return cors(new Response('Invalid JSON', { status: 400 }))
    }

    const { password, ranges } = body

    if (!password || password !== env.ADMIN_PASSWORD) {
      return cors(new Response('Unauthorized', { status: 401 }))
    }

    if (!Array.isArray(ranges)) {
      return cors(new Response('ranges must be an array', { status: 400 }))
    }

    const owner  = env.GITHUB_OWNER  ?? 'danielluizdl'
    const repo   = env.GITHUB_REPO   ?? 'pre-flop-pro'
    const branch = env.GITHUB_BRANCH ?? 'main'
    const token  = env.GITHUB_TOKEN

    if (!token) {
      return cors(new Response('Server misconfigured: missing GITHUB_TOKEN', { status: 500 }))
    }

    // 1. Fetch current file SHA (required for update)
    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}?ref=${branch}`
    const fileRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'pre-flop-pro-worker',
      },
    })

    let sha
    if (fileRes.ok) {
      const fileData = await fileRes.json()
      sha = fileData.sha
    } else if (fileRes.status !== 404) {
      return cors(new Response('Failed to fetch file from GitHub', { status: 502 }))
    }

    // 2. Encode content as base64
    const content = JSON.stringify(ranges, null, 2)
    const encoded = btoa(unescape(encodeURIComponent(content)))

    // 3. Commit updated file
    const putBody = {
      message: `chore: update admin ranges [${new Date().toISOString().slice(0, 10)}]`,
      content: encoded,
      branch,
      ...(sha ? { sha } : {}),
    }

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'pre-flop-pro-worker',
      },
      body: JSON.stringify(putBody),
    })

    if (!putRes.ok) {
      const errText = await putRes.text()
      return cors(new Response(`GitHub API error: ${errText}`, { status: 502 }))
    }

    return cors(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  },
}

function cors(response) {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return new Response(response.body, { status: response.status, headers })
}
