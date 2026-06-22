# Handoff — Agente Diário (Pre-Flop Pro)

## 2026-06-22 (segunda — testes/qualidade)

### Feito hoje
- Cobertura de testes para `src/utils/sentry.ts` (#3, fechada): `sentry.test.ts` com 7 casos — mock de `@sentry/react`, controle de `VITE_SENTRY_DSN` via `vi.stubEnv` + import dinâmico. Cobre `sentryEnabled`, `initSentry` (fail-open) e `captureError`. Sem tocar init real/DSN/segredos.
- Auditoria de segurança (a pedido do Daniel, a partir de vídeo sobre SaaS): repo OK no essencial (sem segredo no histórico; `.gitignore` adequado; `.env.production` só com vars `VITE_` públicas; erros da API não vazam stack/estrutura). Fatia hygiene: `npm audit fix` (2 CVEs high: vite/undici → 0 vuln) + `.github/dependabot.yml`.
- **Hardening N1–N4 (Daniel AUTORIZOU quebrar o gate nesta sessão):**
  - N1: `hashPassword` → PBKDF2-HMAC-SHA256 100k iters, formato `pbkdf2$<iters>$<hash>`; `verifyPassword` valida pbkdf2+legado com `constantTimeEqual`; `login.js` re-hash progressivo do legado + `equalizeTiming` anti-enumeração. Sem migration (coluna TEXT). `functions/api/_utils.test.js` (11 casos); vitest passou a incluir `functions/**`.
  - N2: Turnstile fail-CLOSED quando há secret (antes fail-open em erro). Rate limit "real" (WAF/KV) segue gate — exige wrangler/painel.
  - N3: `public/_headers` (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP). **CSP NÃO validada em runtime — precisa click-through no preview antes do merge.** + **CORS por allowlist** via `functions/_middleware.js` (remove o `*`; ecoa ACAO só p/ produção/previews/localhost via `isAllowedOrigin`). Sem tocar os 17 handlers.
  - N4: Sentry `beforeSend` com scrub de PII (e-mail/token/Authorization) + `sendDefaultPii:false`. **Gestão de sessões** (`functions/api/me/devices.js`: GET lista + POST revoke/revoke-others, escopado por user_id, sem vazar token_hash) + UI "Sessões ativas" no `MyAccountStats` (store: listDevices/revokeDevice/revokeOtherDevices). Sem migration (usa colunas existentes; não há device/IP).

### Estado
- Testes: 214 passam (22 arquivos). Build: verde.
- Warning conhecido: chunk principal ~550KB > 500KB (issue #4). `CoachPanel` já é lazy.
- Branch de trabalho: `auto/daily-improvements` (a partir de `feature/auth-telemetry`).
- PR: #5 ABERTA (auto/daily-improvements → feature/auth-telemetry). NÃO mergeada (gate humano).
- **Riscos:** (1) CSP do N3 pode quebrar Turnstile/Sentry/publish-do-coach — VALIDAR no preview. (2) PBKDF2 100k: confirmar que cabe no limite de CPU do plano Cloudflare Pages (nativo é rápido, mas medir no preview). (3) Turnstile fail-closed: se algum ambiente NÃO tiver o secret, login segue fail-open; com secret, erro de rede agora bloqueia.

### Próximas tarefas (priorizadas)
1. **VALIDAR hardening no preview** (Daniel/humano, antes de mergear #5): CSP (login c/ Turnstile, erro pro Sentry, publish do coach), login de conta antiga (re-hash legado), CPU do PBKDF2. Critério: preview funcional sem violação de CSP no console.
2. **#2 — atualizar CLAUDE.md** (doc interna). Documentar Auth/, Coach*, TopNav/RouterSync, MyAccountStats, CategoryDetailPage e utils; agora também a seção de segurança (PBKDF2, _headers/CSP, scrub Sentry).
3. **#4 — code-split do chunk principal** (performance). Revisar `manualChunks` em `vite.config.ts` (vendor react/zustand) OU lazy-load de página pesada. Pronto: warning some/reduz, antes/depois em KB.

### Propostas (gate humano) — restante de segurança ainda NÃO feito
- **N2 rate limit real:** WAF Rate Limiting Rules em `/api/auth/*` ou KV/Durable Object (exige wrangler.toml/painel — fora do agente). Issue #6. ÚNICO item de código restante, mas bloqueado por infra.
- **Operacional (só Daniel):** GitHub Secret Scanning + Push Protection; MFA em GitHub/Cloudflare.
- **Validar no preview** (antes de mergear #5): CSP, login de conta legada (re-hash), CPU do PBKDF2, e a seção "Sessões ativas" (listar/revogar/revogar-outras).
- Lembrete geral: auth/, worker/, functions/api, schema*.sql/D1 NÃO são implementáveis pelo agente sem autorização explícita do Daniel (como nesta sessão).
