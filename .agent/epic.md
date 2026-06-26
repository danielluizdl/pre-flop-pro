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
- [x] Superfícies async mapeadas (handoff): store (ações `{ok}`), eventQueue (retry próprio),
      CoachPanel (loading/empty/error por seção), MyAccountStats (tinha gaps → corrigidos). (26/06)

### FASE 2 — Erros de rede sem tela quebrada
- [x] MyAccountStats: erro → mensagem + "Tentar novamente"; DevicesSection distingue falha de vazio. (26/06)
- [x] CoachPanel: hooks expõem `reload()`; `Section` mostra "Tentar novamente" no erro (7 seções). (26/06)

### FASE 5 — Isolamento de falhas
- [x] `ErrorBoundary` ganhou `variant="section"` + `resetKey`; AppLayout isola a área de página
      (`resetKey={page}`) — crash de página não derruba a navegação. (26/06)

### FASE 3 — Estados vazios consistentes (próxima — menor prioridade)
- [ ] Empty states já existem na maioria; revisar CTAs. Trocar os `alert()` do drill/seleção
      (`TrainerPage` linhas ~518/671/1080: "Nenhuma mão selecionada", "Selecione pelo menos um range",
      "Sem mais mãos") por mensagens inline — toca o fluxo do drill, fazer com cuidado/teste.

### FASE 4 — Loading consistente (opcional, baixo valor)
- [ ] Skeleton/placeholder sem layout shift nas seções pesadas (hoje é texto "Carregando…").

## Definição de pronto por fatia
- Estado novo coberto por teste + axe; caminho feliz intacto; `npm test`/`npm run build` verdes;
  commit PT-BR por área; PR do dia + handoff atualizados.
