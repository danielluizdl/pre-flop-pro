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
- [ ] `sentry.ts`: `addBreadcrumb(category, message, data?)` e `captureMessage(msg, level?)` (no-op sem DSN,
      com redação de strings). Testes.

### FASE 2 — Capturar erros silenciosos de rede
- [ ] `MyAccountStats` e hooks do CoachPanel (`useAnalytics`/`useTrend`/`useSegments`/`usePlayerRanges`):
      nos `catch`, além de `setError`, `captureError(e, { area, view })`. Idem ações de rede do store.

### FASE 3 — Breadcrumbs de ações-chave
- [ ] Migalhas: início de drill, publish de ranges, login/logout, troca de página.

### FASE 4 — Sinais de estado degradado
- [ ] `captureMessage` (warning): cota de localStorage (`storageBlocked`), `validateRanges` achando
      problemas no load, telemetria falhando além do retry.

### FASE 5 — Documentação
- [ ] Seção no CLAUDE.md sobre o modelo de observabilidade (o que é/NÃO é capturado por privacidade).

## Definição de pronto por fatia
- Helpers no-op sem DSN; sem PII nova; caminho feliz intacto; `npm test`/`npm run build` verdes;
  commit PT-BR por área; PR do dia + handoff atualizados.
