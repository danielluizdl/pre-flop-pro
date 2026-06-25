# EPIC ATIVO — Suíte de testes de componente + acessibilidade

Objetivo: levar o app a uma cobertura de testes real (componentes + fluxos) com
asserts de acessibilidade embutidos, pra destravar com confiança o futuro
cutover de `feature/auth-telemetry` → produção. Trabalho extenso: o agente
avança UMA FATIA SUBSTANCIAL por execução (vários arquivos de teste / vários
componentes), não uma tarefa mínima. Sempre `npm test` + `npm run build` verdes.

## Infra (FASE 0 — FEITA)
- Deps: `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`, `jest-axe` (+ `@types/jest-axe`).
- `vitest.config.ts`: inclui `src/**/*.test.tsx` + `setupFiles: src/test/setup.ts`.
- `src/test/setup.ts`: importa `@testing-library/jest-dom/vitest` + `cleanup` no afterEach.
- Exemplo-padrão: `src/components/ui/ComboCounter.test.tsx`.

## Padrões obrigatórios (siga o exemplo do ComboCounter)
- Arquivo `Componente.test.tsx` ao lado do componente.
- Render: `render(<Componente .../>)` do `@testing-library/react`; query por papel/texto
  acessível (`getByRole`, `getByText`, `getByLabelText`) — evite testar classes CSS.
- **Acessibilidade**: em cada teste de componente, inclua um caso axe:
  `const { container } = render(...); expect((await axe(container)).violations).toEqual([])`.
  Se o axe acusar violação real (label faltando, role errado, contraste, foco),
  **corrija o componente** (está no escopo do epic) e registre a correção no commit.
- **Store (zustand)**: o `useStore` é singleton global. Para estado específico,
  `useStore.setState({ ... })` ANTES do render; lembre que o estado não reseta sozinho
  entre testes — sete o que precisa em cada caso.
- **Router**: componentes que usam hooks do react-router precisam de wrapper
  `<MemoryRouter>` (de `react-router-dom`) no render.
- **Fetch/telemetria**: componentes que chamam `/api/...` — use `vi.spyOn(global, 'fetch')`
  com mock; nunca bata em rede real. Telemetria (`fireEvent`) é no-op sem `authToken`.
- Determinismo: nada de timers reais longos; use `vi.useFakeTimers()` quando houver
  auto-advance/debounce.
- Performance/flakiness: `testTimeout` global = 15000ms (axe em grids grandes — ex.: HandMatrix
  169 células — é lento sob carga paralela). Em asserts async, ancore num texto confiável
  (ex.: `await screen.findByText('<valor certo>')`) antes de `getByText`, em vez de dar
  `findByText` direto no texto que você está validando.

## Backlog do epic (pegue a próxima fatia não-feita do topo)
Marque [x] no commit conforme avança. Cada fase = vários PRs/dias.

### FASE 1 — utils ainda sem teste (vitórias rápidas, pure functions)
- [ ] `src/utils/eventQueue.ts` (fila localStorage, cap 500, retry/flush)
- [ ] `src/utils/hands.ts` — funções ainda não cobertas (focusWeight, weightedPick, generateSuits, stackMatchesRange)
- [ ] `src/utils/validateRanges.ts`, `hash.ts` se houver lacunas
- [ ] Confirmar cobertura dos utils de data science (coachStats/coachTrend/handCategories/coachRelative/rangeCombos) e completar buracos

### FASE 2 — componentes de apresentação (puros, props → render)
- [x] `ui/ComboCounter` (FEITO, exemplo)
- [x] `Stats/AccuracySparkline`, `Admin/RangeActionGrid`, `Admin/RangeHeatGrid`
- [~] `Admin/TopHandsPanel`, `Admin/HandDetailCard`, `Admin/PlayerQuickSummary` (NÃO são arquivos próprios — estão inline no `CoachPanel.tsx`; serão cobertos junto do CoachPanel na FASE 4)
- [x] `ui/PokerTableEditor` (render do layout de assentos/cartas)

### FASE 3 — componentes com store
- [x] `RangeBuilder/BrushControls` (presets, clamp ≤100%, indicador de preset ativo) — 25/06; + `RangeBuilder/RangeSetupPage`, `ui/RangeMark`, `ui/PrereqRangePicker` na mesma fatia
- [x] `RangeBuilder/HandMatrix` (render 13x13, toggle heatmap, applyBrush no clique, axe) — 25/06
- [~] `Admin/MultiPlayerSelect`, `Admin/RangeSelect`, `PeriodFilter` (inline no CoachPanel.tsx — cobrir junto do CoachPanel na FASE 4)
- [x] `Stats/MyAccountStats` (cards, estados vazios, DevicesSection, axe — fetch/store mockados) — 25/06

### FASE 4 — páginas e fluxos (integração)
- [ ] `Trainer/TrainerPage`: DrillActive (responder F/C/R/A, atalhos, próxima/anterior), DrillSummary, severidade
- [ ] `Admin/CoachPanel`: filtros (range/jogador/período), seção "Por range" ordenável, matriz
- [ ] `Auth/LoginPage` (login/signup/forgot, validações), WelcomeModal, ChangePasswordModal
- [x] `Layout/ErrorBoundary` (renderiza filhos / fallback ao lançar erro / axe) — 25/06; restam `Situations/SituationsPage`, `Stats/StatsPage`

### FASE 5 — varredura de acessibilidade dedicada
- [ ] Passar axe em todas as telas-chave e corrigir violações remanescentes (foco visível,
      labels em inputs/botões-ícone, roles de listas/tabelas, `aria-*` de modais/dropdowns,
      navegação por teclado). Registrar cada correção.

## Definição de pronto por fatia
- Testes novos passam; `npm test` (todos) e `npm run build` verdes.
- Asserts de a11y incluídos nos testes de componente; violações reais corrigidas.
- Commit(s) em PT-BR por área; PR do dia atualizado com o resumo; handoff atualizado
  com a próxima fatia priorizada.
