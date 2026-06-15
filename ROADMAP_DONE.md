# Roadmap Camadas 0–3 — Concluído

Branch: `feature/auth-telemetry` (NÃO mesclada para `main` — ver item 4).

## 1. Último commit
`adc006c82b954001c882b19bd04358fd0d701c72`

## 2. O que foi implementado por bloco

### Bloco A — Reset de senha pelo coach
- `functions/api/admin/reset-password.js` (coach-only): valida `userId` inteiro, gera senha temporária (`randomHex(5)` → 10 chars), grava novo `password_hash`+`salt`+`first_login=1` e apaga sessões antigas do alvo (`DELETE FROM sessions WHERE user_id=?`). Retorna `{ ok, tempPassword }`.
- CoachPanel aba "Por jogador": botão "Resetar senha" por jogador exibindo a senha temporária copiável.
- Fluxo de senha temporária: `signup` passa a gravar `first_login=0` (o usuário escolhe a própria senha); o WelcomeModal é dirigido pelo flag transiente `justSignedUp`. Login com `first_login=1` (somente após reset do coach) força o `ChangePasswordModal` até definir nova senha.

### Bloco B — Rate limit + Turnstile no auth
- Rate limit best-effort por `CF-Connecting-IP` em `_utils.checkRateLimit` (Map por isolate, 8/min → 429), aplicado a `auth/signup` e `auth/login`. Best-effort: reseta a cada novo isolate; complementar com WAF.
- Turnstile: `_utils.verifyTurnstile` valida via `siteverify` com `TURNSTILE_SECRET_KEY`; widget no `LoginPage` (`Turnstile.tsx`) com site key de `VITE_TURNSTILE_SITE_KEY`. **Fail-open**: sem o secret no backend a validação é ignorada (console.warn); sem o site key no front o widget não renderiza e o app segue normal.

### Bloco C — Rotas (react-router) + Dashboard do jogador
- `react-router-dom` + `RouterSync.tsx`: espelha URL ↔ `page` do store (navigate no `setPage`; `page` no popstate/F5/deep-link). Rotas: `/dashboard`, `/ranges`, `/drill`, `/historico`, `/coach`. Páginas transientes do fluxo de criação (`range-setup`/`editor`/`table-editor`/`categoria`) têm rota mas caem em `/ranges` se acessadas sem estado.
- `public/_redirects` (`/* /index.html 200`) para fallback SPA do Cloudflare Pages. `base` mantido em `/`.
- Dashboard do jogador logado: `MyAccountStats` (nuvem) + `AccuracySparkline` reaproveitados.

### Bloco D — E-mails transacionais (Resend, fail-open)
- `functions/api/_email.js` → `sendEmail(env, {to, subject, html})` via API do Resend (`RESEND_API_KEY` + `EMAIL_FROM`). **Fail-open**: sem a chave faz console.warn e retorna sem erro.
- Disparos best-effort (try/catch, não bloqueiam a resposta): boas-vindas no `signup` e senha temporária no reset do coach.

### Bloco E — Ranges centralizados no D1 (com fallback, adminRanges.json mantido)
- `schema_v3.sql` (aditivo): `team_ranges` (id, data JSON, version, updated_at, updated_by) + `team_ranges_meta` (version) + índice.
- `functions/api/ranges/list.js` (GET, qualquer jogador logado): retorna `{ version, ranges }`. Tabelas ausentes → responde vazio.
- `functions/api/admin/ranges/publish.js` (coach-only): upsert do conjunto via `env.DB.batch` (DELETE + INSERTs) incrementando a versão global.
- Store: `syncTeamRanges` (sobrepõe ranges do time por id, preserva os do usuário, gated por `localStorage['team-ranges-version']`) chamado no login/restore; `publishTeamRanges` (coach). `adminRanges.json` permanece como seed/fallback (import e bundle intactos). Lista vazia ou falha → comportamento atual inalterado.
- CoachPanel: botão "Publicar ranges para o time (D1)". Publicação via worker/GitHub existente foi mantida.

### Bloco F — E2E + Observabilidade + Performance
- Playwright: `@playwright/test`, `playwright.config.ts`, script `npm run e2e` (builda e roda contra o `vite preview`). Testes em `e2e/`: login renderiza, signup revela "Código do time", forgot mostra orientação, e navegação entre rotas + deep-link com backend mockado (sem credenciais reais nem D1). Não interfere no `npm test` (vitest só inclui `src/**/*.test.ts` e `worker/**/*.test.js`).
- Sentry: `src/utils/sentry.ts` inicializa só com `VITE_SENTRY_DSN` (fail-open); `ErrorBoundary.componentDidCatch` chama `captureError`.
- Performance: `CoachPanel`/`TrainerPage`/`StatsPage` via `React.lazy`/`Suspense`; `AccuracySparkline` extraído para módulo próprio. Chunk principal caiu de ~522KB para ~461KB (chunks separados de CoachPanel ~26KB, TrainerPage ~36KB, StatsPage ~13KB).

## Pendente / pulado
- **PWA/offline**: fora do escopo desta rodada (excluído pelo enunciado).
- **`npx playwright install`** não rodou neste ambiente (download de browser bloqueado pela rede). Os testes E2E estão configurados e devem rodar localmente após `npx playwright install chromium`.
- **Otimização de bundle do `adminRanges.json`** (remover do bundle quando o D1 for a fonte): deixada como passo manual futuro — o JSON segue como seed/fallback de propósito.

## 3. Passos manuais do usuário

### Migração de schema (D1)
```
npx wrangler d1 execute preflop-db --file=schema_v3.sql --remote
```
(Aditiva, sem DROP. Seed inicial dos team_ranges acontece no primeiro "Publicar ranges para o time (D1)" no CoachPanel.)

### Secrets no Cloudflare Pages (configurar em Production E Preview)
- `TURNSTILE_SITE_KEY` (referência) e `VITE_TURNSTILE_SITE_KEY` (build do front — site key público do widget)
- `TURNSTILE_SECRET_KEY` (validação `siteverify` no backend)
- `RESEND_API_KEY` (envio de e-mails)
- `EMAIL_FROM` (remetente verificado no Resend, ex.: `Pre-Flop Pro <no-reply@seudominio.com>`)
- `VITE_SENTRY_DSN` (observabilidade do front)

Todas são opcionais por design (fail-open): faltando qualquer uma, o recurso correspondente é ignorado e o app continua funcionando — signup/login nunca quebram por falta de secret.

## 4. Merge para `main`
O MERGE para `main` **NÃO foi feito de propósito** — o usuário mantém o link de produção antigo intencionalmente. Não mesclar sem pedido explícito.
