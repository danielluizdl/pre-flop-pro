# Handoff — Agente Diário (Pre-Flop Pro)

## 2026-06-25 (continuação — sessão interativa com Daniel · EPIC FASE 3→4)

### Feito hoje (além da fatia do agente das 5h)
- **+10 testes RTL + axe** (3 arquivos novos):
  - `src/components/RangeBuilder/HandMatrix.test.tsx` — render do grid 13×13 (169 células via `[data-hand]`), toggle "Ações"/"Erro-Acerto" com `heatmap`, `applyBrush('AA')` no `mouseDown` de célula vazia (store via `setState`), axe.
  - `src/components/Layout/ErrorBoundary.test.tsx` — renderiza filhos sem erro; fallback ("Algo deu errado" + botões Recarregar / Exportar backup) quando um filho lança; axe. `console.error` silenciado no teste.
  - `src/components/Stats/MyAccountStats.test.tsx` — cards (702/88%/Blunders/Imprecisos), estados vazios (range/mãos/sessões), DevicesSection; `fetch` e `listDevices` mockados; axe.
- **Infra:** `vitest.config.ts` ganhou `testTimeout: 15000` (axe em grids grandes como o HandMatrix estoura o default de 5s sob carga paralela).
- **Fix de fonte (CSP):** `public/_headers` `connect`/`style`/`font-src` agora liberam `fonts.googleapis.com` + `fonts.gstatic.com` — o CSP do N3 estava bloqueando o `@import` do Google Fonts em `src/index.css` e derrubando a Bebas Neue pro fallback. Fonte original restaurada nos previews.

### Estado
- Testes: **302 passam (40 arquivos)**. Build: **verde** (warning conhecido: chunk principal >500KB, issue #4).
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

### Próxima fatia priorizada — EPIC FASE 5 (+ resíduo da FASE 4)
1. **Fluxo profundo do drill** (`Trainer/TrainerPage`/DrillActive) — montar um range com ações reais no grid, simular responder F/C/R/A, conferir `checkDrillAnswer` (acerto/blunder/impreciso), DrillSummary e os contadores de severidade. É o único pedaço de comportamento ainda sem teste.
2. **FASE 5 — varredura de a11y** nas telas que faltam: `TableEditor/TableEditorPage`, `RangeBuilder/RangeEditorPage`, `ui/PokerTableEditor` no contexto de drill, modais (RangePreviewModal, HistoryModal). Rodar axe e corrigir violações remanescentes.
3. **Cobertura restante de componentes** sem teste próprio (ex.: `Layout/Sidebar`, `Layout/TopNav`, `Layout/Dashboard`, `ui/RangePreviewModal`, `ui/HandQuickSelect`).

### Pendências/propostas (gate humano — NÃO implementáveis pelo agente)
- **#6 / N2** rate limit real — feito via KV (24/06). Pode fechar a issue.
- **MFA** GitHub/Cloudflare — feito pelo Daniel (24/06).
- **#4** code-split do chunk principal (>500KB) — performance.
- **#2** atualizar Estrutura de Pastas do CLAUDE.md (Auth/, CoachPanel, RouterSync, MyAccountStats, utils novos) — docs.
- Lembrete: auth/, worker/, functions/api, schema*.sql/D1 NÃO são implementáveis pelo agente sem autorização explícita do Daniel.
