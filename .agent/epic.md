# EPIC ATIVO — Performance de render e higiene de re-render

> Epic anterior (suíte de testes de componente + acessibilidade) **CONCLUÍDO em 26/06/2026**:
> 368 testes (54 arquivos), varredura de a11y completa, PRs #5 e #10 mergeados em
> `feature/auth-telemetry`, issues #2 e #4 fechadas. Histórico no `.agent/handoff.md`.

Objetivo: reduzir re-renders desnecessários nos componentes interativos pesados
(matrizes 13×13, painel coach, drill), **sem mudar comportamento ou visual**, com
prova do ganho (contagem de render / antes-depois) e teste que trave a melhoria.
Issue do epic: **#11** (label `agente`). O agente avança UMA FATIA SUBSTANCIAL por execução.

## Regras / padrões
- Sem mudança de comportamento nem visual. Toda fatia mantém `npm test` + `npm run build` verdes.
- Provar o ganho: preferir um teste de **contagem de render** (contador num componente memoizado,
  ou `vi.fn` no corpo de render) mostrando que uma interação que antes re-renderizava tudo agora não.
- Memoização com cuidado: `React.memo` em células/linhas + `useCallback`/`useMemo` para handlers e
  derivações; cuidado com closures stale (deps corretas). Refs já existentes (ex.: `isDrawing`) ajudam.
- NÃO mexer no boot/seed (`adminRanges.json`) — é gate (#4). Nada de auth/functions/api/worker/D1.

## Achado-âncora (verificado 26/06)
`HandMatrix.tsx`: `onMouseMove` no grid chama `setMousePos` a CADA movimento → re-render das 169
células continuamente, inclusive ao editar (o tooltip só existe no modo heatmap). `mousePos`/
`hoveredHand` só servem ao tooltip do heatmap.

## Backlog (pegue a próxima fatia do topo)
### FASE 1 — HandMatrix (achado-âncora)
- [ ] (a) Só atualizar `mousePos`/`hoveredHand` no modo heatmap (guard no `onMouseMove`/`onMouseEnter`).
      (b) Extrair `Cell` memoizada (`React.memo`) com handlers estáveis (`useCallback`), para que mover
      o mouse no heatmap (tooltip) não re-renderize as 169 células. Prova: teste de contagem de render
      + testes atuais (pintura/toggle/axe) verdes.

### FASE 2 — outras matrizes 169 células
- [ ] `Admin/RangeHeatGrid` — célula memoizada; não recomputar estilos/legenda por render.
- [ ] `Admin/RangeActionGrid` — idem.

### FASE 3 — CoachPanel
- [ ] `useMemo` nas agregações por range/jogador; linhas de tabela (`Resumo do time`, `Por range`,
      Top 20) memoizadas; handlers estáveis. Evitar recriar `Col`/render props a cada render.

### FASE 4 — Drill
- [ ] `DrillActive`: garantir que responder/digitar não re-renderiza `HandHistorySidebar` inteira;
      memoizar a sidebar e os itens do histórico se medível.

### FASE 5 — runtime/bundle em caminhos quentes
- [ ] Revisar imports pesados em caminhos quentes; lazy onde fizer sentido (sem tocar o seed).

## Definição de pronto por fatia
- Comportamento/visual idênticos; testes atuais verdes + teste novo que prove o ganho.
- `npm test` e `npm run build` verdes; commit(s) PT-BR por área; PR do dia + handoff atualizados.
