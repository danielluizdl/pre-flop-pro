STATUS: EM ANDAMENTO

# Handoff — rotina auto/fable-routine

Branch: `auto/fable-routine` (criada de `feature/auth-telemetry` em 10/07/2026). Push feito.
Baseline ao criar a branch: 1108 testes verdes (92 arquivos), build verde, smoke verde.

## Progresso

### Item 1 — Painel coach pessoal do jogador: FEITO (commit 1082f5d)
- **Backend**: `functions/api/me/analytics.js` — endpoint player-scoped. Reusa
  `runAnalyticsView` (extraído de `functions/api/admin/analytics.js`, refactor puro:
  o dispatch das views virou função exportada; onRequest do admin inalterado em
  comportamento). Segurança: `playerIds` vem SEMPRE do token (`getAuthUser`), o
  parâmetro do cliente é ignorado; whitelist `PLAYER_VIEWS = [by-range, leaks,
  consult-by-range, consult-by-range-hand, range-grid]` — nada de team-overview/
  player-ranges/trend/build-* (não expor agregados do time nem outros jogadores).
  Testes endpoint-level com D1 fake em `functions/api/me/analytics.test.js`
  (401 sem auth, 400 view fora da whitelist, binds só com o user.id do token).
- **Front**: `src/components/Stats/MyCoachPanel.tsx` — nova aba "Análise" no
  Histórico (`StatsPage`), visível só com `currentUser`. Reusa PeriodFilter/
  RangeSelect/Section/useAnalytics/useRangeGrid (hooks de `CoachPanel/shared.tsx`
  ganharam param opcional `endpoint`, default `/api/admin/analytics` — coach não
  muda) + ComboSummary/TopHandsPanel/HandDetailCard/ConsultRangeDetail/severity
  helpers exportados de `TeamView.tsx`. Sem MultiPlayerSelect. HandDetailCard
  ganhou prop opcional `playedLabel` ("Como você jogou esta mão").
  StatsPage: wrapper perde `max-w-2xl` só na aba Análise (matrizes largas).
- **i18n**: chaves novas nos 3 idiomas: `coach.howYouPlayed`,
  `coach.actionGridPlayedTitleSelf`, `coach.actionGridPlayedSubSelf`,
  `stats.tabAnalysis`, `stats.analysisIntro`.
- **Sem migração D1** — só leitura de tabelas existentes.
- Verificado: `npm test` (1113 verdes), `npm run build`, `npm run smoke` (OK).

### Item 2 — Auditoria Histórico + painel coach via Playwright: EM ANDAMENTO
- Próximo passo: script Playwright headless (padrão do `smoke/smoke.mjs` — serve
  dist, page.route stubando /api/*) navegando Histórico (todas as abas, incl.
  Análise nova) e /coach; procurar bugs de UI/texto cortado/responsividade.

### Item 3 — Relógio ao vivo Drill/Range Check: NÃO INICIADO
### Item 4 — Replay completo do histórico: NÃO INICIADO

## Decisões de design
- Endpoint pessoal separado (`/api/me/analytics`) em vez de afrouxar o de admin:
  o guard de coach do admin fica intacto e o contrato do jogador é explícito.
- MyCoachPanel importa de `Admin/CoachPanel/` — Vite gerou chunk compartilhado
  `TeamView` automaticamente, sem tela branca (smoke confirma).
- Views `leaks`/`by-range` etc. respondem para qualquer usuário autenticado
  (coach incluso, vendo os próprios dados) — sem restrição por role de propósito.

## Bloqueios / dúvidas pro Daniel
- Nenhum até agora.
