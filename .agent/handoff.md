# Handoff — Agente Diário (Pre-Flop Pro)

## 2026-06-27 (epics #11 e #13 MERGEADOS; epic #15 observabilidade — núcleo feito)

### Estado atual (PONTO DE PARTIDA do próximo run)
- **PR #12 MERGEADA** em `feature/auth-telemetry` (merge `36f0b03`) entregando os epics **#11 (perf)** e
  **#13 (robustez de UX)**. Issues #11 e #13 **fechadas**. #14 fechada (decisão: seguir observabilidade).
- **Epic ATIVO: #15 — observabilidade de erros no front** (`.agent/epic.md`). **PR #16 ABERTA**
  (auto/daily-improvements → feature/auth-telemetry), NÃO mergeada. **390 testes verdes (55 arquivos)**, build verde.
- Branch de trabalho `auto/daily-improvements` rebaseada no `feature/auth-telemetry` pós-merge.

### Feito hoje no #15 (FASE 1,2,3,4,5 — núcleo completo)
- **FASE 1**: `sentry.ts` ganhou `addBreadcrumb`/`captureMessage` (no-op sem DSN, redação de PII);
  `captureError` dá scrub no `extra`. Testes em `sentry.test.ts`.
- **FASE 2**: `captureError(e,{area,view})` nos catches silenciosos de `MyAccountStats` e dos 5 hooks do
  CoachPanel + `publishTeamRanges`.
- **FASE 3**: breadcrumbs em nav/drill-start/login/logout/publish (no store).
- **FASE 4**: `captureMessage('warning')` em `storageBlocked` e `validateRanges` no load.
- **FASE 5**: seção de observabilidade no CLAUDE.md.

### PRÓXIMA FATIA (continuar de onde parei — segura, no-DSN no-op, sem PII)
**FASE 2 (resto):** adicionar `captureError(e,{area})` nos demais catches silenciosos do `src/store/useStore.ts`
que hoje só fazem `catch { return {ok:false} }`: `authLogin`, `authSignup`, `changePassword`,
`restoreSession`, `syncTeamRanges`, `listDevices`, `revokeDevice`, `revokeOtherDevices`, `adminSaveRanges`.
Não mudar o retorno; `import { captureError }` já existe no store. Depois: atualizar PR #16 + handoff.
Quando o #15 fechar de vez, propor próximo epic (responsividade #1 ou i18n #2 da issue #14 — ambos pedem
decisão do Daniel; responsividade precisa de validação no preview).

---

## 2026-06-26 (continuação 3 — epic #11 FECHADO + início do epic #13 robustez de UX)

Epic **#11 (performance de render) essencialmente concluído** (FASE 1–5; PR #12 atualizada). Aberto o
**próximo epic #13 (robustez de estados de UX: loading/empty/error)** e já iniciado.

### Auditoria (FASE 1 do #13) — superfícies com fetch/async no front
- `src/store/useStore.ts` (auth/telemetria/devices/ranges): ações retornam `{ok}`; quem trata é a UI.
- `src/utils/eventQueue.ts`: fila com retry/flush próprio — robusto, sem UI.
- `src/components/Admin/CoachPanel.tsx`: hook `useAnalytics` já tem `loading`/`error`/`empty` por seção (via `Section`). OK. (Possível melhoria futura: retry nos erros de seção.)
- `src/components/Stats/MyAccountStats.tsx`: **tinha 2 gaps — CORRIGIDOS nesta sessão** (ver abaixo).
- `LoginPage`/`ChangePasswordModal`: mostram erro inline (OK).

### Feito (FASE 2 do #13)
- **MyAccountStats robusto**: (1) erro de rede nas stats → mensagem + **"Tentar novamente"** (recarrega via `retry` em dep do effect); (2) `DevicesSection` distingue **falha** de **vazio** (antes mostrava "Nenhuma sessão ativa" mesmo em erro). Testes: erro→retry→dados; falha de sessões mostra erro. 376 testes verdes.

