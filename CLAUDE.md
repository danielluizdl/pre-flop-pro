# Pre-Flop Pro — Guia do Projeto

## Stack
- **Vite + React 19 + TypeScript + Tailwind CSS 4 + Zustand**
- Sem backend. Dados persistidos via `localStorage` manualmente (exceto `darkMode` que usa `zustand/persist`).
- **Tema (dark/claro):** app tem os dois temas, chaveados pela classe `dark` no `<html>` (aplicada em `main.tsx` antes do 1º paint e sincronizada por effect no `AppLayout` a partir de `store.darkMode`; default `true`, persist `fbr-ui-state` v1 com `migrate` que força dark p/ estado v0). Implementação por **tokens CSS por escopo** em `src/index.css`: `@theme` guarda os valores dark; `:root:not(.dark)` injeta a rampa `warm-*` INVERTIDA (fundo claro/texto escuro) + versões escuras dos tons frios usados como texto (`red-400`, `emerald-400`, `yellow-400`, `gold`, `result-*` etc.); o seletor `.dark` restaura os valores exatos em qualquer subtree. A **área da mesa de poker** (caixa do drill no TrainerPage e mesa do TableEditorPage) acompanha o tema via `var(--table-box-bg)`/`var(--table-box-shadow)` no container e `var(--felt-1..3)` no feltro (`PokerTable.module.css`) — as vars só existem no claro (bege + feltro marrom médio); no escuro caem nos fallbacks inline com os valores originais. Há `@custom-variant dark` (class-based) disponível para utilitários `dark:`. **Regras:** cores de AÇÃO (raise/call/all-in/extra) não mudam entre temas; matrizes 13×13 (HandMatrix/RangeActionGrid/RangeHeatGrid) mantêm células de fundo escuro nos dois temas (de propósito — não "clarear"); `text-white` só sobre fundos coloridos fixos, em superfície warm usar `text-warm-100`; hex inline novo deve usar `var(--color-warm-*)` se a superfície acompanha o tema.
- Deploy: GitHub Pages via GitHub Actions ao fazer push para `main` (`https://github.com/danielluizdl/pre-flop-pro`)
- **CI** (`.github/workflows/`): `deploy.yml` builda em push pra `main` (sem rodar testes). **`pr-checks.yml` (06/07, novo)** roda `npm test` + `npm run build` em todo Pull Request mirando `main` **ou** `feature/auth-telemetry` — antes disso os 994+ testes só rodavam quando alguém lembrava de rodar `npm test` manualmente antes de mergear.
- **POLÍTICA DE PRODUÇÃO (CONGELADA):** o link em uso pelos jogadores é **`https://danielluizdl.github.io/pre-flop-pro/`** (GitHub Pages, deploy do `main`). Ele deve ficar **INTACTO** até o site novo estar completo. Portanto: **NÃO mergear nada no `main`** e **NÃO mexer no que afeta o GitHub Pages** até liberação explícita do Daniel. Todo o desenvolvimento do "site completo" acontece na branch dedicada **`feature/auth-telemetry`** (e branches derivadas, ex.: `auto/daily-improvements` do agente), validadas no preview do Cloudflare Pages. Obs.: `public/_headers` (CSP/headers) só vale no Cloudflare Pages — o GitHub Pages o ignora, então mexer nele nunca afeta o link de produção.
- Testes: **Vitest** (`npm test` → `vitest run`), ambiente jsdom. Specs em `src/**/*.test.ts`, **`src/**/*.test.tsx`** (componentes), `worker/**/*.test.js`, `functions/**/*.test.js` (ver `vitest.config.ts`). Testes de componente com **React Testing Library** + `@testing-library/jest-dom` + **`jest-axe`** (a11y); setup em `src/test/setup.ts`; exemplo-padrão `src/components/ui/ComboCounter.test.tsx`. **1015 testes verdes (85 arquivos)** — suíte de testes + a11y já coberta. Ver `.agent/handoff.md` para o estado atual do agente diário e próximas fatias. **Smoke de render:** `npm run smoke` (`smoke/smoke.mjs`) builda, serve o dist e verifica no Chromium headless (playwright-core, browser do ambiente/`SMOKE_CHROMIUM`) que o app renderiza de verdade: #root monta, RouterSync (clique/back/F5), drill completo com ranges seedados e painel coach (backend stubado via page.route, rede externa bloqueada). Rodar antes de mergear mudanças de dependência/chunks/router — teste+build verdes NÃO garantem render (já houve 2 telas brancas).
- Bundle: `adminRanges.json` (1.4MB) é separado em chunk próprio via `manualChunks` (`vite.config.ts`), que também separa vendors (`vendor-react` = react/react-dom/scheduler **apenas** — react-router fica em `vendor` pois incluí-lo aqui cria ciclo vendor↔vendor-react → tela branca; `vendor-sentry`; `vendor` = restante). Chunk principal do app ~265KB (gzip ~38KB); o único chunk acima de 500KB é o JSON `admin-ranges` (dados, separado de propósito).

## Estrutura de Pastas
```
src/
  components/
    Layout/       AppLayout.tsx, Sidebar.tsx, TopNav.tsx, Dashboard.tsx, RouterSync.tsx, ErrorBoundary.tsx
    RangeBuilder/ RangeEditorPage.tsx, RangeSetupPage.tsx, HandMatrix.tsx, BrushControls.tsx
    TableEditor/  TableEditorPage.tsx
    Trainer/      TrainerPage.tsx
    Situations/   SituationsPage.tsx, CategoryDetailPage.tsx
    Stats/        StatsPage.tsx, MyAccountStats.tsx, AccuracySparkline.tsx
    Auth/         LoginPage.tsx, WelcomeModal.tsx, OnboardingTour.tsx, ChangePasswordModal.tsx, Turnstile.tsx
    Admin/        AdminPanel.tsx (worker legado), RangeHeatGrid.tsx, RangeActionGrid.tsx,
                  CoachPanel/ (06/07, split de CoachPanel.tsx — era 2178 linhas num arquivo
                  só): shared.tsx (usado por 2+ abas: MultiPlayerSelect, RangeSelect,
                  groupRangesByPosition, PeriodFilter, Section, useAnalytics/useRangeGrid/
                  usePlayerRanges, formatDate*/accColor/confChipBg, TH/THR/TD/TDR, tipos
                  CoachUser/Filters), TeamView.tsx (aba Drill: TopHandsPanel,
                  HandDetailCard, PlayerQuickSummary, ConsultRangeDetail — exports
                  preservados p/ CoachPanelParts.test.tsx), RecallView.tsx (aba Range Check
                  + PublishTeamRanges), AdminView.tsx (aba Admin + ConfirmDangerModal),
                  index.tsx (componente CoachPanel + re-export dos exports acima —
                  `import CoachPanel from './CoachPanel'` e `import { X } from
                  './CoachPanel'` em qualquer lugar continuam funcionando sem mudança,
                  pasta+index.tsx resolve igual a um .tsx antigo)
    ui/           PokerTableEditor.tsx, HandQuickSelect.tsx, RangePreviewModal.tsx,
                  ComboCounter.tsx, PrereqRangePicker.tsx, RangeMark.tsx, tableGeometry.ts, PokerTable.module.css
  i18n/           index.ts (Proxy reativo `t`; dicionários pt.ts/en.ts/es.ts — 533 chaves; `setLangDict`+`LANGS`; `LanguageSelect` em Sidebar/LoginPage — no `TopNav` o idioma virou um botão cíclico dentro do menu de perfil, ver seção de nuvem)
  store/          useStore.ts  (toda a lógica de estado)
  types/          index.ts     (tipos, constantes de posições/slots)
  utils/          hands.ts     (ALL_HANDS, makeEmptyGrid, getRngCorrectAction, getRngBands, formatRngBands, getTopFrequencyActions, stackMatchesRange, generateSuits, focusWeight, weightedPick)
                  validateRanges.ts (validateRanges(Range[]) → string[] de problemas legíveis)
                  sparseGrid.ts (encodeSparse/decodeSparse + encodeRange/decodeRange/encodeRanges/decodeRanges)
                  hash.ts (djb2 → hash compacto base36)
                  download.ts (downloadText, backupFilename)
                  eventQueue.ts (fila localStorage de telemetria, cap 500, retry/flush; fireEvent)
                  sentry.ts (init condicional via VITE_SENTRY_DSN; scrub de PII no beforeSend)
                  coachStats.ts / coachTrend.ts / coachRelative.ts / coachFocus.ts (data science do painel coach: Wilson, leakImpact, severityProfile, linreg, z-score)
                  handCategories.ts (categoria da mão + ação correta)
                  rangeCombos.ts (combosOf, rangeComboStats, TOTAL_COMBOS=1326)
  data/           defaultRanges.ts  (ranges nativos, seed no localStorage)
  worker/         index.js (Cloudflare Worker; deploy manual) + index.test.js
  functions/api/  Cloudflare Pages Functions (auth/telemetria/coach — ver seção "Backend de Nuvem")
```

## Tipos Principais (`src/types/index.ts`)
```ts
type RoleType   = 'fold'|'post'|'limp'|'limp-fold'|'open'|'3bet'|'iso'|'call'|'allin'
type TableSize  = 6 | 8
type Page       = 'dashboard'|'editor'|'table-editor'|'ranges'|'drill'|'history'|'range-setup'
type ActionType = 'fold'|'call'|'raise'|'allin'

interface HandData         { fold:number; call:number; raise:number; allin:number; extra?:number; size?:number|string }
interface PositionConfig   { role:RoleType; bet:number; isHero:boolean; stack:number }
interface Scenario         { id:number; data:Record<string,PositionConfig>; pot:string; ante:number; summary:string; heroRaiseSize?:number }
interface Range            { id:number; name:string; positions:string[]; grid:Record<string,HandData>; scenarios:Scenario[]; tableSize:TableSize; customAction?:{label:string;color:string}; stackRange?:string; stackGrids?:StackGrid[]; prereqRangeId?:number }
interface StackGrid        { stackRange:string; grid:Record<string,HandData>; name?:string }
interface BrushState       { call:number; raise:number; allin:number; extra:number; raiseSize:string; extraLabel:string; extraColor:string }
interface HandHistoryEntry { id:number; hand:string; suits:[string,string]; actionTaken:string; correctAction:string; rng:number; correct:boolean; rangeName:string; rangeId:number; stackGridIdx:number; raiseSize?:number|string; stackRange?:string; severity?:'grave'|'impreciso' }
interface SessionStats     { hands:number; correct:number; errors:number; consults:number }
interface TrainingSession  { id:number; timestamp:number; rangeNames:string[]; tableSize:number; hands:number; correct:number; errors:number; consults:number; durationSeconds:number }

SEAT_ROLE_LABELS: Record<RoleType, string>  // labels PT-BR para selects
POS_6MAX / POS_8MAX: PokerPosition[]         // {id, label}
SLOTS_6MAX / SLOTS_8MAX: Slot[]              // {t:%, l:%} posição visual dos assentos
```

