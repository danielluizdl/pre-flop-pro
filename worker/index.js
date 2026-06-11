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

    const { password, ranges, action } = body

    if (!password || password !== env.ADMIN_PASSWORD) {
      return cors(new Response('Unauthorized', { status: 401 }))
    }

    if (action === 'validate') {
      return cors(json({ ok: true }))
    }

    if (!Array.isArray(ranges)) {
      return cors(new Response('ranges must be an array', { status: 400 }))
    }

    const owner  = env.GITHUB_OWNER  ?? 'danielluizdl'
    const repo   = env.GITHUB_REPO   ?? 'pre-flop-pro'
    const branch = env.GITHUB_BRANCH ?? 'main'
    const token  = env.GITHUB_TOKEN

    if (!token) {
      return cors(json({ code: 'missing_token', message: 'GITHUB_TOKEN não configurado no Worker' }, 500))
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
      return cors(json({ code: 'invalid_token', message: 'GITHUB_TOKEN inválido ou expirado' }, 500))
    }
    if (!refRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao buscar ref: HTTP ${refRes.status}` }, 502))
    }
    const { object: { sha: commitSha } } = await refRes.json()

    // 2. Get base tree SHA from commit
    const commitRes = await gh(`/git/commits/${commitSha}`)
    if (!commitRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao buscar commit: HTTP ${commitRes.status}` }, 502))
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
      return cors(json({ code: 'github_error', message: `Erro ao criar blob: ${errText.slice(0, 200)}` }, 502))
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
      return cors(json({ code: 'github_error', message: `Erro ao criar tree: HTTP ${treeRes.status}` }, 502))
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
      return cors(json({ code: 'github_error', message: `Erro ao criar commit: HTTP ${newCommitRes.status}` }, 502))
    }
    const { sha: newCommitSha } = await newCommitRes.json()

    // 6. Update branch ref
    const updateRes = await gh(`/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitSha }),
    })
    if (!updateRes.ok) {
      return cors(json({ code: 'github_error', message: `Erro ao atualizar ref: HTTP ${updateRes.status}` }, 502))
    }

    return cors(json({ ok: true }))
  },
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(response) {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return new Response(response.body, { status: response.status, headers })
}
