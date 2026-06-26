# Handoff — Agente Diário (Pre-Flop Pro)

## 2026-06-26 (sexta — performance, a11y, cobertura final · ISSUES #4 e #2)

### Feito hoje (8 fatias, cada uma commitada + pushada em auto/daily-improvements)
1. **perf(#4): code-split de vendors** (`vite.config.ts`). `manualChunks` separa `vendor-react` (react/react-dom/scheduler/react-router), `vendor-sentry` e `vendor`. Chunk principal do app: ~554KB → **~303KB** (gzip 130KB→47KB). O único chunk >500KB agora é o JSON de dados `admin-ranges` (1.4MB, gzip 46KB), isolado de propósito — o warning do build é só ele.
2. **docs(#2): CLAUDE.md** — "Estrutura de Pastas" atualizada (Auth/, Admin/coach, Layout/TopNav+RouterSync+ErrorBoundary, Stats/MyAccountStats+AccuracySparkline, Situations/CategoryDetailPage, ui/ e utils de data science + functions/api) + nota de bundle do #4. Correção: TopHandsPanel/HandDetailCard/PlayerQuickSummary/MultiPlayerSelect/RangeSelect/PeriodFilter são **inline** no `CoachPanel.tsx`.
3. **a11y(css): foco visível padrão** (`src/index.css`) — `:focus-visible` (outline brand 2px) para inputs/selects/textarea nativos sem a classe `.input`. Não reflowa; não aparece em clique de mouse.
4. **test: RouterSync + Turnstile** (sobra) — redirect de página transiente, rota desconhecida→dashboard, espelho store→URL; Turnstile desabilitado sem `VITE_TURNSTILE_KEY`. RouterSync racea quando store e URL discordam no mount → testar com eles em acordo (o app já seed a page pela URL antes do render).
5. **test: AdminPanel + AppLayout** (sobra) — publish via `adminSaveRanges` stub, senha incorreta, botão desabilitado; login/nav/banner de storage. **Todos os componentes do app têm teste agora.** (gotcha tsc: `adminLastError` é `string|undefined`, não null.)
6. **a11y: role="dialog" + aria-modal + aria-labelledby** nos **8 modais** do app (AdminPanel, RangePreviewModal, PrereqRangePicker, WelcomeModal, ChangePasswordModal, heatmap de SituationsPage, nome do range no TableEditor, Ver Range do drill), cada um rotulado pelo próprio título.
7. **test: trava semântica de diálogo** em RangePreviewModal e AdminPanel (`getByRole('dialog', { name })`).

### Estado
- Testes: **343 passam (52 arquivos)**. Build: verde.
- Warning de build: SÓ o chunk de dados `admin-ranges` (1.4MB). Código do app em 303KB. Não é regressão.
- Branch: `auto/daily-improvements`; pushada. PR **#10** aberta, corpo atualizado com a run de hoje. NÃO mergeada (gate humano). `main`/produção intactos.
- **Riscos:** nenhum de comportamento — chunking, testes, foco visível CSS e atributos de a11y.

### Próximas fatias (priorizadas)
1. **Focus-trap + Esc nos modais (FASE 5 cont.):** hoje os 8 modais têm role/aria mas não prendem o Tab nem fecham no Esc. Fatia: handler manual ou hook leve; começar pelos de maior tráfego (LoginPage não é modal, mas ChangePasswordModal, Ver Range do drill e RangePreviewModal sim).
2. **Teste de unidade do store:** `useStore.ts` só é exercido via componentes. Fatia: `nextDrillHand`/`checkDrillAnswer`/`startDrillSession` com ranges sintéticos (severidade grave/impreciso, prereq, multi-stack).
3. **Aprofundar DrillActive:** navegação anterior/próxima, auto-advance (`vi.useFakeTimers`), "Ver Range" (consulta/logConsult) — sobra antiga ainda válida.
4. **#4 (cont., precisa de aval):** o warning remanescente é só o JSON `admin-ranges` (seed estático, deliberado). Dynamic import do seed mudaria o boot → fora do escopo do agente sem aval do Daniel. NÃO subir `chunkSizeWarningLimit` acima de 1.4MB (esconderia regressão real do app). Provável ação: documentar como esperado e fechar #4.

### Issues
- **#4** — bem encaminhada (chunk do app caiu para 303KB); resta decisão sobre o warning do chunk de dados (ver acima).
- **#2** — Estrutura de Pastas atualizada; pode fechar (ou aprofundar componentes inline do CoachPanel como opcional).

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