## LocalStorage Keys
```
'fbr-ranges-v1'           → Range[]          (ranges salvos — gravados em FORMATO ESPARSO)
'fbr-training-history-v1' → TrainingSession[] (histórico de sessões)
'pfp-hand-perf-v1'        → HandPerfMap       (Record<rangeId, Record<hand, {c,t}>>) — acumulativo
'fbr-ui-state'            → {darkMode, lang}   (zustand persist, version 1 — migrate v0 força darkMode true)
'pfp-last-published-hash' → string           (hash djb2 do último publish — antes guardava o JSON inteiro)
'pfp-team-range-ids'      → number[]         (IDs dos ranges publicados pelo coach — badge "Coach" + edição bloqueada p/ jogador)
'pfp-build-history-v1'    → BuildSession[]   (histórico do modo Range Check: rounds {label,score,attempt} + avgScore)
'admin-ranges-version' / 'fbr-deleted-admin-ids' / 'admin-worker-url'
```

## Formato Esparso de Grids (`src/utils/sparseGrid.ts`)
- `encodeSparse(grid)` guarda só as mãos jogáveis (`fold < 100`); `decodeSparse(grid)` expande a partir de `makeEmptyGrid`.
- **Compat retroativa automática**: `decodeSparse` lê tanto o formato esparso novo quanto o denso antigo (overlay reproduz o denso intacto).
- `saveRanges` grava esparso (alivia cota); `loadRanges`/seed/`importData`/`adminSaveRanges` decodificam/codificam. **Estado em memória é sempre denso (169 mãos)** — o resto do app não muda.
- `adminRanges.json` segue denso até o próximo publish, que o encolhe (worker recebe esparso).

## Robustez / Backup
- **ErrorBoundary** (`src/components/Layout/ErrorBoundary.tsx`) envolve o app em `main.tsx`: em erro de render mostra a mensagem, botão Recarregar e botão "Exportar backup e resetar dados locais" (download do backup + dupla confirmação → limpa chaves `fbr-*`/`pfp-*` e recarrega).
- **Cota de localStorage**: `saveRanges`/`saveHistory`/`saveHandPerf` passam por `trySave` (try/catch). Falha seta `storageBlocked` no store (via `storageErrorReporter`) e exibe banner persistente no topo (`AppLayout`). Save bem-sucedido limpa o aviso.
- **Backup** (Dashboard): `exportData()` baixa JSON `{ version, ranges, trainingHistory, handPerformance }`; `importData(json)` valida com `validateRanges` e **substitui** (com confirmação). `resetLocalData()` limpa chaves `fbr-*`/`pfp-*`.

## Worker de Admin (`worker/index.js`) — segurança
- Arquivo único (deploy manual copiando para o Cloudflare). Funções puras exportadas e testadas em `worker/index.test.js`.
- **CORS** (`corsOrigin`): ecoa a Origin só se estiver na allowlist (`danielluizdl.github.io`, `pre-flop-pro.pages.dev`, `localhost:5173`) **ou** for um preview de branch (`*.pre-flop-pro.pages.dev`, regex travada no sufixo) — sem isso, "Publicar ranges" falha com `Failed to fetch` em qualquer preview.
- **Senha** (`passwordMatches`): compara digests SHA-256 byte a byte (constant-time), sem early-return.
- **Rate limit** (`checkRateLimit`): Map em memória por `CF-Connecting-IP`, 5 tentativas/min → 429. Best-effort (reseta por isolate; complementar com WAF).
- **Token de sessão** (`generateToken`/`verifyToken`): action `validate` com senha correta retorna `{ ok, token, expiresAt }`, token = HMAC-SHA256 (chave = `ADMIN_PASSWORD`, exp 30 min). Publish aceita `Authorization: Bearer <token>` OU senha no body.
- Front: `login` guarda `adminToken` **em memória** (não persistido); `AdminPanel` publica via Bearer sem redigitar senha enquanto vale; 401 por expiração (`token_expired`) pede senha de novo.

## Backend de Nuvem — Auth + Telemetria + Painel Coach (`functions/api/`)
Cloudflare **Pages Functions** (serverless, cada arquivo exporta `onRequest(context)`) + **D1** (binding `DB`, banco `preflop-db`) + **KV** (binding `RATE_LIMIT`, rate limit de auth). Config em `wrangler.toml` (Pages lê os bindings de lá no build do GitHub). Schema: `schema.sql` (base), `schema_v2.sql` (`session_uuid`/`client_event_id`/dedupe), `schema_v3.sql` (`team_ranges`/`team_ranges_meta` — ranges centralizados; infra pronta, mas o front ainda usa `adminRanges.json` como fonte/fallback). **Deploy automático**: push → Pages builda (preview por branch em `<branch>.pre-flop-pro.pages.dev`; produção `pre-flop-pro.pages.dev` a partir de `main`). **Trabalho ativo na branch `feature/auth-telemetry` — NÃO mergeada para `main` de propósito** (mantém o link de produção antigo intacto). Tudo de nuvem é testado/usado no **preview** `feature-auth-telemetry.pre-flop-pro.pages.dev`. Migrações são manuais: `npx wrangler d1 execute preflop-db --file=schema_vN.sql --remote` — **schema_v2 a schema_v9 TODOS já aplicados no remoto** (v9 em 10/07: suits/raise_size em hand_events, user_grid/answer_grid em range_build_events, table_size em training_sessions — base do histórico permanente na nuvem). Gotcha descoberto em 10/07: o schema_v8 tinha sido aplicado só PELA METADE (a tabela range_build_sessions entrou, mas o `ALTER TABLE range_build_events ADD COLUMN wrong_hands` não — provável falha silenciosa no meio do arquivo), então wrongHands nunca tinha sido persistido até 10/07, quando a coluna foi adicionada manualmente. Se um endpoint com fail-open estiver gravando NULL numa coluna que "deveria existir", conferir `PRAGMA table_info(tabela)` antes de debugar o código.