### Feito também (mesma sessão — #13 FASE 2 e 5)
- **CoachPanel retry**: `useAnalytics`/`useTrend`/`useSegments`/`usePlayerRanges` expõem `reload()` (tick em dep);
  `Section` mostra "Tentar novamente" no erro; as 7 seções do TeamView passam `onRetry`. Teste: erro→retry→dados.
- **ErrorBoundary por área (FASE 5)**: `variant="section"` (fallback compacto) + `resetKey`; AppLayout envolve
  a área de página com `resetKey={page}` → crash de página não derruba a navegação; navegar recupera. Testes.

### Feito também (#13 FASE 3 e 4 — EPIC #13 FECHADO)
- **FASE 3**: todos os `alert()` removidos. Seleção/filtro do drill → inline `role="alert"`; esgotar as
  mãos no drill → abre o `DrillSummary` (via `onShowSummary`) no lugar de alert+stop.
- **FASE 4**: `src/components/ui/Skeleton.tsx` (pulse, respeita reduced-motion). MyAccountStats loading =
  cards-skeleton espelhando o layout (sem salto); seções do CoachPanel = barras. `role="status"`+`aria-busy`.

### Estado (#13)
- **EPIC #13 CONCLUÍDO (FASE 1–5)**. **384 testes verdes (55 arquivos)**, build verde.
- PR #12 cobre os dois epics (#11 perf + #13 robustez). NÃO mergeada (gate humano).

### Próximo epic (a propor em issue `agente`)
Sugestões: **responsividade/mobile** (drill e matrizes em telas pequenas — maior risco visual, validar no
preview) · **i18n/strings centralizadas** · **observabilidade de erros no front** (sem tocar backend).

---

## 2026-06-26 (continuação — NOVO EPIC: performance de render · issue #11)

