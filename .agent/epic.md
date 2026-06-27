# EPIC ATIVO — Observabilidade de erros no front (Sentry já plugado)

> Epics anteriores CONCLUÍDOS e mergeados em `feature/auth-telemetry`: testes+a11y (#5/#10),
> performance de render (#11) e robustez de estados de UX (#13) — tudo na PR #12 (merge `36f0b03`).
> Histórico no `.agent/handoff.md`. Issue do epic: **#15** (label `agente`).

Objetivo: capturar os erros "silenciosos" do front (catches que só setam estado) e dar contexto
(breadcrumbs), sem tocar backend. Sentry já tem init condicional (`VITE_SENTRY_DSN`), `captureError`
e scrub de PII no `beforeSend`. UMA FATIA SUBSTANCIAL por execução.

## Princípios (invioláveis)
- `captureError`/`addBreadcrumb`/`captureMessage` são **no-op sem `VITE_SENTRY_DSN`** (caso dos testes).
- Não spammar: capturar erro real (rede/lógica), NÃO validação esperada do usuário.
- Sem PII nova: redigir strings (e-mail/token) e dropar Authorization/Cookie (helpers já existem).
- Caminho feliz intacto. Cada fatia com teste dos helpers (no-op sem DSN, scrub) — sem rede.
- NÃO tocar auth/`functions/api`/worker/D1/seed.

## Backlog (pegue a próxima fatia do topo)
### FASE 1 — Helpers de observabilidade
- [x] `sentry.ts`: `addBreadcrumb` e `captureMessage` (no-op sem DSN, redação de PII); `captureError`
      passa a dar scrub no `extra`. Testes (no-op sem DSN, redação, níveis). (27/06)

### FASE 2 — Capturar erros silenciosos de rede
- [x] `MyAccountStats` + hooks do CoachPanel (`useAnalytics`/`useRangeGrid`/`useTrend`/`useSegments`/
      `usePlayerRanges`) + `publishTeamRanges`: `captureError(e, { area, view })` no catch. (27/06)
- [x] demais catches silenciosos do store: `authLogin`/`authSignup`/`changePassword`/`restoreSession`/
      `syncTeamRanges`/`listDevices`/`revokeDevice`/`revokeOtherDevices`/`adminSaveRanges` ganham
      `captureError(e, { area })` sem mudar o retorno. (Sem PII; no-op sem DSN.) (27/06)

### FASE 3 — Breadcrumbs de ações-chave
- [x] nav (`setPage`), drill start, login ok (role), logout, publish de team ranges. (27/06)
- [x] ações de dados: `finalizeRange` (criar/editar), `deleteRange`, `exportData`, `resetLocalData`.
      Teste novo `src/store/breadcrumbs.test.ts` (mocka `sentry`, cobre nav + as 4 novas). (27/06)

### FASE 4 — Sinais de estado degradado
- [x] `captureMessage('warning')`: cota de localStorage (`storageBlocked`) e `validateRanges` no load. (27/06)
- [x] `eventQueue`: telemetria degradada reporta UMA vez por sessão (flags deduplicadoras) —
      fila cheia (cap 500, descarte de antigos) e falha de gravação por cota. Testes mockam `sentry`. (27/06)

### FASE 5 — Documentação
- [x] Seção de observabilidade no CLAUDE.md (API, privacidade, o que é/não é capturado). (27/06)

## EPIC #15 — núcleo CONCLUÍDO (27/06); resta só a continuação segura da FASE 2 (catches do store)

## Definição de pronto por fatia
- Helpers no-op sem DSN; sem PII nova; caminho feliz intacto; `npm test`/`npm run build` verdes;
  commit PT-BR por área; PR do dia + handoff atualizados.
