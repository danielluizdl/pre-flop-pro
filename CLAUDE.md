# Pre-Flop Pro — Guia do Projeto

## Stack
- **Vite + React 19 + TypeScript + Tailwind CSS 3 + Zustand**
- Sem backend. Dados persistidos via `localStorage` manualmente (exceto `darkMode` que usa `zustand/persist`).
- **Tema (dark/claro):** app tem os dois temas, chaveados pela classe `dark` no `<html>` (aplicada em `main.tsx` antes do 1º paint e sincronizada por effect no `AppLayout` a partir de `store.darkMode`; default `true`, persist `fbr-ui-state` v1 com `migrate` que força dark p/ estado v0). Implementação por **tokens CSS por escopo** em `src/index.css`: `@theme` guarda os valores dark; `:root:not(.dark)` injeta a rampa `warm-*` INVERTIDA (fundo claro/texto escuro) + versões escuras dos tons frios usados como texto (`red-400`, `emerald-400`, `yellow-400`, `gold`, `result-*` etc.); o seletor `.dark` restaura os valores exatos em qualquer subtree. A **área da mesa de poker** (caixa do drill no TrainerPage e mesa do TableEditorPage) acompanha o tema via `var(--table-box-bg)`/`var(--table-box-shadow)` no container e `var(--felt-1..3)` no feltro (`PokerTable.module.css`) — as vars só existem no claro (bege + feltro marrom médio); no escuro caem nos fallbacks inline com os valores originais. Há `@custom-variant dark` (class-based) disponível para utilitários `dark:`. **Regras:** cores de AÇÃO (raise/call/all-in/extra) não mudam entre temas; matrizes 13×13 (HandMatrix/RangeActionGrid/RangeHeatGrid) mantêm células de fundo escuro nos dois temas (de propósito — não "clarear"); `text-white` só sobre fundos coloridos fixos, em superfície warm usar `text-warm-100`; hex inline novo deve usar `var(--color-warm-*)` se a superfície acompanha o tema.
- Deploy: GitHub Pages via GitHub Actions ao fazer push para `main` (`https://github.com/danielluizdl/pre-flop-pro`)
- **POLÍTICA DE PRODUÇÃO (CONGELADA):** o link em uso pelos jogadores é **`https://danielluizdl.github.io/pre-flop-pro/`** (GitHub Pages, deploy do `main`). Ele deve ficar **INTACTO** até o site novo estar completo. Portanto: **NÃO mergear nada no `main`** e **NÃO mexer no que afeta o GitHub Pages** até liberação explícita do Daniel. Todo o desenvolvimento do "site completo" acontece na branch dedicada **`feature/auth-telemetry`** (e branches derivadas, ex.: `auto/daily-improvements` do agente), validadas no preview do Cloudflare Pages. Obs.: `public/_headers` (CSP/headers) só vale no Cloudflare Pages — o GitHub Pages o ignora, então mexer nele nunca afeta o link de produção.
- Testes: **Vitest** (`npm test` → `vitest run`), ambiente jsdom. Specs em `src/**/*.test.ts`, **`src/**/*.test.tsx`** (componentes), `worker/**/*.test.js`, `functions/**/*.test.js` (ver `vitest.config.ts`). Testes de componente com **React Testing Library** + `@testing-library/jest-dom` + **`jest-axe`** (a11y); setup em `src/test/setup.ts`; exemplo-padrão `src/components/ui/ComboCounter.test.tsx`. **560 testes verdes (63 arquivos)** — suíte de testes + a11y já coberta. Ver `.agent/handoff.md` para o estado atual do agente diário e próximas fatias. **Smoke de render:** `npm run smoke` (`smoke/smoke.mjs`) builda, serve o dist e verifica no Chromium headless (playwright-core, browser do ambiente/`SMOKE_CHROMIUM`) que o app renderiza de verdade: #root monta, RouterSync (clique/back/F5), drill completo com ranges seedados e painel coach (backend stubado via page.route, rede externa bloqueada). Rodar antes de mergear mudanças de dependência/chunks/router — teste+build verdes NÃO garantem render (já houve 2 telas brancas).
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
    Auth/         LoginPage.tsx, WelcomeModal.tsx, ChangePasswordModal.tsx, Turnstile.tsx
    Admin/        AdminPanel.tsx (worker legado), CoachPanel.tsx, RangeHeatGrid.tsx,
                  RangeActionGrid.tsx (TopHandsPanel, HandDetailCard, PlayerQuickSummary,
                  MultiPlayerSelect, RangeSelect e PeriodFilter são inline no CoachPanel.tsx)
    ui/           PokerTableEditor.tsx, HandQuickSelect.tsx, RangePreviewModal.tsx,
                  ComboCounter.tsx, PrereqRangePicker.tsx, RangeMark.tsx, tableGeometry.ts, PokerTable.module.css
  i18n/           index.ts (Proxy reativo `t`; dicionários pt.ts/en.ts/es.ts — 507 chaves; `setLangDict`+`LANGS`; `LanguageSelect` em TopNav/Sidebar/LoginPage)
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
Cloudflare **Pages Functions** (serverless, cada arquivo exporta `onRequest(context)`) + **D1** (binding `DB`, banco `preflop-db`) + **KV** (binding `RATE_LIMIT`, rate limit de auth). Config em `wrangler.toml` (Pages lê os bindings de lá no build do GitHub). Schema: `schema.sql` (base), `schema_v2.sql` (`session_uuid`/`client_event_id`/dedupe), `schema_v3.sql` (`team_ranges`/`team_ranges_meta` — ranges centralizados; infra pronta, mas o front ainda usa `adminRanges.json` como fonte/fallback). **Deploy automático**: push → Pages builda (preview por branch em `<branch>.pre-flop-pro.pages.dev`; produção `pre-flop-pro.pages.dev` a partir de `main`). **Trabalho ativo na branch `feature/auth-telemetry` — NÃO mergeada para `main` de propósito** (mantém o link de produção antigo intacto). Tudo de nuvem é testado/usado no **preview** `feature-auth-telemetry.pre-flop-pro.pages.dev`. Migrações são manuais: `npx wrangler d1 execute preflop-db --file=schema_vN.sql --remote` (schema_v2 e schema_v3 já aplicados).

