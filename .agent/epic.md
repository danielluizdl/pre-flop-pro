# EPIC ATIVO — Pendências de produto P1/P3 (autorizadas pelo Daniel em 02/07)

> Epics anteriores CONCLUÍDOS: testes+a11y (#5/#10), perf (#11), robustez UX (#13),
> observabilidade (#15), i18n+responsividade (#17/#22/#23), migrações de stack
> (React 19/Vite 8/TS 6/Tailwind 4/router 7) e cobertura incremental massiva
> (PRs #29/#34/#35 — 725 testes, ~89% linhas). Histórico no `.agent/handoff.md`.

Objetivo: entregar as pendências de produto que estavam aguardando decisão.
Daniel autorizou em 02/07 ("pode prosseguir com a sua sugestão").

## Princípios (invioláveis)
- Front-only: NÃO tocar auth/`functions/api`/worker/D1/schema.
- i18n: toda string nova entra em `pt.ts`, `en.ts` E `es.ts` (tsc força).
- Cada fatia com testes; `npm test` + `npm run build` verdes antes do commit.
- Mudança visual nova → sinalizar validação no preview Cloudflare na PR.

## Backlog
### P1.1 — Badge "Range do Time" + proteção de edição — FEITO (02/07)
- [x] `syncTeamRanges` persiste os IDs em `pfp-team-range-ids` + estado `teamRangeIds`.
- [x] `RangeCard`: badge "Coach" + Editar desabilitado com tooltip (gate `role !== 'coach'`).
- [x] Testes (sync grava ids; badge+bloqueio p/ jogador; coach não afetado; range fora do time editável).

### P3.8 — Exportar sessão de treino como CSV — FEITO (02/07)
- [x] `buildSessionCsv`/`sessionCsvFilename` em `src/utils/sessionCsv.ts` (stack tem
      precedência sobre agregado; fallback por nome; escaping CSV). 7 testes.
- [x] Botão "Exportar CSV" no `SessionCard` (ícone download, `downloadText` text/csv).
- [x] Teste do botão (createObjectURL + click do anchor).

### Extras (se sobrar orçamento)
- [ ] Polimentos apontados nos handoffs (baixo risco, validáveis por teste).

## Definição de pronto por fatia
Sem PII nova; caminho feliz intacto; testes+build verdes; commit PT-BR por área;
PR do dia + handoff atualizados.