- **Secrets/vars** (por ambiente no dashboard): `TURNSTILE_SECRET_KEY` (Secret), `RESEND_API_KEY`+`EMAIL_FROM` (e-mails). `SESSION_SECRET` existe mas **não é usado no código**. `TEAM_CODE` **REMOVIDO** (05/07) — cadastro não usa mais código único de time, ver `invite_codes` abaixo. Vars **públicas client-side** (`VITE_TURNSTILE_KEY`, `VITE_SENTRY_DSN`) ficam em **`.env.production` COMMITADO** — porque secrets do tipo `VITE_*` no dashboard NÃO entram no build do Vite (precisariam ser Plaintext); ver memória `project_cloudflare_env`. Tudo é **fail-open**: sem o secret, o recurso é ignorado e o app funciona.
- **Helpers** `functions/api/_utils.js`: `sha256Hex`, `hashPassword` (`SHA-256(salt + ':' + senha)`), `randomHex`, `getAuthUser`, `emailDomainExists` (DNS, fail-open), `checkRateLimit` (in-memory best-effort por `CF-Connecting-IP`, ~8/min, reseta por isolate — fallback), **`checkRateLimitKV`** (persistente no KV `RATE_LIMIT`, janela fixa 8/min por IP; fail-open p/ in-memory sem binding ou se o KV falhar; aceita 4º parâmetro `scope` — `'auth'` default usado no `login`/`signup`, `'admin'` usado nos 5 endpoints de escrita da aba Admin — **buckets isolados por escopo**, senão ações de admin e tentativas de login do mesmo IP disputariam o mesmo limite), `verifyTurnstile` (siteverify; fail-open sem `TURNSTILE_SECRET_KEY`), `escapeHtml` (escapa `&<>"'` antes de interpolar texto do usuário — ex. nome — em templates de e-mail HTML), `logAdminAction(env, actorId, action, targetId, detail)` (grava em `admin_audit_log`, best-effort/fail-open — nunca trava a ação principal), **`requireCoach(request, env)`** (06/07, dedup dos 5 endpoints de escrita da aba Admin — `create-user`/`update-user`/`delete-user`/`reset-password`/`create-invite-code` repetiam o mesmo skeleton de auth+role+rate-limit; helper faz `getAuthUser` + checa `role==='coach'` + `checkRateLimitKV(scope='admin')` e devolve `{ coach }` ou `{ response }` pronto pra early-return no chamador), `isHand`/`isUuidOrNull`/`isShortStr`, `json`, `CORS_HEADERS`, `handleOptions`.
- **Log de auditoria (schema_v7.sql, 06/07)**: tabela `admin_audit_log` (`actor_id`, `action`, `target_id` nullable sem FK — sobrevive à exclusão do alvo, `detail` JSON, `created_at`). Chamado via `logAdminAction` ao final de `create-user.js`/`update-user.js`/`delete-user.js`/`reset-password.js`/`create-invite-code.js` (ações: `create_user`/`update_user`/`delete_user`/`reset_password`/`create_invite_code`). Leitura: `GET /api/admin/audit-log` (coach-only, `LEFT JOIN users` pro alvo — pode ter sido excluído —, `JOIN` pro ator, fail-open se a tabela não existir). UI: nova seção "Log de auditoria" na aba Funcionalidades de Admin (`AdminView`), colapsável, mesmo padrão de `Section`; recarrega (`loadLogs()`) após qualquer ação de escrita.
- **Rate limit nos 5 endpoints de admin (06/07)**: `create-user`/`update-user`/`delete-user`/`reset-password`/`create-invite-code` chamam `checkRateLimitKV(env, ip, Date.now(), 'admin')` — antes só o token de coach protegia essas rotas, sem limite de tentativas se o token vazasse.
- **Auth** (`functions/api/auth/`): `signup`/`login` (com rate limit + Turnstile), `me`, `logout`, `change-password`; `functions/api/admin/reset-password.js` (coach-only: gera senha temporária, `first_login=1`, apaga sessões do alvo), `functions/api/admin/create-user.js` (coach-only, sem Turnstile — coach já autenticado; valida usuário ≥6/nome/e-mail opcional via `validateCreateUserPayload`, checa duplicidade, gera senha temporária igual ao reset), `functions/api/admin/update-user.js` (coach-only, edita nome/e-mail via `validateUpdateUserPayload`; só contas `role='player'`; checa e-mail duplicado em outra conta), `functions/api/admin/delete-user.js` (coach-only; recusa excluir a própria conta ou contas `role!=='player'`; delete cascade via FK). **Cadastro via código de convite (05/07, substitui `TEAM_CODE`)**: `functions/api/admin/create-invite-code.js` (coach-only, gera código único de 8 hex maiúsculo via `randomHex`+`formatInviteCode`, retry em colisão, grava `created_by`), `functions/api/admin/invite-codes.js` (coach-only, lista códigos com `LEFT JOIN users` mostrando quem usou); `signup.js` exige `inviteCode` (não mais `teamCode`) — valida contra `invite_codes WHERE code=? AND used_by IS NULL`, e ao criar a conta marca `used_by`/`used_at` no código (schema_v5.sql, tabela `invite_codes`: `code` único, `created_by`, `used_by` nullable `ON DELETE SET NULL`). **Tier/turma (06/07, schema_v6.sql)**: cadastro também exige `tier` (`fundamentals`|`evolution`|`metamorphosis`|`main`) e, se não for `main`, `turma` (`A`|`B`|`C`|`D`) — colunas `users.tier` (`NOT NULL DEFAULT ''`) e `users.turma` (nullable); validação pura em `validateSignupFields` (`signup.js`, testado em `signup.test.js`). Senha mínima **6 caracteres** (não mais 8). Tabela `users` (role `player`|`coach`, `first_login`, `name`, `email`, `tier`, `turma`); `sessions` (token_hash, 30 dias). Fluxo de primeiro acesso: signup novo → `WelcomeModal` (flag transiente `justSignedUp` no store); login com `first_login=1` (senha resetada pelo coach) → força `ChangePasswordModal`.
- **Telemetria** (`functions/api/events/`): `hand`, `consult`, `session-end`. `user_id` SEMPRE do token; sem auth → 200 `{ok:false}`. `hand` valida payload + `INSERT OR IGNORE` (dedupe por `client_event_id`). Tabelas `hand_events`, `consult_events`, `training_sessions`.
- **Analytics do coach** (`functions/api/admin/analytics.js`, coach-only; helpers puros `parseIntParam`/`parsePlayerIds`/`playerCond`/`dateCond`/`handFilters`/`ACC` exportados e testados em `analytics.test.js`, sem D1 real) — `?view=`: `team-overview` (por jogador + TIME), `leaks`, `by-range` (com `imprecisos` → tipo de erro), `range-grid` (por mão: total/acertos/graves/consultas + `correctAction` + `topWrong` + **`played`** {fold,call,raise,allin,extra} para reconstruir o "range jogado"), `consult-by-range` (por range: `totalConsults`/`totalPlayed`/`rate` = `totalConsults ÷ totalPlayed × 100`, pode passar de 100%), `consult-by-range-hand` (drill-down por mão dentro de um range, `rangeId` obrigatório), `player-ranges` (precisão jogador×range — z-score e resumo rápido), e as views do modo Range Check `build-overview`/`build-by-range`/`build-events` (lêem `range_build_events` do schema_v4 em try/catch — **fail-open**: tabela ausente devolve rows vazios/team null). Filtros: `playerIds` (CSV), `rangeId`, `days` (1..365), `stackGridIdx` (range-grid). Agrupam por `range_id` com `MAX(range_name)`. **Gotcha:** `consult_events` NÃO tem `stack_grid_idx` — no `range-grid`, as consultas usam cláusula própria (sem o filtro de stack), senão dá 500 em range multi-stack. Views **sem uso no front** desde a fatia da "Consulta no drill" (mantidas no arquivo — ninguém as apagou ainda, viraram órfãs pós-merge): `trend`, `segments`, `knowledge-gaps`. `consult-hotspots` já tinha sido removido antes (issue #36, endpoint morto confirmado).
- Também: `me/stats.js` (jogador, `WHERE user_id`), `admin/users.js`, `admin/user/[id].js`, `admin/ranges/publish.js` (coach publica ranges no D1) + `ranges/list.js`, `_email.js` (Resend, fail-open: boas-vindas no signup, senha temporária no reset). Import paths: `events/*` e `admin/*` usam `../_utils.js`; `admin/user/*` e `admin/ranges/*` usam `../../_utils.js`.

### Frontend de nuvem
- **Store**: `currentUser`, `authToken` (sessionStorage `pfp-auth-token`), `justSignedUp`, ações `authLogin`/`authSignup`/`authLogout`/`changePassword`/`restoreSession` (em `main.tsx` antes do render), `syncTeamRanges`/`publishTeamRanges` (ranges D1). Telemetria via `fireEvent()` → `src/utils/eventQueue.ts` (fila localStorage `pfp-event-queue`, cap 500, retry/flush). `startDrillSession` gera `session_uuid`; cada `hand` envia `client_event_id`.
- **i18n** (`src/i18n/`): `t` é um **Proxy** que lê o dicionário do idioma vigente (`pt`/`en`/`es`, 533 chaves). Trocar idioma via `setLang` re-renderiza via `key={lang}` no `AppLayout`. `lang` persistido em `fbr-ui-state`. **Não capturar `t.x.y` em constantes de módulo** — congela o idioma do boot. Tokens de domínio não traduzidos (FOLD/CALL/RAISE/ALL-IN, BB, RNG, posições). Para adicionar chave: editar `pt.ts`, `en.ts` e `es.ts` (tsc força completude).
- **Rotas** (`react-router-dom` v6 + `src/components/Layout/RouterSync.tsx`): espelha URL↔`page` do store (`/dashboard`, `/ranges`, `/drill`, `/historico`, `/coach`); `public/_redirects` (`/* /index.html 200`). Lazy/Suspense em CoachPanel/TrainerPage/StatsPage + fluxo de edição (RangeSetup/RangeEditor/TableEditor/CategoryDetail). **GOTCHA React 19:** RouterSync usa ref `lastSynced` p/ evitar loop infinito ping-pong URL↔store — não simplificar.
- **Observabilidade (`src/utils/sentry.ts`)**: init só com `VITE_SENTRY_DSN` (fail-open: tudo vira no-op sem o DSN). API: `captureError(err, {extra})`, `captureMessage(msg, level)`, `addBreadcrumb(category, message, data?)`. **Privacidade**: `beforeSend` faz `scrubEvent` (redige e-mail/token via `redactString`, dropa headers `Authorization`/`Cookie`); `captureError`/`addBreadcrumb`/`captureMessage` também redigem antes de enviar — **nunca** logam senha/token/e-mail crus. **O que é capturado**: crashes de render (`ErrorBoundary`, raiz e por área), erros silenciosos de rede (`MyAccountStats` + hooks do `CoachPanel`, publish), e estados degradados via `captureMessage('warning')` (cota de localStorage estourada, `validateRanges` achando problemas no load). **Breadcrumbs**: navegação (`setPage`), início de drill, login/logout, publish — reconstroem o caminho até um erro. `sendDefaultPii:false`, `tracesSampleRate:0`.
- **LoginPage** (login/signup/forgot + widget `Turnstile.tsx` se `VITE_TURNSTILE_KEY`), **WelcomeModal**, **OnboardingTour** (07/06, `src/components/Auth/OnboardingTour.tsx`), **ChangePasswordModal**. Ao fechar o `WelcomeModal`, em vez de só zerar `currentUser.firstLogin` (o que deixava o overlay montado-porém-invisível — `fixed inset-0` sem `justSignedUp` virar `false` mantinha o componente na árvore), agora zera `justSignedUp` **e** seta `onboardingStep: 0` no store, disparando o tour guiado só para quem acabou de criar conta.
  - **`OnboardingTour`, versão exaustiva (07/07, +1 passo em 09/07)**: navega de verdade por **30 passos em 6 páginas reais**, granularizando cada tela em vez de 1 passo por página: Dashboard → Meus Ranges → Configurar Mesa (formato / **straddle** / **ante**, 3 passos) → Editor (posição / nome / **campo de stack** / **ações & frequências** / matriz / **faixas salvas** / **pré-requisito**, 7 passos) → Configurar Mesa (**escolher ação por posição** / **raise futuro** / mesa visual / cenários+finalizar, 4 passos) → Drill (selecionar / configurações / filtro / **mão ao vivo** / **consultar o range** / quadrante / histórico / resumo, 8 passos) → Range Check (selecionar + **rodada ao vivo**) → Histórico. Chama `setPage(...)` (e, na seção do Editor, `loadRangeForEdit()` num range real do catálogo em vez de `setupNewRange()` — ver "Exemplo real único" abaixo). **Todo passo chama `setPage(...)`/sua função de carregamento mesmo quando "não deveria precisar"** (idempotente) — necessário porque "Voltar"/"Rever tutorial" pode entrar num passo vindo de qualquer lugar (página diferente, ou pulando os passos anteriores que normalmente preparariam o estado), então cada passo garante sozinho em qual página está e quais dados estão carregados, nunca depende de um passo anterior já ter rodado (ver `loadTableDemo()` abaixo, que chama `loadStackRangeDemo()` de novo se `tempScenarios` ainda estiver vazio). Cada passo destaca um elemento real via atributo **`data-tour="<chave>"`**: `dashboard-hero`, `ranges-new`, `setup-tablesize`, `setup-straddle`, `setup-ante` (`RangeSetupPage.tsx`), `editor-position`, `editor-name`, `editor-stackfield`, `editor-actionsfreq`, `editor-matrix`, `editor-stackrange`, `editor-prereq` (`RangeEditorPage.tsx`), `table-editor-roles`, `table-editor-raisefuture`, `table-editor-table`, `table-editor-scenarios` (`TableEditorPage.tsx`), `drill-select`, `drill-active`, `drill-viewrange` (09/07, botão "Ver Range" da mesa) (`TrainerPage.tsx`), `exercise-select`, `exercise-active` (`ExercisePage.tsx`), `stats-header` (`StatsPage.tsx`), medido via `getBoundingClientRect` com **polling a cada 100ms por até 2.5s** (páginas lazy/Suspense) — sem achar a tempo, cai num **fallback sem spotlight** (painel centralizado, tour não trava). Achar o alvo faz `el.scrollIntoView({block:'center'})` antes de medir (09/07 — sem isso, alvos abaixo da dobra como o botão Finalizar numa lista longa de cenários ficavam fora da viewport e o spotlight nunca aparecia); a altura do painel usada no cálculo de posição vem de `dialogRef.current.offsetHeight` medido a cada render via `useLayoutEffect` (09/07 — antes usava a constante fixa `PANEL_EST_HEIGHT` só como chute inicial, que estourava a borda da tela em passos com texto mais longo). **`table-editor-raisefuture`** explica o campo "Raise futuro" (sub-linha do herói): tamanho do raise que o herói daria se decidisse subir de novo em resposta à ação do vilão (no exemplo, o 4-bet de 65bb do BTN vs o 3-bet do SB) — se 0, o botão RAISE não aparece no Drill. **`table-editor-scenarios`** também explica que, como o range de exemplo tem mais de uma faixa de stack, clicar em "Finalizar" abre um modal pedindo um nome principal pra combinar as faixas num único range multi-stack (comportamento só descrito em texto — `nameModalOpen` é estado local do `TableEditorPage`, fora do alcance do tour).
    - **Posicionamento do painel**: prefere encostar **do lado do alvo** (direita, senão esquerda) em vez de embaixo — em formulários verticais (ex. `RangeSetupPage`) um painel "embaixo" tapava exatamente a próxima pergunta (straddle/ante). Só cai para embaixo/cima do alvo quando não há espaço lateral (matriz 13×13, mesa de poker — alvos que já ocupam a largura disponível).
    - **Exemplo real único pros passos avançados do Editor/Mesa**: em vez de dados fabricados, `editor-position`/`editor-name`/`editor-stackfield`/`editor-actionsfreq`/`editor-matrix`/`editor-stackrange`/`editor-prereq`/`table-editor-roles`/`table-editor-table`/`table-editor-scenarios` carregam **o mesmo range real do catálogo** ("BTN vs 3B OOP", id fixo `STACKRANGE_PREREQ_DEMO_ID` em `OnboardingTour.tsx`, com fallback por características — `stackGrids.length>1`/`prereqRangeId` — se esse id específico sumir do catálogo) via `loadRangeForEdit()`: ele já tem **3 faixas de stack reais** (mostra o preview "Salvo nesta sessão" com os 3 chips), **prereq real** (aponta pra "RFI BTN") e um **cenário real não-trivial** (BTN Open vs SB 3-Bet, resto fold) carregado na mesa via `loadScenarioFromBuffer(0)` — um único fio narrativo coerente ("vamos ver como esse range real foi montado") em vez de um scaffold em branco + fragmentos inventados. `loadStackRangeDemo()` além de chamar `loadRangeForEdit()` também simula o clique na primeira faixa salva (mesmo efeito de `loadSessionForEdit(0)` no componente) pra a matriz mostrar esse range **já pintado de verdade**, não uma grade vazia, e `selectedEditorPositions` já vem com a posição do herói (BTN) marcada. Consequência esperada (não é bug): como toda a seção do Editor usa `loadRangeForEdit` num range **existente**, o título vira "Editar Range" (não "Criar Range") do primeiro ao último passo dessa seção — não há mais fluxo de "range em branco".
    - **Passo "Ações & Frequências" (`editor-actionsfreq`)**: `loadActionsFreqDemo()` chama `loadStackRangeDemo()` e depois ajusta `brush.call=50/brush.raise=50` + pinta `rangeData.grid.KK = {call:50, raise:50}` diretamente — um exemplo redondo de mistura de frequências (não uma ação 100%). O passo seguinte da matriz (`editor-matrix`) reaproveita a mesma função (idempotente), então o KK 50/50 continua visível quando a grade aparece.
    - **Passo "faixas salvas" (`editor-stackrange`) troca sozinho entre as 3 faixas**: um `useEffect` separado (dependente de `stepIndex`, só ativo quando `step.target === 'editor-stackrange'`) roda um `setInterval` de 1.8s que avança pro próximo `sessionGrids[i]` a cada tick (começa do índice 1, já que o índice 0 foi mostrado pelo `run()` do passo) — demonstra visualmente que cada faixa de stack tem sua própria matriz pintada, sem exigir clique do usuário. O intervalo é limpo no cleanup do effect (mudança de passo ou saída do tour).
    - **Passos "ao vivo" (`drill-active`/`exercise-active`)**: o tour **inicia de verdade** uma sessão de demonstração — `startDrillDemo()`/`startExerciseDemo()` reaproveitam o **mesmo range real** (`findStackRangeDemo(ranges) ?? ranges[0]`, a mesma função usada nos passos do Editor) e chamam `startDrillSession()+nextDrillHand()` / `startBuildSession()+confirmBuildSession()`, mostrando uma mão real respondível / uma rodada real pra pintar — como o range tem 3 faixas de stack, o Range Check mostra "Round 1/3" (o tour só demonstra o primeiro). **Nunca pisam numa sessão real em andamento** (só iniciam se `activeDrillRange`/`buildRounds` ainda não estiverem populados); uma ref (`startedDrillDemo`/`startedBuildDemo`) marca quando a demo foi criada *pelo próprio tour*, e `finish()` (Concluir/Pular/Esc/clique fora) só chama `resetDrillDemoState()`/`clearBuildDemo()` nesse caso — nunca `stopDrill()`/`stopBuildSession()` de verdade, que persistiriam a sessão fake no `trainingHistory`/histórico do Range Check reais — e nunca encerra um treino real que já existia antes do tour (aí sim usa `stopDrill()` de verdade, preservando o comportamento de sempre). O passo do resumo do Drill (`drill-summary`, `startDrillSummaryDemo`, 09/07) preenche `sessionStats`/`sessionHandPerf` com números fixos (3 mãos, 2 acertos) só pra a tela não aparecer zerada — nunca passa por `checkDrillAnswer` (não polui `handPerformance`, o acumulador all-time) e só quando a sessão foi criada pelo próprio tour, senão sobrescreveria os números de uma sessão real do usuário.
    - Botão **"Voltar"** (`stepIndex > 0`) decrementa `onboardingStep`, reaproveitando o mesmo `useEffect` (dependente de `stepIndex`) pra rodar o `run()` do passo anterior de novo. O painel (título/descrição/contador "N/18") é **sempre visível e interativo desde o primeiro frame**; nota fixa no rodapé: *"Você pode reabrir este tutorial quando quiser em Perfil → Rever tutorial."* z-index 60. **Risco aceito de propósito**: os passos de criar range chamam `setupNewRange`/`initTableConfig`/`loadRangeForEdit` de verdade — se o usuário estiver no meio de uma edição real não salva quando clica "Rever tutorial", esse progresso é sobrescrito (mesmo risco que já existia navegando manualmente por esse fluxo). `onboardingStep: number | null` é resetado pra `null` em login/signup/logout/restoreSession. Testado com RTL renderizando o `AppLayout` real, incl. os passos ao vivo do Drill/Range Check, o exemplo real de faixa de stack/prereq/mesa preenchida, e a navegação Voltar cruzando página.
  - **Menu de perfil do `TopNav`** (abre clicando no avatar/nome): "Idioma" (cicla PT→EN→ES→PT a cada clique, sem submenu — `nextLang()` local), **"Rever tutorial"** (seta `onboardingStep: 0` a qualquer momento, não só logo após o cadastro) e "Sair"; o ícone de globo saiu da fileira de botões utilitários do header (que ficou só com modo escuro + engrenagem de admin) e foi pro menu — `LanguageSelect` (componente próprio, com seu popover) continua em uso só no `Sidebar`/`LoginPage`. Cadastro: **Nome e Sobrenome** capitaliza automaticamente a primeira letra de cada palavra ao digitar (`capitalizeWords`, regex Unicode-aware `\p{L}` após espaço/início — **não** usar `\b\w`, quebra em nomes acentuados tipo "João"); **Senha**/**Confirmar senha** usam `PasswordInput` (componente local, ícone de olho Eye/EyeOff do lucide alterna `type="password"`↔`"text"` independentemente em cada campo); bloqueia com mensagem se não coincidirem (`auth.errors.passwordMismatch`) — mínimo 6 caracteres. **Tier**: 4 botões (`Tier Fundamentals`/`Tier Evolution`/`Tier Metamorphosis`/`Main Team`); selecionar qualquer um exceto Main Team revela seleção de **Turma** (A–D, botões). `canSubmit` exige tier selecionado e (tier==='main' OU turma selecionada).
- **CoachPanel** (`src/components/Admin/CoachPanel.tsx`, rota `/coach`): três abas — **"Drill"** (ex-"Visão do time", `TeamView`), **"Range Check"** (`RecallView`) e **"Funcionalidades de Admin"** (`AdminView`). **A aba antiga "Por jogador" foi REMOVIDA** — **todas** as operações de conta (resetar senha, editar dados, excluir) ficam **só** na aba "Funcionalidades de Admin" (`ConfirmDangerModal`). O `PlayerQuickSummary` (expandir um jogador em "Resumo individual por jogador", aba Drill) é **somente leitura** — não tem mais botão de resetar senha (removido a pedido do Daniel: mexer em conta de usuário só deve existir num lugar).
  - **Aba "Drill" (`TeamView`)**: **header de filtros** em destaque no topo (fora das caixas de seção), com rótulos: "Período:" acima do `PeriodFilter`, "Jogadores:"/"Ranges:" lado a lado acima de `MultiPlayerSelect`/`RangeSelect` (`flex flex-wrap gap-6`). `MultiPlayerSelect` (multi, checkboxes alfabéticos, **com input de busca** no topo do dropdown), `RangeSelect` (combobox custom agrupado por posição: clicar abre dropdown com input "Buscar range…" embutido que restringe a lista em tempo real — substitui o `<select>` nativo). **`PeriodFilter`**: Tudo/7/30/90 dias **+ opção "Custom"** que revela dois `<input type="date">` (início → fim, `[color-scheme:dark]`); ao preencher ambos envia `from`/`to` (unix s) em vez de `days`. Logo abaixo do header (ordem natural do DOM, sem hacks de `order` CSS), **"Matriz do range"** em **duas zonas** (`flex items-start gap-6`): esquerda `flex-1 min-w-0 flex flex-wrap` com **Range real** (gabarito, do `range.grid` via `RangeActionGrid`) + **Range jogado** (reconstruído de `played` via `RangeActionGrid`); direita `shrink-0` coesa com **Precisão/erros** (`RangeHeatGrid`), **`TopHandsPanel`** (abas Top 20 erros / Top 20 consultas, linhas clicáveis — **logo ao lado da Precisão/erros**) e um **slot fixo `w-[270px] shrink-0`** que reserva o espaço do **`HandDetailCard`** (abre ao clicar uma mão **sem deslocar/reflowar os demais painéis**, pois a largura da zona direita é constante). O `HandDetailCard` abre **à direita do Top 20 e no mesmo topo** (assumido pelo `scripts/verifyLayout.cjs`). `ComboCounter` abaixo das matrizes real/jogado. **Todas as tabelas são ORDENÁVEIS** (cabeçalho clicável com ▲/▼, mesmo padrão em todas: `<chave>SortKey`/`<chave>SortDir` + handler que alterna asc/desc no mesmo header ou reseta no padrão da coluna nova). Caixas **colapsáveis** (default minimizadas), nesta ordem: **Por range** (PRIMEIRA — a visão mais importante; `brSortKey`/`brSortDir`+`handleBrSort`, default Mãos desc; largura natural ao conteúdo; coluna **"Tipo de erro"** com label colorido + subtexto `N blunders · M imprecisos` e `title` explicativo (`SEVERITY_HELP`); legenda no topo explicando Conceitual/Estratégia mista/Misto), **Resumo individual por jogador** (renomeado de "Resumo do time"; `sortKey`/`sortDir`+`handleSort`, default Mãos desc; linha clicável abre `PlayerQuickSummary` = ranges mais treinados / onde mais erra / mais consultados, somente leitura), **Maiores leaks** (impacto+Wilson; `leaksSortKey`/`leaksSortDir`+`handleLeaksSort`, colunas Mão/Range/Tentativas/Precisão-mín/Blunder/Imprecisos/Impacto, default Impacto desc), **Consulta no drill** (substitui "Lacunas de conhecimento" — simplificada para 4 colunas: Range/Mãos consultadas (`totalConsults`)/% Consultas-Mão (`rate`)/Mãos jogadas (`totalPlayed`), via `consultSortKey`/`consultSortDir`+`handleConsultSort`, default `rate` desc; clicar uma linha expande `ConsultRangeDetail` = lista **Top 20 mãos mais consultadas** daquele range, no mesmo estilo visual do `TopHandsPanel` do topo (rank numerado, chip da mão, stat à direita), ordenada por vezes consultada desc, sem cabeçalho/ordenação própria — `view=consult-by-range-hand`), **Leaks relativos** (z-score; `relSortKey`/`relSortDir`+`handleRelSort`, colunas Jogador/Range/Mãos/Precisão/Média time/Δ/z, default z ASC — mais negativo primeiro = pior leak primeiro). **Removidas do front:** "Evolução (tendência semanal)" e "Segmentos (categoria e ação correta)" — sem valor no dia a dia; `useTrend`/`useSegments`, `TrendBadge`/`Sparkline` foram deletados do componente (os utils `coachTrend.ts`/`handCategories.ts` continuam testados-mas-não-usados, mesmo padrão de `coachFocus.ts`). **"Hotspots de consulta" foi REMOVIDO** (front e endpoint `consult-hotspots`, morto — issue #36). **"Foco da semana" foi REMOVIDO.**
  - **Aba "Range Check" (`RecallView`)**: analytics do modo Range Check — seções Por jogador com linha do time, Por range e Tentativas recentes com nº da tentativa + nota; mesmos filtros jogadores/range/período; views `build-overview`/`build-by-range`/`build-events`, fail-open enquanto `range_build_events` não existir.
  - **Aba "Funcionalidades de Admin" (`AdminView`, exportado p/ teste)**: lista de contas (`GET /api/admin/users`) com busca por usuário/nome/e-mail; botão **"+ Adicionar conta"** (form inline usuário/nome/e-mail → `POST /api/admin/create-user`) fica fora da linha (fluxo de criação, sem confirmação de risco). **Clicar numa conta expande** (mesmo padrão do `OverviewTableRow`: `<tr onClick>` + chevron ▸/▾, **sem `aria-expanded` no `<tr>`** — axe rejeita esse atributo em `<table>` comum, só vale em `treegrid`) revelando três ações: **Editar dados** (nome/e-mail inline, botão só habilita com e-mail válido), **Resetar senha** e **Excluir** (vermelho). As três passam por **`ConfirmDangerModal`** (componente local, usa `useModalA11y`) antes de executar — mostra o que vai mudar (editar: diff nome/e-mail riscado→novo; resetar/excluir: aviso "não pode ser desfeito" em vermelho) e exige clique explícito em Confirmar; excluir chama `POST /api/admin/delete-user` (bloqueia excluir a si mesmo ou contas com `role='coach'`; cascade apaga sessions/hand_events/consult_events/training_sessions/range_build_events); editar chama `POST /api/admin/update-user`. Seção **"Códigos de convite"** (colapsável, default fechada): botão "+ Gerar código" (`POST /api/admin/create-invite-code`) + tabela (`GET /api/admin/invite-codes`) com código/status (`Usado por X` ou `Não utilizado`)/data.
  - **Vocabulário:** erro `grave` (interno, no D1/store/tipos) é exibido como **"Blunder"** em toda a UI (painel coach + app do jogador: feedback do drill, DrillSummary, MyAccountStats, RangeHeatGrid); `severity:'grave'` NÃO muda no banco/código.
- **Componentes coach** (`src/components/Admin/`): `RangeHeatGrid` (matriz por métrica, maxWidth 380), `RangeActionGrid` (matriz por frequência de ação), `TopHandsPanel`, `HandDetailCard`, `PlayerQuickSummary`, `MultiPlayerSelect`, `ConsultRangeDetail` (Top 20 de mãos mais consultadas de um range, estilo `TopHandsPanel`, na seção "Consulta no drill"), `ConfirmDangerModal` (usado só na aba "Funcionalidades de Admin"). **`ComboCounter`** (`src/components/ui/ComboCounter.tsx`) é reusado no editor e no preview.
- **Utils de data science** (puros + testes vitest): `coachStats` (Wilson, `leakImpact`, `severityProfile`, `knowledgeGapScore`), `coachRelative` (z-score), `coachFocus`/`coachTrend`/`handCategories` (testados, não usados na UI — `coachTrend`/`handCategories` ficaram órfãos depois que "Evolução"/"Segmentos" saíram do CoachPanel), `rangeCombos` (`combosOf` par=6/suited=4/offsuit=12, `TOTAL_COMBOS=1326`, `rangeComboStats` → `byAction` incl. **fold** + `accountedCombos` p/ prova real de 100%).
- **ComboCounter ao vivo**: no `RangeEditorPage` (abaixo de BrushControls) e no `RangePreviewModal` (olho de Meus Ranges) — mostra combos por ação (Raise/Call/All-in/extra/**Fold**) + Total `X/1326 · 100% ✓`. Todos os 109 grids nativos conferidos: somam 1326/100%.
- **MyAccountStats** (`src/components/Stats/MyAccountStats.tsx`) + `AccuracySparkline` no Dashboard do jogador.

### PENDÊNCIAS no painel coach — TODAS IMPLEMENTADAS
1. ✅ **Top 20 perto da Precisão/erro + detalhe sem reflow**: faixa `flex flex-wrap` (sem `flex-1`); `TopHandsPanel` logo após Precisão/erros; `HandDetailCard` em slot fixo `w-[270px] shrink-0` (abre/fecha sem deslocar nada).
2. ✅ **Busca de range**: `RangeSelect` (combobox custom) — clicar abre dropdown com input "Buscar range…" que restringe a lista.
3. ✅ **Busca de jogadores**: input no topo do dropdown do `MultiPlayerSelect`.
4. ✅ **Período custom**: `PeriodFilter` com opção "Custom" + dois `<input type="date">` → envia `from`/`to` (unix s). Backend `functions/api/admin/analytics.js`: helper `dateCond(field, {days,from,to})` (centraliza todas as cláusulas de data; aceita `from`/`to` OU `days`); params `from`/`to` validados (0..4102444800).

### Dados demo / verificação
- Contas demo: `demo_01`..`demo_15`, senha `demo1234`, role player (~80k mãos). Coach: `admin001`. Limpeza: `DELETE FROM users WHERE username LIKE 'demo\_%' ESCAPE '\'` (CASCADE).
- `scripts/` (**gitignored**): geradores `seedFake.cjs`/`seedFakeRfi.cjs` (RFI >5k/range + multi-stack, realismo via grid real); scripts Playwright `verifyLayout/verifyFold/verifyTeam.cjs` para **conferir layout renderizado de verdade** (login via sessão temp inserida no D1 + `addInitScript` setando `pfp-auth-token`; chromium instalado local). Padrão útil quando o usuário pede garantia visual.

## Ranges Nativos (`src/data/defaultRanges.ts`)
- Ranges nativos definidos com helper `const g = (hands) => ({ ...makeEmptyGrid(), ...hands })`
- Seed no `loadRanges()` do store: injeta ranges com IDs ausentes sem sobrescrever os do usuário
- Versionamento via `ADMIN_VERSION`: ao publicar nova versão, sobrescreve ranges admin preservando os do usuário
- Para atualizar: exportar `localStorage.getItem('fbr-ranges-v1')` do browser → processar com PowerShell → substituir o arquivo
- `validateRanges` roda em `loadRanges` (apenas `console.warn`) e no `AdminPanel` antes de publicar (lista problemas e bloqueia até marcar "Publicar mesmo assim")

## Store (`src/store/useStore.ts`) — Estado Principal
Estado relevante (não persistido entre sessões, exceto darkMode):
- `page` — navegação atual
- `ranges` — carregado do localStorage na inicialização (com seed de DEFAULT_RANGES)
- `rangeData` — range sendo editado (`{id,name,grid,positions,tableSize,stackRange,prereqRangeId?}`)
- `selectedEditorPositions` — posição do HERO selecionada no EditorPage (**single-select**)
- `brush` — `{call,raise,allin,extra,raiseSize,extraLabel,extraColor}` — pincel para HandMatrix
- `currentScenario` — `Record<posId, PositionConfig>` — cenário sendo configurado
- `tempScenarios` — cenários salvos no buffer antes de finalizar o range
- `currentHeroRaiseSize` — raise size do HERO para o cenário
- `currentHasStraddle` — se mesa 8-max tem straddle obrigatório
- `currentAnte` / `currentTableSize` / `activePositions` / `activeSlots`
- `activeDrillRange` / `activeDrillStackRange` / `activeDrillStackGridIdx`
- `activeHand` / `sessionStats` / `handHistory` / `currentRng`
- `correctActionForCurrentHand` / `correctActionsForCurrentHand` / `currentHandSuits`
- `useRngForFrequency` — true=RNG (sorteia 1-100 e usa as faixas de frequência, agressividade primeiro: Allin>Raise>Call>extra>Fold), false=ação de maior frequência é sempre a "certa", mas qualquer ação com frequência > 0 no range também é aceita como acerto (feedback "Válido — ação principal: X Y%"); só é errado (blunder) responder uma ação com 0% na mão. **07/07: removido o toggle `acceptAnyFreq`** — esse comportamento "aceita qualquer freq>0" era opcional (só ligava com o toggle); agora é o único comportamento do modo RNG=Não, sem chave pra desligar (decisão do Daniel, ver `DrillSettingsStep` abaixo).
- `focusErrors` — (D1) liga amostragem ponderada do nível 2 do `nextDrillHand` (mão dentro do range) por `handPerformance`: peso `3` para mãos nunca treinadas, `1 + 4*(1 - acerto)` para treinadas. Nível 1 (entre ranges) segue uniforme. Desligado (default) = sorteio uniforme atual intacto. **Fica desligado por padrão de propósito** — o `DrillSettingsStep` explica que só vale a pena ligar depois de já ter algumas sessões de treino registradas (senão não há dado suficiente pra saber onde o jogador realmente erra mais).
- `sessionSeverity: { grave, impreciso }` — (D2) contadores da sessão; reset em `startDrillSession`, incrementado em `checkDrillAnswer`. `DrillSummary` exibe as contagens.
- `sessionHandPerf: HandPerfMap` — acumulador por id da sessão atual (fora do `handHistory`, que tem cap de 50). `stopDrill`/`DrillSummary` usam ele para stats por range; `TrainingSession.handPerf` é gravado por id (leitura com fallback por nome para sessões antigas)
- `handPerformance: HandPerfMap` — carregado do localStorage na inicialização
- `selectedDrillRangeIds` / `drillExcludedHands`
- `trainingHistory: TrainingSession[]` — carregado do localStorage
- `sessionStartTime: number` — timestamp de início da sessão atual

**`toggleEditorPosition(label)`** — single-select: clica na posição selecionada → deseleciona; clica em outra → troca. `selectedEditorPositions` sempre tem 0 ou 1 elemento. Ranges armazenam `positions` como array de **labels** (ex: `["STR"]`, `["BTN"]`), não ids.

**`updateRole(pid, role)`** — ao setar `fold` em SB/BB/STR, mantém a aposta do blind (0.5/1.0/2.0) para chips continuarem na mesa.

**`stopDrill()`** — salva sessão em `trainingHistory` (se `sessionStats.hands > 0`), limpa `activeDrillRange`. NÃO limpa `sessionStats` nem `handHistory` (disponíveis para DrillSummary após encerrar).

## Fluxo de Navegação
```
dashboard
  → range-setup   (RangeSetupPage: tableSize, straddle, ante — defaults: 8-max, sim, sim)
      → editor     (RangeEditorPage: Posição do HERO + Nome + pintar HandMatrix)
          → table-editor  (TableEditorPage: configurar roles/bets/stacks + cenários)
              → ranges     (após finalizeRange())
  → ranges        (SituationsPage: acordeão por posição com RangeCards)
  → drill         (TrainerPage: DrillRangeSelect → DrillSettingsStep → HandFilterGrid → DrillActive)
  → exercise      (ExercisePage "Range Check": BuildRangeSelect → BuildRound → BuildSummary)
  → history       (StatsPage)
```

**Ações de navegação chave no store:**
- `setupNewRange(size, hasStraddle, ante)` → inicializa tudo e vai para `'editor'`
- `loadRangeForEdit(id)` → carrega range existente e vai para `'editor'`
- `finalizeRange()` → salva range no localStorage e vai para `'ranges'`
- `initTableConfig()` → popula `currentScenario` com todos os `activePositions` (roles defaults: post para SB/BB/STR, fold para o resto, stack padrão 250bb)
- `handleNext()` em RangeEditorPage chama `initTableConfig()` + `setPage('table-editor')`

## RangeSetupPage (`src/components/RangeBuilder/RangeSetupPage.tsx`)
- Defaults: 8-max, straddle sim, ante sim (0.5bb)
- Straddle só disponível para 8-max

## RangeEditorPage (`src/components/RangeBuilder/RangeEditorPage.tsx`)
- Label "Posição do HERO" (single-select) — apenas uma posição pode ser selecionada
- Campo "Nome:" fica **abaixo** dos botões de posição, com `max-w-xs`
- Layout: título → posições → nome → HandMatrix (esquerda) + BrushControls (direita)
- Picker de pré-requisito: abre modal com lista de ranges existentes; armazenado em `rangeData.prereqRangeId`
- **Ajuda do campo Stack Efetivo (07/07)**: `StackHelpButton` (componente local no mesmo arquivo) — ícone `HelpCircle` (lucide) ao lado do label "Stack:", abre um popover pequeno (`absolute`, `bg-warm-900 border-warm-600 rounded-lg shadow-xl`, mesmo padrão visual do `LanguageSelect`/`MultiPlayerSelect`) explicando os formatos aceitos por `stackMatchesRange` (`src/utils/hands.ts`): `<=250bb`, `>=300bb`, `250-300bb` (intervalo) ou um valor exato; vazio vale pra qualquer stack. Fecha com clique fora (`mousedown` no `document`) ou Esc, mesmo padrão do `LanguageSelect.tsx`.
- **Chip da faixa salva realça mesmo sem clique (07/07)**: o destaque visual (`bg-brand-900/30 border-brand-600/60` + label "editando") não depende só de `editingIdx === i` (estado local, setado só ao clicar) — cai pra comparar `rangeData.stackRange === sg.stackRange` quando `editingIdx` é `null`. Existe pro `OnboardingTour` conseguir mostrar visualmente qual chip corresponde à faixa carregada enquanto troca sozinho entre elas (não tem como o tour setar `editingIdx`, que é local ao componente) — não muda o fluxo real de clique do usuário, que continua controlado por `editingIdx` normalmente.

## HandMatrix (`src/components/RangeBuilder/HandMatrix.tsx`)
- Grid 13×13 de mãos (169 células)
- Props: `readOnly?`, `grid?` (externo ou do store), `heatmap?: Record<hand, {c,t}>`, `forceViewMode?`
- Clique em célula vazia → `applyBrush()`. Clique em célula preenchida → `clearHand()`
- Quando `heatmap` prop fornecido: toggle **"Ações" / "Erro / Acerto"** (default: "Erro / Acerto")
  - Modo "Ações": gradient de frequências (allin=roxo, raise=vermelho, call=verde)
  - Modo "Erro / Acerto": cores de precisão (verde ≥80%, amarelo 50-79%, vermelho <50%, azul-acinzentado=não treinado)
- Tooltip no modo "Erro / Acerto": `x/y w%` em posição `fixed` seguindo o cursor
- `showWarning` quando brush total >100%

## BrushControls (`src/components/RangeBuilder/BrushControls.tsx`)
- Controla `brush.call`, `brush.raise`, `brush.allin`, `brush.raiseSize`
- Preset buttons: 0%, 25%, 50%, 75%, 100%
- `setBrush` clampeia automaticamente para total ≤ 100%
- Fold é read-only = 100 - (call+raise+allin)

## TableEditorPage (`src/components/TableEditor/TableEditorPage.tsx`)
- Grid colunas: `'20px 44px 1fr 56px 56px'` (H / Pos / Ação / Stack / Aposta)
- Select de Ação tem `w-full` (importante para funcionar em todos os browsers)
- Global stack setter: botões 100bb / 250bb + input customizado
- Sub-row HERO: input para `currentHeroRaiseSize` — se 0, botão RAISE não aparece no drill
- `getStackLabel()`: "250bb" se todos iguais, "* 120bb" se um outlier
- Clicar em cenário salvo carrega + destaca verde; botão "Salvar alterações no #X" confirma edição
- `PokerTableEditor` dentro de wrapper `maxWidth: 575px`, padding `px-10 pt-8 pb-16`

## SituationsPage (`src/components/Situations/SituationsPage.tsx`)
- Acordeão por posição (ordem: STR, BB, SB, BTN, CO, HJ, MP, EP, LJ, UTG, demais alfabético)
- Cada caixa: header com nome da posição + count → expande mostrando RangeCards em grid
- `RangeCard`: nome, mãos não-fold, cenários, accuracy% de treino; botões Treinar/Editar/Heatmap/Deletar
- Botão "+ Novo Range" no cabeçalho da página
- Modal heatmap: `fixed inset-0 z-50`, HandMatrix com toggle Ações/Erro-Acerto + botão resetar dados

## TrainerPage (`src/components/Trainer/TrainerPage.tsx`)

### Render order no TrainerPage
```tsx
if (showHistory)      → <HistoryModal>
if (showSummary)      → <DrillSummary>        // stopDrill() chamado ao fechar
if (activeDrillRange) → <DrillActive>
else                  → <DrillRangeSelect>
```
- `showSummary` é mostrado ANTES de verificar `activeDrillRange` — permite "Voltar ao treino" sem perder estado
- `stopDrill()` só é chamado ao clicar "Encerrar" no DrillSummary, não ao abrir o resumo

### DrillRangeSelect
- Acordeão por posição idêntico ao SituationsPage
- `POSITION_ORDER = ['STR','BB','SB','BTN','CO','HJ','MP','EP','LJ','UTG']`
- Badge mostra quantos ranges selecionados por grupo
- "CONTINUAR →" → step 'settings' (`DrillSettingsStep`) sem modificar `drillExcludedHands`
- `DrillSettingsStep` → "Continuar →" → step 'filter' (HandFilterGrid); "Voltar" → 'select'
- HandFilterGrid → "INICIAR TREINO" → `startDrillSession()` + `nextDrillHand()`; "Voltar" → 'settings'

### DrillSettingsStep (07/07, novo — antes os controles ficavam dentro do HandFilterGrid)
- Tela dedicada **antes** do filtro de mãos, com explicação + exemplo de cada opção (pedido
  do Daniel: "explique a diferença e deixe selecionar antes do filtro de mãos").
- **RNG** (`useRngForFrequency`, botões Sim/Não): card explica os dois modos com um exemplo
  computado ao vivo via `formatRngBands(getRngBands({fold:30,call:0,raise:50,allin:20}))` —
  garante que o texto do exemplo nunca fica desatualizado em relação ao algoritmo real.
- **Focar erros** (`focusErrors`, botão único que muda de cor — mesmo padrão visual de
  antes, só que agora numa seção própria com explicação): fica **desligado por padrão** e
  o card tem uma observação fixa recomendando só ligar depois de já ter algumas sessões de
  treino registradas.
- `EXAMPLE_HAND_DATA` é uma constante de módulo em `TrainerPage.tsx` (não captura `t.x.y`,
  só dados numéricos — sem violar o gotcha de i18n).

### HandFilterGrid
- Mostra grid 13×13 com todas as 169 mãos
- Usuário exclui manualmente as mãos que não quer treinar
- **Nunca é modificado automaticamente** ao selecionar ranges
- Só se aplica a ranges SEM `prereqRangeId` (ver lógica de `nextDrillHand` abaixo)
- **Não tem mais os controles de RNG/Focar erros** (movidos pro `DrillSettingsStep`, passo anterior)

### nextDrillHand — Lógica de candidatos
```
Para cada range selecionado, por cenário:
  Se range TEM prereqRangeId (e prereq encontrado):
    → candidatos = ALL_HANDS onde prereqGrid[h].fold < 100
    → drillExcludedHands é IGNORADO
  Se range NÃO TEM prereqRangeId (ou prereq não encontrado):
    → candidatos = ALL_HANDS onde !drillExcludedHands.includes(h)
    → sem filtro de fold — mãos fold=100 aparecem (resposta correta = Fold)
  A ação correta sempre vem de activeGrid[hand] (nunca do prereqGrid)
```
- Cenário-first: resolve stackGrid baseado no heroStack do cenário antes de filtrar mãos
- `correctAction` calculado de `activeGrid[hand]` via `getRngCorrectAction` ou `getTopFrequencyActions`
- `getRngCorrectAction` ordena as faixas por agressividade: **Allin > Raise > Call > extra > Fold** (ex: 20% allin/50% raise/30% fold → 1–20 Allin, 21–70 Raise, 71–100 Fold). Com prereq, `drillExcludedHands` é ignorado ao montar candidatos.

### DrillActive — Layout
Container: `w-full h-[calc(100vh-90px)] overflow-auto`

**Coluna esquerda (flex-1 flex flex-col gap-2):**
- Dark box (rounded-2xl, background #030712):
  - Linha de topo: RNG badge (esquerda) + botões "Erro/Acerto" e "Ver Range" (direita)
  - Mesa: `flex justify-center px-10 pt-1 pb-[60px]` → `PokerTableEditor heroCards={{r1,s1,r2,s2}}`
  - Cartas do hero renderizadas **dentro** do PokerTableEditor, à direita do círculo do hero
  - Feedback: `min-h-[56px] flex flex-col justify-center text-center px-4 py-2`
  - Botões de ação: FOLD/CALL/RAISE(se heroRaiseSize>0)/ALL IN — `px-5 py-2.5 text-sm`
  - Navegação: Próxima Mão / 2s (auto-advance com barra de progresso) / ← Anterior

**Coluna direita (`sticky top-0 self-start h-[calc(100vh-90px)]`):**
- `HandHistorySidebar` com scroll interno, título clicável → abre HistoryModal
- Stats box: nome range, stackRange badge, grid 2 colunas (Mãos/Acertos/Erros/Consultas)
- Botões: "Encerrar Treino" (chama stopDrill) / "Encerrar e ver resumo" (só chama onShowSummary)
- Sidebar colapsável (botão ‹ / HIST ›)

### DrillActive — Comportamento
- `goNextRef` pattern para auto-advance estável em useEffect
- `PrevSnapshot` salva estado da mão anterior (hand, suits, rng, feedback, freqLabel)
- `viewingPrev` exibe snapshot anterior sem avançar; "← Mão atual" volta
- `getFreqLabel()` formata "75% Raise e 25% Call"
- **Atalhos de teclado (D3)** via `keyHandlerRef` (mesmo pattern do `goNextRef`, listener montado uma vez): `F`=Fold, `C`=Call, `R`=Raise (se visível), `A`=All-in, inicial do `customAction` (resolvida por `pickHotkey` evitando colisão com F/C/R/A), `Espaço`=próxima, `ArrowLeft`=anterior, `V`=abre/fecha Ver Range. Ignorados com foco em input/select/textarea ou modal aberto (exceto V para fechar). Legenda discreta da tecla em cada `DrillActionButton`.

### checkDrillAnswer — severidade (D2)
- Erro `grave` = ação respondida tem 0% na mão (blunder, único jeito de errar com RNG=Não desde a remoção do `acceptAnyFreq`); `impreciso` = freq > 0 mas não é a ação sorteada — só ocorre no modo **RNG=Sim** (responder uma ação que existe no range mas não foi a que o RNG sorteou); com RNG=Não, freq>0-mas-não-principal **conta como acerto válido**, não gera mais `impreciso`.
- Feedback: `✗ Erro grave — Call tinha 0%. Correto: Raise` (RNG=Não) / `✗ Impreciso — Call tinha 25%. Principal: Raise 75%` (RNG=Sim, próximo de acertar).
- Retorna `{ correct, message, severity? }`; grava `severity` no `HandHistoryEntry` e incrementa `sessionSeverity`.

### DrillSummary
- Props: `onClose: () => void` (chama stopDrill + fecha), `onBack?: () => void` (volta ao drill sem encerrar)
- Botão "← Voltar ao treino" só aparece quando `onBack` é definido (drill ainda ativo)
- Stats do topo: lê `sessionStats` do store (sessão atual, não acumulativo)
- Linha extra com contagem de **erros graves** e **imprecisos** (`sessionSeverity`) quando há erros
- Stats por range: computados de `handHistory` (entries têm `rangeName`) — sessão atual
- Heatmap por range: usa `handPerformance` (acumulativo histórico — correto por design)

### HistoryModal
- Sub-componente `SessionDetail` com estado próprio (`openRangeId`, `viewMode`)
- Cada sessão: clicável → expande `SessionDetail`
- `SessionDetail`: stats box (Mãos/Acertos/Erros/Precisão da sessão) + acordeão por range com heatmap
- Heatmap usa `handPerformance` acumulativo (sessões passadas não têm dados por mão)

## PokerTableEditor (`src/components/ui/PokerTableEditor.tsx`)
- Assentos: `w-[55px] h-[55px]` — 15% maior que original
- Exported: `HeroCards` interface `{ r1, s1, r2, s2 }` e componente `PokerTableEditor`
- Prop `heroCards?: HeroCards` — renderiza `SmallCard` pares à direita do círculo do hero via `activeSlots[0]`
- `SmallCard`: `width:38, height:56`, fundo por naipe (`SUIT_BG`), ícone naipe (`SUIT_ICON`)
- Cartas posicionadas com `transform: 'translate(32px, -50%)'` a partir do slot do hero
- Seat badge de stack: apenas número bb (`text-[11.5px]` azul), sem nome da posição
- Villain mini cards: `w-3.5 h-[18px]` em `top-[39px]`
- `BLIND_BET` fallback: SB/BB/STR fold mostram fichas dos blinds mesmo com `bet=0`
- Assentos em `l:0%`/`l:100%` vazam lateralmente — container precisa de `px-10` mínimo
- Stack badge vaza 28px abaixo — wrapper precisa de `pb-8` mínimo (ou `pb-[60px]` no drill)

## ExercisePage — modo "Range Check" (nome escolhido; string central no i18n) (`src/components/Exercise/ExercisePage.tsx`, rota `/montar-range`, page `'exercise'`)
- Exercício de reproduzir ranges de memória, ao lado do Drill na navegação (TopNav/Sidebar, ícone Grid3x3, lazy no AppLayout).
- Fluxo: `BuildRangeSelect` (acordeão por posição, espelho do DrillRangeSelect) → `BuildRound` (pinta grade 13×13 vazia com HandMatrix+BrushControls+ComboCounter reusados; gabarito escondido) → enviar → nota + feedback (`RangeActionGrid` "Seu range"/"Gabarito" lado a lado + `DiffGrid` de diferença por mão) → próximo round → `BuildSummary` (nota média + por round).
- **Rounds**: cada range selecionado vira 1 round; range multi-stack vira **1 round por stackGrid** (label `nome — stackRange`). Round guarda snapshot do grid gabarito e `customAction` (pincel extra configurado ao iniciar o round).
- **Pintura reusa `rangeData.grid` do store** (HandMatrix/BrushControls funcionam sem mudança); `startBuildSession`/`nextBuildRound`/`stopBuildSession` resetam a grade.
- **Nota** (`src/utils/buildScore.ts`, pura+testada): por combos — `combosForaDoLugar = 0.5 × Σ_h Σ_a |real−user|/100 × combosOf(h)` (ações fold/call/raise/allin/extra; fold implícito = 100 − soma), `nota = 100 × (1 − fora/1326)` clamp [0,100]. `perHand` = fração de combos errados por mão (alimenta o DiffGrid). v1 ignora raise size.
- **Store**: `buildSelectedRangeIds`/`buildRounds`/`buildRoundIdx`/`buildResults`/`buildLastResult`/`buildSessionUuid`/`buildHistory` + ações `toggleBuildRange`/`startBuildSession`/`submitBuildRound`/`nextBuildRound`/`stopBuildSession`. `buildRoundIdx >= buildRounds.length` sinaliza o resumo; `stopBuildSession` salva em `pfp-build-history-v1` (via trySave) e limpa tudo.
- **Telemetria**: `submitBuildRound` → `fireEvent('range-build', {rangeId, rangeName, stackRange, score, roundsTotal, session_uuid, client_event_id, wrongHands?})` (fail-open, mesma fila). `wrongHands` (10/07) = mapa mão→fração de combos errados (só mãos com diff>0, 3 casas, derivado do `perHand` do `buildScore`) — persiste na coluna `wrong_hands` (TEXT JSON, `schema_v8.sql`) p/ estudos de quais mãos o time mais erra ao reconstruir ranges; validação `validateWrongHands` (≤169 chaves `isHand`, valores (0,1]); se a coluna não existir o endpoint refaz o INSERT sem ela (fail-open duplo). Endpoint `functions/api/events/range-build.js` (INSERT OR IGNORE, dedupe por client_event_id) + tabela `range_build_events` (`schema_v4.sql`, **já aplicado no remoto em 04/07**).
- **Sessão consolidada no D1 (10/07, paridade com o `training_sessions` do drill)**: `stopBuildSession` (com ≥1 round enviado) → `fireEvent('build-session-end', {roundsTotal, roundsPlayed (roundIdx distintos — retries não inflam), avgScore, durationSeconds, startedAt, session_uuid})`. Endpoint `functions/api/events/build-session-end.js` (`validateBuildSessionPayload` pura+testada, INSERT OR IGNORE com dedupe por `(user_id, session_uuid)`) → tabela `range_build_sessions` em **`schema_v8.sql` — migração D1 manual: `npx wrangler d1 execute preflop-db --file=schema_v8.sql --remote`** (rodar UMA vez: o arquivo também tem o `ALTER TABLE ... ADD COLUMN wrong_hands`, que falha se repetido); sem a migração ambos endpoints respondem 200 `{ok:false, code:'db_error'}` (fila FIFO nunca trava).
- **Progresso do jogador na conta** (10/07): `functions/api/me/stats.js` ganhou views `build-overview` (rounds, nota média/melhor, ranges, sessões, tempo, última atividade — tempo vem de `range_build_sessions`, resto de `range_build_events`; sessões = `COUNT(DISTINCT session_uuid)` com fallback), `build-by-range` e `build-sessions` (agrupa `range_build_events` por `session_uuid` + LEFT-merge da duração de `range_build_sessions`; sem a tabela nova as sessões saem com `durationSeconds: null`) — tudo `WHERE user_id` do token, fail-open por try/catch. UI: **`BuildAccountStats`** (`src/components/Stats/BuildAccountStats.tsx`, cards + Por range + Sessões recentes, padrão Skeleton/retry/vazio do `MyAccountStats`) renderizado em 2 lugares: seção "Range Check (conta)" dentro do `MyAccountStats` (aba nuvem) e no topo da aba Range Check da `StatsPage` quando logado (histórico local ganha o título "Histórico neste dispositivo" e segue intacto p/ deslogados).

## StatsPage (`src/components/Stats/StatsPage.tsx`)
- Lista sessões em ordem reversa com `SessionCard`
- `SessionCard`: accuracy%, data, tableSize, duração, range names, mãos/acertos/erros + botão olhinho
- Botão olhinho → `setSelectedSession(session)` → renderiza `SessionDetailView`
- `SessionDetailView`: cabeçalho com "← Voltar", stats box idêntico ao DrillSummary, acordeão por range com heatmap
- **`AccuracySparkline` (D4)**: SVG inline (sem biblioteca) com accuracy % por sessão em ordem cronológica (`trainingHistory`), escala fixa 0–100, linha de referência tracejada em 80% e tooltip (data + %) ao passar o mouse nos pontos. Some com menos de 2 sessões.

## Convenções e Padrões
- **Sem comentários** no código (exceto WHY não-óbvios)
- **Sem features extras** além do solicitado
- **Tailwind** para todo styling; sem CSS modules ou styled-components
- Validação apenas nas bordas (inputs de usuário); confiar no estado interno
- `useStore(s => s.ação)` para selecionar ações; `useStore.setState({})` para updates diretos pontuais
- Nunca criar arquivos `.md` além deste, a menos que explicitamente pedido

## Bugs Conhecidos / Gotchas
- `{0 && <span>}` em React renderiza literal `0` — usar `{!!valor && <span>}`
- `setBrush` deve sempre fazer `set({ brush: { ...brush, call:c, raise:r, allin:a } })` com os 3 campos
- Assentos do PokerTableEditor têm `z-10/z-20` e podem vazar — `pointer-events-none` no wrapper quando puramente visual
- `<select>` em CSS Grid pode não esticar em Safari sem `w-full` explícito
- Badge de stack vaza 28px abaixo — wrapper precisa de `pb-8` mínimo
- `stopDrill()` NÃO limpa `sessionStats`/`handHistory` — DrillSummary depende disso após encerrar
- `handPerformance` é acumulativo (all-time). Para stats da sessão atual usar `sessionStats` + `handHistory`
- Sub-componentes com estado próprio (ex: SessionDetail) evitam conflito de viewMode entre sessões no accordion

## Preferências do Usuário (Daniel)
- Respostas em português
- Sem emojis
- Mensagens curtas e diretas
- Não precisa confirmar cada passo antes de executar
- Prefere commits separados por feature

## Histórico do Agente Diário + estado atual (30/06/2026)
Estado completo em `.agent/handoff.md`. Resumo consolidado:

### PRs mergeados em `feature/auth-telemetry` (cronológico)
- **PR #5 (24/06):** hardening de segurança — PBKDF2, Turnstile fail-closed, CSP/CORS (`_headers`+`_middleware.js`), rate-limit KV, gestão de sessões ativas, Sentry PII scrub.
- **PR #10 (25–26/06):** suíte de testes completa (RTL+axe todos os componentes), a11y (modais, aria, focus-trap `useModalA11y`), code-split vendors (chunk principal ~265KB), CLAUDE.md docs.
- **PR #12 (26/06):** perf de render (HandMatrix/RangeHeatGrid/RangeActionGrid/HandHistorySidebar/OverviewTableRow memoizados; `renderCount.ts`; lazy-load de 4 páginas), robustez UX (retry/error/empty/Skeleton), ErrorBoundary por área, alerts → inline + DrillSummary.
- **PR #16 (27/06):** observabilidade de erros — `addBreadcrumb`/`captureMessage`, `captureError` em todos os catches silenciosos, Skeleton, eventQueue degradada reportada.
- **PR #22 (29/06):** i18n completo (PT/EN/ES, 507 chaves, `src/i18n/`), responsividade mobile (`sm:`/`md:`/`lg:`/`xl:` aditivos), mesa de poker responsiva (ResizeObserver+scale), tsconfig `noUnusedLocals`/`noUnusedParameters`.
- **PR #23 (29/06):** seletor de idiomas PT-BR/EN/ES (TopNav/Sidebar/LoginPage), `en.ts`/`es.ts` completos, `store.lang` persistido.
- **PR #24 (30/06):** **React 18 → 19** (verificado no browser via Playwright; fix `RouterSync` loop infinito com ref `lastSynced`; fix ciclo `manualChunks` → `vendor-react` só react/react-dom/scheduler) + 13 fatias de cobertura → **560 testes verdes (63 arquivos)**.

### Estado atual (06/07/2026)
- **1015 testes verdes (85 arquivos)**, build verde, smoke verde (Chromium headless: render, navegação, drill, painel coach).
- **Dependabot #20/#21 já mergeados** (commits dedicados `feat(deps): migra ...`, um por dependência, cada um testado+smoke antes do próximo): Tailwind 3→4, Vite 6→8 (+`@vitejs/plugin-react` 6), TypeScript 5→6, react-router-dom 6→7, lucide-react 0.47→1.22. Sem mudança de API/comportamento visual observada. Versões atuais em uso: React 19, Tailwind 4, Vite 8, TS 6, react-router 7, lucide-react 1.x — todas estáveis nesta branch.
- **06/07:** pacote de segurança (PR #48 — CI em PR, rate limit KV nos 5 endpoints de admin com `scope='admin'`, log de auditoria `admin_audit_log`, `escapeHtml` nos e-mails) + proteção de branch no `main` (PR-only, `enforce_admins:true`) + arquitetura (`CoachPanel.tsx` dividido em `CoachPanel/`, helper `requireCoach()` nos 5 endpoints de admin, `README.md` na raiz).
- **09/07:** auditoria manual do fluxo completo (tour + criar range + Drill + Range Check + Histórico) achou e corrigiu: card de sessão do Histórico com "100%" sobrepondo o título (`StatsPage.tsx`, `w-14`→`w-16`); `TableEditorPage.handleFinalize` descartava silenciosamente um range sem nenhuma mão pintada (agora bloqueia com `t.tableEditor.alertEmptyRange`); `DrillSummary` lista os ranges treinados (com mãos jogadas na sessão) antes dos "sem dados". No tour: alvos abaixo da dobra ficavam sem spotlight e o painel estourava a tela em passos com texto longo (`scrollIntoView`+altura medida via `useLayoutEffect`, ver seção do `OnboardingTour` acima); passo `drill-summary` mostrava o resumo sempre zerado (agora preenche números fixos só de exibição, sem poluir `trainingHistory`/`handPerformance` reais — `resetDrillDemoState`); +1 passo novo (`drill-viewrange`, explica a consulta "Ver Range"/tecla V) e textos existentes enriquecidos com atalhos de teclado, Blunder/Impreciso, "+ Nova Condição" e as abas do Histórico.

### Pendências
- [ ] **MFA** em GitHub e Cloudflare (manual — só o Daniel).
- [x] Dependabot #20/#21 (Tailwind 4/Vite 8/TS 6/router 7/lucide 1) — migrados um por vez, testados e smoke-testados individualmente.
- [x] Todas as issues do agente (#2 docs, #4 chunk, #6 rate-limit, #10–#24) fechadas ou mergeadas.
