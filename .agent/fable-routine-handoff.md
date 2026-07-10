STATUS: EM ANDAMENTO

# Handoff — rotina auto/fable-routine

Branch: `auto/fable-routine` (criada de `feature/auth-telemetry` em 10/07/2026).
Estado ao fim do run 1 (10/07): **1114 testes verdes (93 arquivos)**, build verde,
smoke verde, verificação headless do relógio verde. Tudo pushed.

## Progresso

### Item 1 — Painel coach pessoal do jogador: FEITO (commit 1082f5d)
- **Backend**: `functions/api/me/analytics.js` reusa `runAnalyticsView` (extraído de
  `functions/api/admin/analytics.js`; onRequest do admin sem mudança de comportamento).
  Segurança: `playerIds` vem SEMPRE do token; whitelist `PLAYER_VIEWS = [by-range,
  leaks, consult-by-range, consult-by-range-hand, range-grid]` — nunca team-overview/
  player-ranges/trend/build-* (não expõe agregados do time nem outros jogadores).
  Testes endpoint-level com D1 fake em `functions/api/me/analytics.test.js`.
- **Front**: `src/components/Stats/MyCoachPanel.tsx`, aba "Análise" no Histórico
  (`StatsPage`), só com `currentUser`. Hooks de `CoachPanel/shared.tsx` ganharam param
  opcional `endpoint` (default admin — coach intacto); `TeamView.tsx` exporta
  ComboSummary/severity helpers/CONF_DOT/tipos; `HandDetailCard` ganhou prop
  `playedLabel` ("Como você jogou esta mão"); `ConsultRangeDetail` ganhou prop
  `endpoint`. StatsPage perde `max-w-2xl` só na aba Análise.
- **i18n ×3**: `coach.howYouPlayed`, `coach.actionGridPlayedTitleSelf/SubSelf`,
  `stats.tabAnalysis`, `stats.analysisIntro`.
- Sem migração D1 (só leitura de tabelas existentes).

### Item 2 — Auditoria Histórico + coach via Playwright: FEITO
Script padrão smoke (serve dist + page.route stubando /api/* com dados realistas +
localStorage seedado com 25 sessões/6 builds), desktop 1440 e mobile 390, screenshots
+ detector de overflow + console/pageerror. Cobertos: Histórico (5 abas, detalhe de
sessão com e sem handPerf), Análise nova (matriz, TopHands, HandDetail), /coach
(abas Drill e Range Check). O script não foi commitado (`scripts/` é gitignored) —
existia em `scripts/audit.mjs` no container do run 1.
- **Corrigido (commit 1fd6152)**: fileira de abas do Histórico estourava no mobile
  (5 abas → rótulos quebravam em 3 linhas); agora `overflow-x-auto` + `whitespace-
  nowrap`/`shrink-0`.
- **Achado, NÃO corrigido (escopo maior, pro Daniel decidir)**: o header do
  `TopNav` estoura a viewport em 390px em TODAS as páginas (única causa restante de
  scroll horizontal no mobile). `overflow-x-auto` no header clipparia o popover do
  menu de perfil (absolute) — precisa de decisão de design de nav mobile.
- **Achado, relevante pro item 4**: `SessionDetailView` (StatsPage) resolve os
  ranges da sessão POR NOME contra o catálogo atual — range renomeado/apagado some
  do detalhe (o cabeçalho lista o nome, mas a caixa da matriz não aparece).
  `handPerf` novo já é gravado por id (fallback por nome p/ sessões antigas), mas a
  LISTA de ranges vem de `rangeNames`. Consertar no item 4.
- Painéis coach/pessoal com dados realistas: sem erro de console, sem clipping,
  tabelas legíveis nos dois viewports.

### Item 3 — Relógio ao vivo Drill/Range Check: FEITO (commit fb62260)
- `src/components/ui/ElapsedClock.tsx` (+ teste): formatElapsed puro (mm:ss,
  h:mm:ss ≥1h), um setInterval por montagem limpo no cleanup, tick local.
- Drill: no placar (`drill-scoreboard`), fonte `sessionStartTime`. Range Check: no
  cabeçalho do round, fonte `buildSessionId`. i18n `common.elapsedTime` ×3.
- Verificado com Playwright headless (script `scripts/clockcheck.mjs`, gitignored):
  ambos os relógios avançam 00:00 → 00:02 ao vivo. Gotcha aprendido: rotas do
  Playwright casam na ordem inversa de registro — registrar catch-all `**/api/**`
  ANTES das específicas, senão o stub de auth/me nunca responde e cai na tela de login.

### Item 4 — Replay completo do histórico: NÃO INICIADO
Gaps já identificados na auditoria (fazer nesta ordem):
1. `SessionDetailView` deve resolver ranges por id (`TrainingSession` não guarda
   rangeIds hoje — avaliar gravar `rangeIds` na sessão em `stopDrill` + fallback por
   nome pra sessões antigas) e mostrar placeholder pra range apagado em vez de sumir.
2. Replay mão a mão: `handHistory` (cap 50, só em memória) NÃO é persistido na
   sessão — pra replay por mão seria preciso gravar as entries na TrainingSession
   (atenção à cota do localStorage; talvez cap por sessão). Avaliar custo.
3. Range Check: `BuildSession` guarda rounds {label,score,attempt} mas não o grid
   pintado — replay rodada a rodada precisa gravar o grid do usuário (esparso!) por
   round. `BuildHistoryPanel` hoje só expande texto.
4. Paginação: as listas renderizam TODAS as sessões de uma vez (25 seedadas ok;
   centenas podem pesar) — avaliar "mostrar mais".

## Decisões de design
- Endpoint pessoal separado em vez de afrouxar o guard do admin.
- Views pessoais respondem pra qualquer usuário autenticado (coach vê os próprios).
- Vite gerou chunk compartilhado `TeamView` (StatsPage lazy importa pedaços do
  CoachPanel) — smoke confirma sem tela branca.

## Bloqueios / dúvidas pro Daniel
- TopNav mobile (acima). Nenhum outro bloqueio.