- **Secrets/vars** (por ambiente no dashboard): `TEAM_CODE` (gate de cadastro), `TURNSTILE_SECRET_KEY` (Secret), `RESEND_API_KEY`+`EMAIL_FROM` (e-mails). `SESSION_SECRET` existe mas **não é usado no código**. Vars **públicas client-side** (`VITE_TURNSTILE_KEY`, `VITE_SENTRY_DSN`) ficam em **`.env.production` COMMITADO** — porque secrets do tipo `VITE_*` no dashboard NÃO entram no build do Vite (precisariam ser Plaintext); ver memória `project_cloudflare_env`. Tudo é **fail-open**: sem o secret, o recurso é ignorado e o app funciona.
- **Helpers** `functions/api/_utils.js`: `sha256Hex`, `hashPassword` (`SHA-256(salt + ':' + senha)`), `randomHex`, `getAuthUser`, `emailDomainExists` (DNS, fail-open), `checkRateLimit` (in-memory best-effort por `CF-Connecting-IP`, ~8/min, reseta por isolate — fallback), **`checkRateLimitKV`** (persistente no KV `RATE_LIMIT`, janela fixa 8/min por IP; fail-open p/ in-memory sem binding ou se o KV falhar — usado no `login`/`signup`), `verifyTurnstile` (siteverify; fail-open sem `TURNSTILE_SECRET_KEY`), `isHand`/`isUuidOrNull`/`isShortStr`, `json`, `CORS_HEADERS`, `handleOptions`.
- **Auth** (`functions/api/auth/`): `signup`/`login` (com rate limit + Turnstile), `me`, `logout`, `change-password`; `functions/api/admin/reset-password.js` (coach-only: gera senha temporária, `first_login=1`, apaga sessões do alvo). Tabela `users` (role `player`|`coach`, `first_login`, `name`, `email`); `sessions` (token_hash, 30 dias). Fluxo de primeiro acesso: signup novo → `WelcomeModal` (flag transiente `justSignedUp` no store); login com `first_login=1` (senha resetada pelo coach) → força `ChangePasswordModal`.
- **Telemetria** (`functions/api/events/`): `hand`, `consult`, `session-end`. `user_id` SEMPRE do token; sem auth → 200 `{ok:false}`. `hand` valida payload + `INSERT OR IGNORE` (dedupe por `client_event_id`). Tabelas `hand_events`, `consult_events`, `training_sessions`.
- **Analytics do coach** (`functions/api/admin/analytics.js`, coach-only) — `?view=`: `team-overview` (por jogador + TIME), `leaks`, `consult-hotspots`, `by-range` (com `imprecisos` → tipo de erro), `range-grid` (por mão: total/acertos/graves/consultas + `correctAction` + `topWrong` + **`played`** {fold,call,raise,allin,extra} para reconstruir o "range jogado"), `trend` (precisão semanal), `segments` (categoria de mão + ação correta), `knowledge-gaps` (consulta×erro), `player-ranges` (precisão jogador×range — z-score e resumo rápido). Filtros: `playerIds` (CSV), `rangeId`, `days` (1..365), `stackGridIdx` (range-grid). Agrupam por `range_id` com `MAX(range_name)`. **Gotcha:** `consult_events` NÃO tem `stack_grid_idx` — no `range-grid`, as consultas usam cláusula própria (sem o filtro de stack), senão dá 500 em range multi-stack.
- Também: `me/stats.js` (jogador, `WHERE user_id`), `admin/users.js`, `admin/user/[id].js`, `admin/ranges/publish.js` (coach publica ranges no D1) + `ranges/list.js`, `_email.js` (Resend, fail-open: boas-vindas no signup, senha temporária no reset). Import paths: `events/*` e `admin/*` usam `../_utils.js`; `admin/user/*` e `admin/ranges/*` usam `../../_utils.js`.

