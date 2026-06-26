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
- [x] (a) `onMouseMove`/`hoveredHand` só no modo heatmap. (b) `Cell` em `React.memo` com handlers
      estáveis (`useCallback` lendo grid/brush/readOnly/heatmap via refs). Prova: mousemove → 0
      re-renders de célula; troca de grid → exatamente 1. (26/06)

### FASE 2 — outras matrizes 169 células
- [x] `Admin/RangeHeatGrid` — `HeatCell` memoizada, `onEnter` estável; mousemove → 0 re-renders. (26/06)
- [x] `Admin/RangeActionGrid` — `ActionCell` memoizada (primitivos bg/empty), `onEnter` estável. (26/06)

### FASE 4 — Drill
- [x] `DrillActive`: `HandHistorySidebar` em `React.memo` (props estáveis: `handleReplayEntry` via
      `useCallback`); estados internos do drill não a re-renderizam. Prova por contagem. (26/06)

### FASE 3 — CoachPanel
- [x] Agregações já eram `useMemo`. Linhas de **Resumo do time** (`OverviewTableRow`) e **Por range**
      (`ByRangeTableRow`) extraídas em `React.memo` com handlers estáveis (`togglePlayer`/`selectRange`).
      Prova: abrir resumo de jogador re-renderiza só 1 linha. (26/06)
      (Opcional/baixo valor: linhas do Top 20 do `TopHandsPanel` — só re-renderiza em troca de aba/seleção.)

### FASE 5 — runtime/bundle em caminhos quentes
- [x] Lazy-load do fluxo de criação/edição de range (RangeSetupPage/RangeEditorPage/TableEditorPage/
      CategoryDetailPage) — fora da carga inicial. Chunk principal ~305KB → ~265KB (gzip ~47→~38KB). (26/06)
- [x] Limpeza: contadores de render movidos para `src/test/renderCount.ts` (no-op em produção, sem
      export de instrumento nos componentes). (26/06)

## EPIC #11 ESSENCIALMENTE CONCLUÍDO (26/06/2026)
FASE 1–5 entregues, todas provadas por contagem de render onde aplicável. 374 testes verdes.
A classe de re-render contínuo (onMouseMove das 3 matrizes 13×13) eliminada; sidebar do drill e
linhas do CoachPanel memoizadas; fluxo de edição lazy. **Próximo epic proposto em issue `agente`.**

## Definição de pronto por fatia
- Comportamento/visual idênticos; testes atuais verdes + teste novo que prove o ganho.
- `npm test` e `npm run build` verdes; commit(s) PT-BR por área; PR do dia + handoff atualizados.