Epic de testes/a11y CONCLUÍDO e PR #10 **MERGEADA** em `feature/auth-telemetry` (issues #2 e #4 fechadas).
Aberto o próximo epic (**performance de render**, issue #11, label `agente`) e já avançado:

### Feito (3 fatias provadas por contagem de render)
1. **perf HandMatrix (FASE 1):** o `onMouseMove` do grid atualizava `mousePos` a CADA movimento →
   re-render das 169 células continuamente, inclusive ao editar (tooltip só existe no heatmap).
   Agora: `onMouseMove` só ativo no heatmap; `Cell` em `React.memo` com handlers estáveis (`useCallback`
   lendo grid/brush/readOnly/heatmap via **refs**, p/ não recriar callbacks e quebrar o memo).
   Prova: mousemove → 0 re-renders de célula; troca de grid → exatamente 1. `export __cellRenderCount`.
2. **perf RangeHeatGrid + RangeActionGrid (FASE 2):** mesmo padrão — `HeatCell`/`ActionCell` memoizadas,
   `onEnter` estável; passei **primitivos já computados** (cor/bg/empty) p/ o memo segurar (evita
   `{}`/identidade nova). mousemove → 0 re-renders. `__heatCellRenderCount`/`__actionCellRenderCount`.
3. **perf DrillActive (FASE 4):** `HandHistorySidebar` (até 50 itens) em `React.memo` com props estáveis
   (`handleReplayEntry` → `useCallback([ranges, activeDrillRange])`; `onShowHistory` já estável do pai).
   Estados internos do drill (ex.: alternar "2s") não a re-renderizam — só o `handHistory` (sua própria
   assinatura no store). Prova: toggle "2s" → 0 re-renders da sidebar. `__sidebarRenderCount`.

### Padrão do epic (replicar)
- Memoizar célula/linha pesada em `React.memo`; handlers estáveis via `useCallback` (ler valores
  voláteis por **ref** quando preciso, p/ manter identidade); passar **primitivos** (não objetos
  recriados) ao componente memo. Provar com um `export const __xRenderCount = { n: 0 }` incrementado
  no render do memo + teste (`fireEvent.mouseMove`/interação → contagem esperada). Comportamento/visual idênticos.

### Feito também (mesma sessão — fecha o epic #11)
4. **LIMPEZA dos contadores:** `src/test/renderCount.ts` (`countRender`/`getRenderCount`/`resetRenderCount`);
   `countRender(key)` com incremento guardado por `import.meta.env` (no-op em produção). Componentes não
   exportam mais `__xRenderCount`. Testes de contagem usam `getRenderCount('handCell'|'heatCell'|'actionCell'|'historySidebar'|'overviewRow')`.
5. **perf CoachPanel (FASE 3):** agregações já eram `useMemo`; extraí `OverviewTableRow` e `ByRangeTableRow`
   em `React.memo` (handlers `togglePlayer`/`selectRange` via `useCallback`). Prova: abrir resumo de jogador
   re-renderiza só 1 linha. (`TopHandsPanel` Top 20 fica como opcional de baixo valor.)
6. **perf bundle (FASE 5):** lazy-load de RangeSetupPage/RangeEditorPage/TableEditorPage/CategoryDetailPage
   (Suspense já existia no AppLayout). Chunk principal ~305KB → **~265KB** (gzip ~47→~38KB).

### Estado
- Testes: **374 passam (54 arquivos)**. Build: verde (warning só do chunk de dados `admin-ranges`).
- Branch: `auto/daily-improvements`; pushada. **PR #12 ABERTA** (auto/daily-improvements → feature/auth-telemetry) — atualizar com TODAS as fatias de perf. NÃO mergear (gate humano).
- **EPIC #11 ESSENCIALMENTE CONCLUÍDO**: FASE 1–5 entregues; classe de re-render contínuo (onMouseMove das 3 matrizes) eliminada.

### Próximo epic
Proposto em issue `agente`: **robustez de estados (loading/empty/error)** OU **responsividade/mobile**.
Recomendo robustez de estados (menor risco visual, valor pra produção). Ver issue criada.

### Padrão do epic #11 (replicável em futuros)
- Memoizar célula/linha pesada em `React.memo`; handlers estáveis via `useCallback` (ler valores voláteis
  por **ref** quando preciso); passar **primitivos** ao memo. Provar com `countRender(key)` (src/test/renderCount.ts) + teste.

---

## 2026-06-26 (sexta — performance, a11y, cobertura final · ISSUES #4 e #2)

### Feito hoje (8 fatias, cada uma commitada + pushada em auto/daily-improvements)
1. **perf(#4): code-split de vendors** (`vite.config.ts`). `manualChunks` separa `vendor-react` (react/react-dom/scheduler/react-router), `vendor-sentry` e `vendor`. Chunk principal do app: ~554KB → **~303KB** (gzip 130KB→47KB). O único chunk >500KB agora é o JSON de dados `admin-ranges` (1.4MB, gzip 46KB), isolado de propósito — o warning do build é só ele.
2. **docs(#2): CLAUDE.md** — "Estrutura de Pastas" atualizada (Auth/, Admin/coach, Layout/TopNav+RouterSync+ErrorBoundary, Stats/MyAccountStats+AccuracySparkline, Situations/CategoryDetailPage, ui/ e utils de data science + functions/api) + nota de bundle do #4. Correção: TopHandsPanel/HandDetailCard/PlayerQuickSummary/MultiPlayerSelect/RangeSelect/PeriodFilter são **inline** no `CoachPanel.tsx`.
3. **a11y(css): foco visível padrão** (`src/index.css`) — `:focus-visible` (outline brand 2px) para inputs/selects/textarea nativos sem a classe `.input`. Não reflowa; não aparece em clique de mouse.
4. **test: RouterSync + Turnstile** (sobra) — redirect de página transiente, rota desconhecida→dashboard, espelho store→URL; Turnstile desabilitado sem `VITE_TURNSTILE_KEY`. RouterSync racea quando store e URL discordam no mount → testar com eles em acordo (o app já seed a page pela URL antes do render).
5. **test: AdminPanel + AppLayout** (sobra) — publish via `adminSaveRanges` stub, senha incorreta, botão desabilitado; login/nav/banner de storage. **Todos os componentes do app têm teste agora.** (gotcha tsc: `adminLastError` é `string|undefined`, não null.)
6. **a11y: role="dialog" + aria-modal + aria-labelledby** nos **8 modais** do app (AdminPanel, RangePreviewModal, PrereqRangePicker, WelcomeModal, ChangePasswordModal, heatmap de SituationsPage, nome do range no TableEditor, Ver Range do drill), cada um rotulado pelo próprio título.
7. **test: trava semântica de diálogo** em RangePreviewModal e AdminPanel (`getByRole('dialog', { name })`).

### Continuação (mesma sexta — FASE 5 a11y aprofundada, +6 fatias)
8. **a11y: focus-trap + Esc + foco inicial — hook `src/utils/useModalA11y.ts`** `(open, onClose?)`: foca dentro do diálogo ao abrir, prende Tab/Shift+Tab, fecha no Esc (se `onClose`), restaura o foco ao fechar. `onClose` ausente = modal obrigatório (trap sem Esc, usado no ChangePasswordModal). Aplicado aos **8 modais**. Hook com teste próprio (`useModalA11y.test.tsx`: foco inicial, Esc, trap nas 2 direções, modal obrigatório). **Detalhe importante:** o hook depende de `open` e usa `onCloseRef` (effect só roda em mount/abertura, sem thrash de foco). Para modais inline (renderizados condicionalmente dentro de um pai que fica montado) passar o booleano de aberto; para modais que montam/desmontam inteiros, passar `true`.
9. **test: aprofunda DrillActive** — "Ver Range" abre diálogo + incrementa `sessionStats.consults` (logConsult); Esc fecha o "Ver Range"; auto-advance ("2s") chama `nextDrillHand` 2s após a resposta (fake timers + stub, e não antes).
10. **test: DrillSummary + HistoryModal** — "Encerrar e ver resumo" abre o resumo (precisão 80% + Blunders/Imprecisos da severidade); clicar HISTÓRICO abre o histórico de treino.
11. **a11y(css): `prefers-reduced-motion`** — reset que reduz animações/transições a ~0ms (não toca lógica; auto-advance e fade do WelcomeModal são JS).
12. **a11y: ARIA nos comboboxes do CoachPanel** — `MultiPlayerSelect`/`RangeSelect` ganham `aria-haspopup="listbox"` + `aria-expanded` (reflete aberto) + `aria-label`; inputs de busca com `aria-label`. Teste cobre o toggle de `aria-expanded`.
13. **a11y: `aria-expanded` nos acordeões** — `Section` do CoachPanel + grupos por posição do SituationsPage e do DrillRangeSelect.
14. **a11y: teclado nos comboboxes do CoachPanel.** `RangeSelect` virou combobox/listbox real (input `role="combobox"` + `aria-activedescendant`, opções `role="option"` `aria-selected` em `role="group"` por posição; setas movem a opção ativa, Enter seleciona, Esc fecha). `MultiPlayerSelect` (checkboxes nativos, já operáveis por teclado) ganhou Esc-fecha + `role="group"`. Testes cobrem seleção por teclado e Esc.
15. **test: componentes inline do CoachPanel.** Exportados `TopHandsPanel`/`HandDetailCard`/`PlayerQuickSummary` (antes locais) + testes isolados (abas/ordenção/onSelect/vazio/axe; barra "como o time jogou"; 3 colunas com fetch mockado).

### Estado
- Testes: **368 passam (54 arquivos)**. Build: verde.
- Warning de build: SÓ o chunk de dados `admin-ranges` (1.4MB). Código do app em ~305KB. Não é regressão.
- Branch: `auto/daily-improvements`; pushada. PR **#10** aberta. NÃO mergeada (gate humano). `main`/produção intactos.
- **Riscos:** nenhum de comportamento — chunking, testes, CSS de a11y (foco/reduced-motion) e atributos ARIA. O focus-trap muda o comportamento de teclado dos modais (intencional, coberto por teste); validar no preview se desejar.

### Próximas fatias (priorizadas)
Backlog de alto valor e baixo risco essencialmente esgotado. O que sobra precisa de decisão sua ou é gate humano:
1. **#4 (precisa de aval):** o warning remanescente é só o JSON `admin-ranges` (seed estático, deliberado). Dynamic import do seed mudaria o boot → fora do escopo do agente sem aval do Daniel. NÃO subir `chunkSizeWarningLimit` acima de 1.4MB. Provável ação: documentar como esperado e fechar #4.
2. **Polimentos opcionais menores:** `scrollIntoView` da opção ativa no `RangeSelect` ao navegar por setas (cosmético); `PeriodFilter` poderia expor mês/atalhos. Baixo valor.
3. **Gate humano (inalterado):** auth/`functions/api`/worker/D1, MFA. Issue #6 segue aberta.

### Issues
- **#4** — chunk do app caiu para ~305KB; resta só decisão sobre o warning do chunk de dados (ver acima).
- **#2** — Estrutura de Pastas atualizada; pode fechar.

---

## 2026-06-25 (continuação — sessão interativa com Daniel · EPIC FASE 3→4)

### Feito hoje (além da fatia do agente das 5h)
- **+10 testes RTL + axe** (3 arquivos novos):
  - `src/components/RangeBuilder/HandMatrix.test.tsx` — render do grid 13×13 (169 células via `[data-hand]`), toggle "Ações"/"Erro-Acerto" com `heatmap`, `applyBrush('AA')` no `mouseDown` de célula vazia (store via `setState`), axe.
  - `src/components/Layout/ErrorBoundary.test.tsx` — renderiza filhos sem erro; fallback ("Algo deu errado" + botões Recarregar / Exportar backup) quando um filho lança; axe. `console.error` silenciado no teste.
  - `src/components/Stats/MyAccountStats.test.tsx` — cards (702/88%/Blunders/Imprecisos), estados vazios (range/mãos/sessões), DevicesSection; `fetch` e `listDevices` mockados; axe.
- **Infra:** `vitest.config.ts` ganhou `testTimeout: 15000` (axe em grids grandes como o HandMatrix estoura o default de 5s sob carga paralela).
- **Fix de fonte (CSP):** `public/_headers` `connect`/`style`/`font-src` agora liberam `fonts.googleapis.com` + `fonts.gstatic.com` — o CSP do N3 estava bloqueando o `@import` do Google Fonts em `src/index.css` e derrubando a Bebas Neue pro fallback. Fonte original restaurada nos previews.

### Estado
- Testes: **325 passam (48 arquivos)**. Build: **verde** (warning conhecido: chunk principal >500KB, issue #4).
- Branch: `auto/daily-improvements` (← `feature/auth-telemetry`, já com o fix da fonte mergeado). PR **#10** aberta, NÃO mergeada (gate humano). Produção/`main` intactos.
- **Riscos:** nenhum de comportamento — testes novos + `testTimeout` + 1 linha de CSP (libera Google Fonts).
- Nota: FASE 1 (utils) já tinha cobertura (`eventQueue.test.ts`, `hands.test.ts` existem) — não duplicar.

### Feito também (continuação 25/06 — FASE 4 Auth)
- **+13 testes RTL + axe** (3 arquivos): `Auth/LoginPage` (login/signup/forgot, validação de senha curta, `authLogin` chamado), `Auth/ChangePasswordModal` (valida tamanho/coincidência, chama `changePassword`), `Auth/WelcomeModal` (saudação + botão).
- **A11y corrigida:** `LoginPage` e `ChangePasswordModal` tinham `<label>` sem associação → associei via `htmlFor`/`id` (5 + 2 inputs). axe verde.
- Estado atualizado: **285 testes (36 arquivos)**, build verde.

### Feito também (continuação 25/06 — CoachPanel)
- **+5 testes** (`Admin/CoachPanel.test.tsx`): render com `fetch` mockado, abas Visão do time / Por jogador, botão de publicar, filtros, **período Custom revela 2 `input[type=date]`**, "Por range" como 1ª seção, Hotspots ausente, axe.
- **A11y corrigida:** `PeriodFilter` — `aria-label` no `<select>` (violação `select-name`) e nos dois `input[type=date]`.
- Estado: **290 testes (37 arquivos)**, build verde.

### Feito também (continuação 25/06 — fecha o grosso da FASE 4)
- **+12 testes** (3 arquivos): `Situations/SituationsPage` (header/vazio/expande/axe), `Stats/StatsPage` (header/vazio/totais/troca de aba/axe), `Trainer/TrainerPage` (DrillRangeSelect render/vazio/grupo, DrillActive renderiza com FOLD via setState, axe na seleção).
- **A11y corrigida:** `SituationsPage` — `title="Apagar range"` no botão de lixeira (violação `button-name`) e card `h3`→`h2` (violação `heading-order`, a página tem `h1`).
- Estado: **302 testes (40 arquivos)**, build verde.

### Feito também (continuação 25/06 — FASE 5 iniciada)
- **+4 testes**: `Trainer/TrainerPage` **fluxo profundo do drill** (clicar FOLD numa mão raise-100 → "Blunder"; clicar RAISE → acerto — monta o grid de ações via setState, mesmo padrão do `drillFeatures.test.ts`); `Layout/Dashboard` (hero, stats, categorias, axe).
- Estado: **306 testes (41 arquivos)**, build verde.

### Feito também (continuação 25/06 — FASE 5 quase completa)
- **+15 testes (6 arquivos)**: `RangeEditorPage`, `TableEditorPage`, `ui/RangePreviewModal`, `ui/HandQuickSelect`, `Layout/Sidebar`, `Layout/TopNav` — todos render + axe.
- **A11y corrigida:** `RangeEditorPage` h3→h2; `TableEditorPage` `aria-label` em 6 controles sem nome (radio HERO, select de ação, inputs de stack/aposta/raise/nome) + h3→h2/h4→h3. Sidebar/TopNav/HandQuickSelect já estavam limpos (`title` nos botões-ícone, nav com labels).
- Estado: **321 testes (47 arquivos)**, build verde. Para montar o PokerTableEditor em teste, setar `activeSlots: SLOTS_8MAX` junto de `activePositions: POS_8MAX` (senão `<Seat>` crasha lendo `.t`).

### Feito também (continuação 25/06 — FASE 5 essencialmente completa)
- **+4 testes**: `Situations/CategoryDetailPage` (categoria/vazio/axe; a11y h3→h2) e atalho de teclado do drill no `TrainerPage` (`fireEvent.keyDown(window,{key:'f'})` → Fold/Blunder).
- Estado: **325 testes (48 arquivos)**, build verde.

### EPIC praticamente CONCLUÍDO
Todas as fases (0–5) cobertas: infra, utils, componentes de apresentação, com store, páginas/fluxos, e
varredura de a11y (corrigindo violações reais ao longo do caminho). Sobras menores e NÃO bloqueantes para
o agente pegar como cobertura incremental:
1. `Trainer` HistoryModal e DrillSummary isolados (axe).
2. `Admin/AdminPanel` (publish legado via worker) — render + axe.
3. `ui/PokerTableEditor` isolado e os componentes ainda inline no CoachPanel (TopHandsPanel/HandDetailCard/etc.).
4. Aprofundar comportamento do DrillActive: navegação anterior/próxima, auto-advance (`vi.useFakeTimers`), "Ver Range" (consulta/logConsult).
Quando o epic fechar de vez, registrar no handoff e abrir issue `agente` propondo o próximo epic.

### Pendências/propostas (gate humano — NÃO implementáveis pelo agente)
- **#6 / N2** rate limit real — feito via KV (24/06). Pode fechar a issue.
- **MFA** GitHub/Cloudflare — feito pelo Daniel (24/06).
- **#4** code-split do chunk principal (>500KB) — performance.
- **#2** atualizar Estrutura de Pastas do CLAUDE.md (Auth/, CoachPanel, RouterSync, MyAccountStats, utils novos) — docs.
- Lembrete: auth/, worker/, functions/api, schema*.sql/D1 NÃO são implementáveis pelo agente sem autorização explícita do Daniel.
