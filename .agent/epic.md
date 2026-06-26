# EPIC ATIVO — Robustez de estados de UX (loading / empty / error)

> Epics anteriores CONCLUÍDOS: testes+a11y (PR #5, #10 mergeados; issues #2/#4 fechadas) e
> **performance de render** (#11, PR #12 — FASE 1–5 entregues). Histórico no `.agent/handoff.md`.

Objetivo: toda superfície assíncrona ou potencialmente vazia tem estados de **loading**,
**vazio** e **erro** consistentes e claros — sem telas brancas/quebradas. Valor para o cutover
de produção. Issue do epic: **#13** (label `agente`). UMA FATIA SUBSTANCIAL por execução.

## Regras / padrões
- Sem regressão visual no caminho feliz. Cada estado novo coberto por teste (RTL + `fetch` mockado) + axe.
- `npm test` + `npm run build` verdes por fatia. NÃO tocar auth/functions/api/worker/D1/seed.
- Mensagens em PT-BR, sem emojis. Erro de rede → mensagem amigável + ação (tentar de novo) quando fizer sentido.

## Backlog (pegue a próxima fatia do topo)
### FASE 1 — Auditoria
- [ ] Mapear superfícies com `fetch`/async e listas que podem vir vazias; anotar o que já tem
      loading/empty/error e o que falta. Registrar no handoff.

### FASE 2 — Erros de rede sem tela quebrada
- [ ] Cada `fetch` que pode falhar mostra mensagem amigável (+ retry quando fizer sentido) em vez de
      sumir/branco. Padronizar tratamento.

### FASE 3 — Estados vazios consistentes
- [ ] Empty states com texto claro e CTA onde fizer sentido.

### FASE 4 — Loading consistente
- [ ] Skeleton/placeholder discreto sem layout shift nas seções pesadas (coach, stats).

### FASE 5 — Isolamento de falhas
- [ ] ErrorBoundary por área (se medível) p/ não derrubar a página inteira.

## Definição de pronto por fatia
- Estado novo coberto por teste + axe; caminho feliz intacto; `npm test`/`npm run build` verdes;
  commit PT-BR por área; PR do dia + handoff atualizados.