### Frontend de nuvem
- **Store**: `currentUser`, `authToken` (sessionStorage `pfp-auth-token`), `justSignedUp`, ações `authLogin`/`authSignup`/`authLogout`/`changePassword`/`restoreSession` (em `main.tsx` antes do render), `syncTeamRanges`/`publishTeamRanges` (ranges D1). Telemetria via `fireEvent()` → `src/utils/eventQueue.ts` (fila localStorage `pfp-event-queue`, cap 500, retry/flush). `startDrillSession` gera `session_uuid`; cada `hand` envia `client_event_id`.
- **i18n** (`src/i18n/`): `t` é um **Proxy** que lê o dicionário do idioma vigente (`pt`/`en`/`es`, 507 chaves). Trocar idioma via `setLang` re-renderiza via `key={lang}` no `AppLayout`. `lang` persistido em `fbr-ui-state`. **Não capturar `t.x.y` em constantes de módulo** — congela o idioma do boot. Tokens de domínio não traduzidos (FOLD/CALL/RAISE/ALL-IN, BB, RNG, posições). Para adicionar chave: editar `pt.ts`, `en.ts` e `es.ts` (tsc força completude).
- **Rotas** (`react-router-dom` v6 + `src/components/Layout/RouterSync.tsx`): espelha URL↔`page` do store (`/dashboard`, `/ranges`, `/drill`, `/historico`, `/coach`); `public/_redirects` (`/* /index.html 200`). Lazy/Suspense em CoachPanel/TrainerPage/StatsPage + fluxo de edição (RangeSetup/RangeEditor/TableEditor/CategoryDetail). **GOTCHA React 19:** RouterSync usa ref `lastSynced` p/ evitar loop infinito ping-pong URL↔store — não simplificar.
- **Observabilidade (`src/utils/sentry.ts`)**: init só com `VITE_SENTRY_DSN` (fail-open: tudo vira no-op sem o DSN). API: `captureError(err, {extra})`, `captureMessage(msg, level)`, `addBreadcrumb(category, message, data?)`. **Privacidade**: `beforeSend` faz `scrubEvent` (redige e-mail/token via `redactString`, dropa headers `Authorization`/`Cookie`); `captureError`/`addBreadcrumb`/`captureMessage` também redigem antes de enviar — **nunca** logam senha/token/e-mail crus. **O que é capturado**: crashes de render (`ErrorBoundary`, raiz e por área), erros silenciosos de rede (`MyAccountStats` + hooks do `CoachPanel`, publish), e estados degradados via `captureMessage('warning')` (cota de localStorage estourada, `validateRanges` achando problemas no load). **Breadcrumbs**: navegação (`setPage`), início de drill, login/logout, publish — reconstroem o caminho até um erro. `sendDefaultPii:false`, `tracesSampleRate:0`.
- **LoginPage** (login/signup/forgot + widget `Turnstile.tsx` se `VITE_TURNSTILE_KEY`), **WelcomeModal**, **ChangePasswordModal**.
- **CoachPanel** (`src/components/Admin/CoachPanel.tsx`, rota `/coach`): abas "Visão do time" e "Por jogador". Filtros: `MultiPlayerSelect` (multi, checkboxes alfabéticos, **com input de busca** no topo do dropdown), `RangeSelect` (combobox custom agrupado por posição: clicar abre dropdown com input "Buscar range…" embutido que restringe a lista em tempo real — substitui o `<select>` nativo), e `PeriodFilter` (período). **`PeriodFilter`**: Tudo/7/30/90 dias **+ opção "Custom"** que revela dois `<input type="date">` (início → fim, `[color-scheme:dark]`); ao preencher ambos envia `from`/`to` (unix s) em vez de `days`. **Seção "Matriz do range"** em **duas zonas** (`flex items-start gap-6`): esquerda `flex-1 min-w-0 flex flex-wrap` com **Range real** (gabarito, do `range.grid` via `RangeActionGrid`) + **Range jogado** (reconstruído de `played` via `RangeActionGrid`); direita `shrink-0` coesa com **Precisão/erros** (`RangeHeatGrid`), **`TopHandsPanel`** (abas Top 20 erros / Top 20 consultas, linhas clicáveis — **logo ao lado da Precisão/erros**) e um **slot fixo `w-[270px] shrink-0`** que reserva o espaço do **`HandDetailCard`** (abre ao clicar uma mão **sem deslocar/reflowar os demais painéis**, pois a largura da zona direita é constante). O `HandDetailCard` abre **à direita do Top 20 e no mesmo topo** (assumido pelo `scripts/verifyLayout.cjs`). `ComboCounter` abaixo das matrizes real/jogado. Caixas **colapsáveis** (default minimizadas), nesta ordem: **Por range** (PRIMEIRA — a visão mais importante; tabela ORDENÁVEL por Mãos/Precisão/Blunder/Consultas/Jogadores via `brSortKey`/`brSortDir`+`handleBrSort`, default Mãos desc; largura natural ao conteúdo; coluna **"Tipo de erro"** com label colorido + subtexto `N blunders · M imprecisos` e `title` explicativo (`SEVERITY_HELP`); legenda no topo explicando Conceitual/Estratégia mista/Misto), **Resumo do time** (ORDENÁVEL clicando no cabeçalho ▲/▼ + linha clicável abre `PlayerQuickSummary` = ranges mais treinados / onde mais erra / mais consultados), Maiores leaks (impacto+Wilson), Segmentos, Lacunas de conhecimento, Evolução (regressão), Leaks relativos (z-score). **"Hotspots de consulta" foi REMOVIDO do front** (endpoint `consult-hotspots` segue no `analytics.js`, sem uso). **"Foco da semana" foi REMOVIDO.** **Vocabulário:** erro `grave` (interno, no D1/store/tipos) é exibido como **"Blunder"** em toda a UI (painel coach + app do jogador: feedback do drill, DrillSummary, MyAccountStats, RangeHeatGrid); `severity:'grave'` NÃO muda no banco/código.
- **Componentes coach** (`src/components/Admin/`): `RangeHeatGrid` (matriz por métrica, maxWidth 380), `RangeActionGrid` (matriz por frequência de ação), `TopHandsPanel`, `HandDetailCard`, `PlayerQuickSummary`, `MultiPlayerSelect`. **`ComboCounter`** (`src/components/ui/ComboCounter.tsx`) é reusado no editor e no preview.
- **Utils de data science** (puros + testes vitest): `coachStats` (Wilson, `leakImpact`, `severityProfile`, `knowledgeGapScore`), `coachTrend` (linreg/`classifyTrend`), `handCategories`, `coachRelative` (z-score), `coachFocus` (testado, não usado na UI), `rangeCombos` (`combosOf` par=6/suited=4/offsuit=12, `TOTAL_COMBOS=1326`, `rangeComboStats` → `byAction` incl. **fold** + `accountedCombos` p/ prova real de 100%).
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
- `useRngForFrequency` — true=RNG, false=ação de maior frequência
- `acceptAnyFreq` — (RNG off) aceita qualquer ação com frequência > 0 como acerto (feedback "Válido — ação principal: ...")
- `focusErrors` — (D1) liga amostragem ponderada do nível 2 do `nextDrillHand` (mão dentro do range) por `handPerformance`: peso `3` para mãos nunca treinadas, `1 + 4*(1 - acerto)` para treinadas. Nível 1 (entre ranges) segue uniforme. Desligado (default) = sorteio uniforme atual intacto.
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
  → drill         (TrainerPage: DrillRangeSelect → HandFilterGrid → DrillActive)
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
- "CONTINUAR →" → step 'filter' (HandFilterGrid) sem modificar `drillExcludedHands`
- HandFilterGrid → "INICIAR TREINO" → `startDrillSession()` + `nextDrillHand()`

### HandFilterGrid
- Mostra grid 13×13 com todas as 169 mãos
- Usuário exclui manualmente as mãos que não quer treinar
- **Nunca é modificado automaticamente** ao selecionar ranges
- Só se aplica a ranges SEM `prereqRangeId` (ver lógica de `nextDrillHand` abaixo)

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
- Erro `grave` = ação respondida tem 0% na mão; `impreciso` = freq > 0 mas não é a principal (só com `acceptAnyFreq` desligado).
- Feedback: `✗ Erro grave — Call tinha 0%. Correto: Raise` / `✗ Impreciso — Call tinha 25%. Principal: Raise 75%`.
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

### Estado atual (30/06/2026)
- **560 testes verdes (63 arquivos)**, build verde, preview OK (Playwright: app monta, 0 pageerror).
- **React 19** em uso na branch. react-router 6, lucide-react 0.47, Tailwind 3, Vite 6, TS 5 — versões estáveis.
- **NÃO mergear Dependabot #20** (Tailwind 4/Vite 8/TS 6) **e #21** (router 7/lucide 1) — migrações maiores adiadas, precisam de sessão dedicada com validação no browser.

### Pendências
- [ ] **MFA** em GitHub e Cloudflare (manual — só o Daniel).
- [ ] **Dependabot #20/#21** — migrações Tailwind 4 / react-router 7 (alto risco visual/navegação; NÃO delegar ao agente sem smoke test automatizado no cloud).
- [x] Todas as issues do agente (#2 docs, #4 chunk, #6 rate-limit, #10–#24) fechadas ou mergeadas.
