# Handoff — Agente Diário (Pre-Flop Pro)

## 2026-07-06 (revisão de segurança — pacote 1: CI, rate limit admin, log de auditoria, HTML escape)

- Daniel pediu uma revisão de código/segurança "como se fosse um dev sênior contratado pra
  revisar o site" — publicada como artifact com achados verificados (1 crítico, 4
  importantes, 3 menores, 7 ideias de produto). Ele autorizou implementar tudo de segurança;
  esta é a primeira leva (falta só a proteção de branch do `main`, que é config do GitHub,
  feita à parte).
- **CI em PRs (`'.github/workflows/pr-checks.yml`, novo)**: roda `npm test` + `npm run build`
  em todo PR mirando `main` OU `feature/auth-telemetry`. Antes só existia `deploy.yml`
  (builda em push pra `main`, sem rodar teste nenhum) — os 994+ testes só rodavam quando
  alguém lembrava de rodar `npm test` manualmente antes de mergear.
- **Rate limit nos 5 endpoints de admin**: `create-user`/`update-user`/`delete-user`/
  `reset-password`/`create-invite-code` chamam `checkRateLimitKV(env, ip, Date.now(), 'admin')`.
  **Mudança na assinatura de `checkRateLimitKV`** (`_utils.js`): ganhou um 4º parâmetro
  `scope` (default `'auth'`, mantém `login`/`signup` intactos) — sem isso, ações de admin e
  tentativas de login do mesmo IP disputariam o mesmo balde de 8/min.
- **Log de auditoria** (`schema_v7.sql`, tabela `admin_audit_log`: `actor_id`, `action`,
  `target_id` nullable **sem FK** — sobrevive à exclusão do próprio alvo —, `detail` JSON,
  `created_at`). Helper `logAdminAction` (best-effort/fail-open, nunca trava a ação
  principal) chamado nos 5 endpoints de escrita. Leitura: `GET /api/admin/audit-log`
  (coach-only, fail-open se a tabela não existir). Nova seção "Log de auditoria" na aba
  Admin (`AdminView`), colapsável, recarrega após qualquer ação. **Migração já aplicada no
  D1 remoto.**
- **HTML escape nos e-mails**: nome/usuário (controlado pelo usuário) entrava direto na
  string HTML dos templates de boas-vindas/senha temporária. Novo helper `escapeHtml`
  aplicado em `signup.js`, `create-user.js` e `reset-password.js`.
- **1002 testes verdes (84 arquivos)** (era 994), tsc limpo, build verde, SMOKE OK.
  **Gotcha do smoke**: o `vite preview` do `npm run smoke` ficou preso na porta 4173 duas
  vezes nesta sessão (processo `node` não encerrado de uma run anterior) — se o smoke
  falhar com "vite preview não respondeu", checar `netstat -ano | grep 4173` e matar o
  processo antes de rodar de novo.
- Branch `security/audit-log-rate-limit-ci` → PR pra `feature/auth-telemetry`.

### Pendente (Daniel)
- [ ] Revisar/mergear a PR.
- [ ] Proteção de branch do `main` no GitHub (Settings → Branches) — feita via `gh api` numa
      ação separada logo em seguida a esta, não faz parte deste PR de código.
- [ ] Do relatório de segurança: os 3 achados "menores" (quebrar `CoachPanel.tsx` em
      arquivos menores, extrair `requireCoach()` nos endpoints de admin, README.md) ainda
      não foram atacados — combinar com o Daniel se entram numa próxima rodada.

---

## 2026-07-06 (cadastro: nome capitalizado, confirmar senha, tier/turma)

- Daniel pediu 4 mudanças no formulário de cadastro (screenshot da tela real):
  1. **Nome e Sobrenome** (renomeado de "Nome Completo") — capitaliza automaticamente a
     primeira letra de cada palavra ao digitar. `capitalizeWords` (`LoginPage.tsx`, exportada
     e testada) usa `/(^|\s)(\p{L})/gu` — **cuidado**: a primeira tentativa usava `\b\w`, que
     quebra em nomes acentuados (`\w` não inclui `ã`/`ç`/etc, então `\b` cria uma fronteira
     falsa logo depois da letra acentuada e capitaliza a letra seguinte também — "joão" virava
     "JoãO"). A versão Unicode-aware só capitaliza após espaço/início da string.
  2. **Senha mínima 6 caracteres** (era 8) + **Confirmar senha** obrigatória, bloqueia com
     mensagem se não baterem (`auth.errors.passwordMismatch`). Os dois campos usam
     `PasswordInput` (componente local reusável) com ícone de olho (Eye/EyeOff do lucide)
     que alterna `type="password"`↔`"text"` — cada campo tem seu próprio estado de
     visibilidade, independente.
  3. Confirmado: código de convite já é de uso único por design (não precisou de mudança).
  4. **Tier + Turma** (campos novos, obrigatórios): 4 botões — "Tier Fundamentals",
     "Tier Evolution", "Tier Metamorphosis", "Main Team". Selecionar qualquer um EXCETO
     "Main Team" revela uma segunda seleção "Turma" (A/B/C/D, botões). `canSubmit` exige
     tier selecionado e (tier === 'main' OU turma selecionada).
- **Backend**: `schema_v6.sql` adiciona `users.tier` (`NOT NULL DEFAULT ''`) e `users.turma`
  (nullable) — **migração já aplicada no D1 remoto**. `signup.js` ganhou
  `validateSignupFields` (pura, testada em `signup.test.js`) validando tier ∈
  {fundamentals,evolution,metamorphosis,main}, turma ∈ {A,B,C,D} quando tier≠main, senha
  ≥6 chars; grava tier/turma no INSERT.
- **Store**: `authSignup` ganhou 2 parâmetros novos (`tier`, `turma`) entre `email` e
  `turnstileToken` — todos os call sites de teste (`authActions.test.ts`,
  `authGuards.test.ts`, `networkErrors.test.ts`) atualizados.
- **994 testes verdes (84 arquivos)**, tsc limpo, build verde, SMOKE OK (precisou matar um
  processo `vite preview` da porta 4173 que ficou preso de uma run anterior).
- Branch `feat/signup-tier-fields` → PR pra `feature/auth-telemetry`.

### Pendente (Daniel)
- [ ] Revisar/mergear a PR (branch `feat/signup-tier-fields`).
- [ ] Validar visualmente no preview: capitalização do nome, olho da senha nos 2 campos,
      bloqueio de senha divergente, seleção de tier revelando/escondendo turma.

---

## 2026-07-06 (PlayerQuickSummary vira somente-leitura — reset de senha só na aba Admin)

- Daniel viu o "Resumo individual por jogador" (aba Drill) no preview e pediu pra tirar o
  botão "Resetar senha" de lá — mexer em conta de usuário deve existir **só** na aba
  "Funcionalidades de Admin", sem duplicar em outro lugar.
- `PlayerQuickSummary` (`src/components/Admin/CoachPanel.tsx`) perdeu todo o bloco de reset
  (estado `resetting`/`tempPassword`/`resetError`/`copied`, `handleResetPassword`,
  `resetBlock` e as 3 renderizações dele) — agora é **puramente leitura** (ranges mais
  treinados / onde mais erra / mais consultados).
- i18n: `coach.resetting` e `coach.resetConfirm` ficaram órfãos (só eram usados ali) —
  removidos de pt/en/es (não confundir com `errorBoundary.resetConfirm`, que é outra coisa,
  intocado). `coach.resetPassword`/`tempPassword`/`copy`/`copied` continuam em uso na aba
  Admin.
- Testes: removidos os 2 testes de reset em `PlayerQuickSummary` (CoachPanelParts.test.tsx),
  novo teste garantindo que o botão não aparece mais ali. **Gotcha de teste:** o novo teste
  colidiu com o cache de analytics (TTL 15s, chave por URL) do teste anterior que usava os
  mesmos parâmetros (`userId=1, days=null`) — resolvido variando `days` entre os testes.
- **976 testes verdes (83 arquivos)**, tsc limpo, build verde, SMOKE OK.
- Branch `fix/remove-player-summary-reset` → PR pra `feature/auth-telemetry`.

### Pendente (Daniel)
- [ ] Revisar/mergear a PR (branch `fix/remove-player-summary-reset`).

---

## 2026-07-05 (issues #6 e #36 — fechamento)

- Daniel pediu pra resolver as duas issues "proposta" que ainda estavam abertas.
- **Issue #6 (roteiro de hardening de segurança) — FECHADA sem código novo.** Auditoria linha
  a linha confirmou que **todos os 4 níveis do roteiro (N1–N4) já estavam implementados**
  (PR #5 + trabalho posterior): PBKDF2 100k iters + `equalizeTiming` p/ usuário inexistente +
  compare constant-time + rehash progressivo (`login.js`/`_utils.js`); `checkRateLimitKV`
  (persistente, KV) + Turnstile fail-**closed** quando o secret existe mas o siteverify falha
  (só fail-open se o secret nem estiver configurado — política do projeto); `public/_headers`
  completo (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy)
  + CORS por allowlist (`functions/_middleware.js`, sem wildcard); `functions/api/me/devices.js`
  (listar/revogar sessões) + Sentry `scrubEvent` no `beforeSend`. Issue estava desatualizada
  (achados de 21/06, já corrigidos depois) — mesmo padrão de #37/#17/#15.
- **Issue #36 (P2.6 testes + P3.7 endpoint morto) — RESOLVIDA nesta branch:**
  - `functions/api/admin/analytics.js`: os 6 helpers puros (`parseIntParam`, `parsePlayerIds`,
    `playerCond`, `dateCond`, `handFilters`, `ACC`) ganharam `export` (sem extrair pra módulo
    separado — segue o padrão já usado em `create-user.js`/`update-user.js`/etc. desta sessão:
    exportar direto do arquivo do endpoint e testar via import). Testes novos em
    `analytics.test.js` (16 casos, sem D1 real).
  - **Removido `?view=consult-hotspots`** (dead code confirmado — zero uso no front). `?view=foco`
    já não existia mais (P3.7 estava parcialmente feito).
- **975 testes verdes (83 arquivos)** (era 959), tsc limpo, build verde, SMOKE OK.
- Branch `fix/analytics-helpers-tests` → PR pra `feature/auth-telemetry` (gate humano de
  `functions/api` cumprido: mudança pequena, só refactor+testes+remoção de código morto,
  sem alterar comportamento de nenhuma view em uso).

### Pendente (Daniel)
- [ ] Revisar/mergear a PR (branch `fix/analytics-helpers-tests`).
- [ ] Fechar as issues #6 e #36 no GitHub (ou deixar o agente fechar ao mergear).

---

## 2026-07-05 (PR #43 — rodada 2: modal de confirmação + editar dados + códigos de convite)

- **Contexto:** Daniel pediu, antes do merge da PR #43, mais um ajuste na aba
  "Funcionalidades de Admin": clicar na conta (em vez de botões soltos na linha) pra
  revelar resetar senha/excluir/editar dados, com pop-up de confirmação enfatizando
  risco/irreversibilidade em qualquer mudança, e um mecanismo de códigos únicos de
  convite (substituindo o `TEAM_CODE` compartilhado) pra saber quem usou qual código.
  Decisão confirmada com o Daniel: **substituir** o `TEAM_CODE`, não manter os dois.
- **UX da conta**: linha da tabela agora é clicável (mesmo padrão do `OverviewTableRow` —
  chevron ▸/▾, **sem `aria-expanded` no `<tr>`**, axe rejeita esse atributo fora de
  `treegrid`) e expande **Editar dados** / **Resetar senha** / **Excluir**. As três passam
  por **`ConfirmDangerModal`** (novo componente local, `useModalA11y`, `role="dialog"`)
  antes de executar: mostra o que vai mudar (editar → diff nome/e-mail riscado→novo;
  resetar/excluir → aviso vermelho "não pode ser desfeito") e só age no clique explícito
  em Confirmar. Substituiu os `window.confirm()` nativos que existiam antes (só na
  `PlayerQuickSummary`, aba Drill, o reset ainda usa `confirm()` nativo — não foi pedido
  mexer lá).
- **Editar dados**: novo endpoint `functions/api/admin/update-user.js` (coach-only, só
  `role='player'`, valida nome/e-mail e duplicidade de e-mail).
- **Códigos de convite** (`schema_v5.sql`, tabela `invite_codes`: `code` único,
  `created_by`, `used_by`/`used_at` nullable `ON DELETE SET NULL`): `create-invite-code.js`
  (coach-only, gera código de 8 hex maiúsculo com retry em colisão) e `invite-codes.js`
  (lista com `LEFT JOIN users` mostrando quem usou cada um). **`signup.js` reescrito**:
  `teamCode`/`TEAM_CODE` removidos, agora exige `inviteCode` válido e não-usado; ao
  cadastrar, marca o código como usado (`used_by`/`used_at`). Front: `authSignup` e
  `LoginPage` renomeados de `teamCode`→`inviteCode` (label "Código de convite:", chave
  i18n `auth.inviteCodeLabel`). Nova seção "Códigos de convite" na aba Admin (botão
  gerar + tabela com status).
- **Migração `schema_v5.sql` JÁ APLICADA** no D1 remoto (tabela `invite_codes` criada,
  9 tabelas no total agora). **IMPORTANTE:** a tabela está vazia — nenhum jogador
  consegue se cadastrar no preview desta branch até o coach gerar pelo menos 1 código
  na aba Admin.
- **959 testes verdes (82 arquivos)** (era 946), tsc limpo, build verde, SMOKE OK.

### Pendente (Daniel)
- [ ] Gerar pelo menos 1 código de convite na aba Admin antes de testar cadastro novo
      no preview (a tabela `invite_codes` está vazia após a migração).
- [ ] Validar visualmente: modal de confirmação (editar/resetar/excluir), diff mostrado
      antes de salvar edição, geração/listagem de códigos de convite.
- [ ] Revisar/mergear a PR #43 para `feature/auth-telemetry` (era o próximo passo antes
      deste pedido extra — agora inclui também estes ajustes).

---

## 2026-07-05 (PR #43 — 3 ajustes pós-revisão: contraste claro, nota decimal, aba Admin)

- **Contexto:** PR #40 mergeada em `feature/auth-telemetry`; Dependabot #38/#39 (bumps de
  patch/minor, testados e mergeados); issues #37/#17/#15 fechadas (concluídas). Daniel
  revisou o preview e pediu 3 ajustes — branch `fix/coach-admin-tab` (a partir de
  `feature/auth-telemetry` pós-merge), PR #43 aberta para `feature/auth-telemetry`.
- **1. Contraste do claro no Range Check:** `ExercisePage.tsx` tinha `text-white` sobre
  superfícies `warm-800` (cabeçalho de posição, nome dos ranges, linhas de confirmação/
  resumo) — ilegível no claro porque foi escrito antes do sweep de tokens do tema.
  Trocado para `text-warm-100` (padrão já usado em TrainerPage/SituationsPage).
- **2. Nota decimal no histórico:** `StatsPage.tsx` usava `Math.round(s.avgScore)` na nota
  principal da sessão de Range Check (escondia a precisão real, ex. 91.5→"92"). Agora
  `toFixed(1)`, igual à nota por round.
- **3. Nova aba "Funcionalidades de Admin" no CoachPanel** (`AdminView`, exportado p/
  teste) — terceira aba ao lado de Drill/Range Check: lista de contas com busca, **criar
  conta** (`POST /api/admin/create-user`, endpoint novo, coach-only, sem Turnstile, gera
  senha temporária), **resetar senha** (reusa o endpoint existente) e **excluir conta**
  (`POST /api/admin/delete-user`, endpoint novo, coach-only, recusa auto-exclusão e contas
  não-`player`; cascade via FK). Reset de senha continua também no `PlayerQuickSummary`.
- **946 testes verdes (80 arquivos)** (era 933), tsc limpo, build verde, **SMOKE OK**.

### Pendente (Daniel)
- [ ] Validar visualmente no preview (contraste claro, casa decimal, aba Admin: criar/
      resetar/excluir conta) e revisar/mergear a PR #43.

---

## 2026-07-05 (merge manual — Range Check + tema claro + daily improvements integrados)

- A pedido do Daniel: `feature/auth-telemetry` (já com tema claro + daily improvements
  mergeados) foi trazida para dentro de `feature/build-range-exercise` (PR #40, modo
  "Range Check"), pra tudo rodar junto antes do merge final. Conflitos só em
  `.agent/handoff.md` (seções concorrentes, resolvido combinando) e `CoachPanel.tsx`
  (abas "Drill"/"Range Check" do modo novo + qualquer ajuste de tema claro nas mesmas
  linhas — resolvido preservando as duas mudanças). `npm test` + `npm run build` verdes
  após o merge. Preview da branch: `feature-build-range-exercise.pre-flop-pro.pages.dev`.

---

## 2026-07-05 (agente — ajustes do tema claro pedidos pelo Daniel)

- Feedback do Daniel na PR #42: light estava claro demais e a área da mesa (drill +
  Configurar Cenários) ficava um bloco preto destoante.
- **Rampa clara recalibrada** para bege (page #e6ddc6, card #f0e8d3, input #d8cca9 etc.).
- **Área da mesa tematizada**: containers do drill/TableEditor deixaram de ser subtree
  `dark`; usam `var(--table-box-bg, <hex dark>)` + `var(--table-box-shadow, ...)`; feltro do
  `PokerTable.module.css` usa `var(--felt-1..3, <hex dark>)`. As vars são definidas SÓ em
  `:root:not(.dark)` → no escuro os fallbacks reproduzem os valores originais (dark intacto).
- DrillActionButton/badge RNG/labels internos: hex fixo → tokens warm (valores dark idênticos).
- Tokens `brand-300/400` e `orange-300/400` (texto de destaque em superfície warm) ganharam
  versão escura no claro; `brand-500` mantido (accent da marca, estilo claude.ai).
- 776 testes + build verdes; screenshots claro/escuro re-verificados (dashboard, drill ativo,
  editor). Dark permanece pixel-idêntico.

## 2026-07-04 (agente — TEMA CLARO implementado, PR aberta)

### O que foi feito
- **Tema claro completo** na branch `feature/light-mode` (a partir de `feature/auth-telemetry`),
  PR aberta para `feature/auth-telemetry`. **776 testes verdes (71 arquivos)**, build verde,
  `npm run smoke` OK.
- **Diagnóstico:** o `toggleDarkMode` existia mas não fazia nada — a classe `dark` era posta num
  div interno sem nenhum utilitário `dark:` e toda a paleta `warm-*` era fixa escura.
- **Estratégia (menor diff): tokens CSS por escopo** em `src/index.css`. `@theme` mantém os valores
  dark; `:root:not(.dark)` injeta a rampa `warm-*` invertida (fundo creme, texto escuro) + versões
  escuras dos tons frios usados como texto (`red-400`→vermelho escuro, `emerald-400`, `yellow-400`,
  `blue-400`, `sky/purple/violet/amber-*`, `gold`, `result-good/mid/bad`); `.dark` restaura os
  valores EXATOS (warm + oklch da paleta padrão do Tailwind 4) em qualquer subtree → dark mode fica
  pixel-idêntico E permite superfície permanentemente escura via `class="dark"` no container.
- Classe `dark` movida para o `<html>`: `main.tsx` aplica antes do 1º paint; effect no `AppLayout`
  sincroniza com `store.darkMode`. `@custom-variant dark` (class-based) declarado.
- **Store:** `darkMode` default `true`; persist `fbr-ui-state` ganhou `version: 1` + `migrate` que
  força `darkMode=true` em estado v0 (usuários existentes continuam vendo dark; claro é opt-in
  pelo toggle Sun/Moon do TopNav, que já existia e agora funciona nos dois sentidos).
- **Superfícies sempre escuras (decisão de design):** caixa do drill (TrainerPage), mesa do
  TableEditor (`class="dark"` nos containers) e as matrizes 13×13 (HandMatrix/RangeActionGrid/
  RangeHeatGrid mantêm células escuras nos dois temas — cores de ação idênticas e legíveis).
- **Sweeps:** `text-white`/`hover:text-white` sobre superfícies warm → `text-warm-100` (~85 pontos,
  23 arquivos; branco mantido sobre brand/emerald/red/chips de heat/cartas); hex inline de página →
  `var(--color-warm-*)` (chips de stack do editor, AccuracySparkline, sparkline do coach);
  Turnstile segue o tema; inputs de data do PeriodFilter herdam `color-scheme` do root; scrollbar
  via tokens.
- **i18n:** nenhuma string nova necessária (`nav.lightMode`/`darkMode` já existiam nos 3 idiomas).
- **Validação visual real (Playwright/Chromium headless):** screenshots claro+escuro de dashboard,
  login, Meus Ranges, drill (seleção e ativo), editor, histórico, preview modal e CoachPanel —
  claro legível/consistente, dark inalterado. Scripts no scratchpad (não commitados).

### Pendências
- [x] Tema claro validado e mergeado (PR #42, MERGEADA em `feature/auth-telemetry`).
- [ ] Se aprovado, considerar honrar `prefers-color-scheme` no primeiro boot (hoje default é dark).

---

## 2026-07-04 (Rodada 2 do modo "Range Recall" — CONCLUÍDA)

### Estado
- **Branch `feature/build-range-exercise`**, PR #40 (→ `feature/auth-telemetry`) atualizada
  (título + descrição refeitos com as opções de nome, os 7 ajustes e as pendências).
- **827 testes verdes (75 arquivos)** (era 815), build verde, **SMOKE OK** (via
  `SMOKE_CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe"` — o runner
  não achou o Chromium do Playwright sozinho neste ambiente).
- Os 7 ajustes da Rodada 2 estão TODOS entregues (commits `5b0f03d..f833b38`):
  1. confirmação pré-rounds; 2. atalhos Pares/Suiteds/Offsuits; 3. múltiplas tentativas
  (`attempt`); 4. resumo com detalhe por round; 5. renome para **"Range Recall"** (string
  central no i18n); 6. aba Range Recall no Histórico do jogador; 7. painel coach (abaixo).

### Item 7 — Painel Coach reestruturado (`f833b38`)
- Aba **"Por jogador" REMOVIDA** inteira (PlayersView + endpoints de detalhe seguem no
  backend `admin/user/[id].js`, agora sem uso no front — candidato a limpeza futura).
- **"Visão do time" → "Drill"** (só o rótulo; `tabDrill`/`tabRecall` no i18n).
- Aba nova **"Range Recall"** (`RecallView`): seções **Por jogador** (linha do TIME +
  jogadores com tentativas>0), **Por range** e **Tentativas recentes** (stack, nº da
  tentativa, nota, data; 100 últimas). Mesmos filtros (MultiPlayerSelect/RangeSelect/
  PeriodFilter) e padrões (`Section`, `useAnalytics`→`fetchAnalyticsCached`).
- Backend: views `build-overview`/`build-by-range`/`build-events` em
  `functions/api/admin/analytics.js` (aproveitou o diff uncommitted da sessão anterior),
  todas em try/catch **fail-open** — sem a migração schema_v4 devolvem vazio ("Sem dados.").
- **DECISÃO — reset de senha**: vivia na aba removida; foi movido para o
  `PlayerQuickSummary` (expandir um jogador em "Resumo do time" na aba Drill), com o
  mesmo endpoint `admin/reset-password`, confirm + senha temporária + copiar. Chave nova
  `coach.resetConfirm` (o confirm era hardcoded PT).
- i18n: chaves novas `tabDrill`/`tabRecall`/`recall*`/`resetConfirm` em pt/en/es; chaves
  mortas da aba removida limpas (tabTeam/tabPlayer/tabHands/colAction/etc.).
- Testes: CoachPanel.test atualizado (abas novas, 3 testes RecallView incl. fail-open),
  reset de senha testado direto no `CoachPanelParts.test.tsx`; AppLayout.test e
  `smoke/smoke.mjs` passaram a identificar o CoachPanel pelo botão de publicar
  (os nomes "Drill"/"Range Recall" agora colidem com a navegação).

### Extra pós-Rodada 2 (pedido do Daniel)
- Tela "Confirme os rounds": ícone de olho por linha abre o **preview do gabarito do round**
  reusando `RangePreviewModal` — o Range passado é sintético (grid = snapshot do round, sem
  `stackGrids`), então round multi-stack abre direto na variante certa com o badge do stack.
  Sem strings novas (reusa `t.ranges.viewRange`/`t.common.close`). **828 testes verdes (75 arquivos).**

### PENDENTE (gate humano — Daniel)
- [x] **Migração D1 APLICADA (04/07/2026)**: `schema_v4.sql` executado no remoto com sucesso
      (4 queries, tabela `range_build_events` + índices criados) — telemetria/analytics do
      modo já gravam no D1.
- [ ] Validar visual no preview (nav "Range Recall" + página do modo + painel coach novo).
- [ ] Confirmar o nome "Range Recall" (troca centralizada no i18n).
- [ ] Revisar/mergear a PR #40 para `feature/auth-telemetry`.

---

## 2026-07-03 (tarde — feature nova: modo "Montar Range")

### Estado
- **Branch `feature/build-range-exercise`** (a partir de `feature/auth-telemetry`), PR aberta para
  `feature/auth-telemetry`. `main`/produção intactos.
- Feature completa: novo modo de exercício **"Montar Range"** (reproduzir range de memória),
  ao lado do Drill na navegação (page `'exercise'`, rota `/montar-range`).
- Testes: 774 → **815 verdes (75 arquivos)** (9 buildScore + 11 store + 13 página + 8 endpoint).
  Build verde. Smoke OK.

### O que foi feito (fatias/commits)
1. `src/utils/buildScore.ts` — nota por combos fora do lugar (fórmula travada da tarefa;
   fold implícito; clamp [0,100]; `perHand` p/ heatmap de diferença) + 9 testes de borda.
2. Store: `buildRounds` (1 round por stackGrid; snapshot do grid gabarito + customAction),
   `startBuildSession`/`submitBuildRound`/`nextBuildRound`/`stopBuildSession`,
   histórico local `pfp-build-history-v1` (trySave), telemetria `fireEvent('range-build', ...)`.
   **Pintura reusa `rangeData.grid`** — HandMatrix/BrushControls sem mudança.
3. `src/components/Exercise/ExercisePage.tsx` (lazy): seleção (acordeão igual ao drill) →
   round (pintar às cegas + ComboCounter) → nota + "Seu range"/"Gabarito" (RangeActionGrid)
   + DiffGrid → resumo (média + por round). i18n completo PT/EN/ES (namespace `exercise`).
   Nav: TopNav/Sidebar (ícone Grid3x3) + RouterSync.
4. `functions/api/events/range-build.js` + `schema_v4.sql`. **GOTCHA importante:** o INSERT
   está em try/catch devolvendo 200 `{ok:false}` — sem isso, antes da migração o 500
   travaria a fila FIFO de telemetria do cliente (flush para em erro != 400).

### PENDENTE (gate humano — Daniel)
- [ ] **Migração D1 manual**: `npx wrangler d1 execute preflop-db --file=schema_v4.sql --remote`
      (sem ela a telemetria do modo é descartada no servidor; app funciona normal).
- [ ] Validar visual no preview do Cloudflare (mudança visual nova: item de nav + página).
- [ ] Revisar/mergear a PR para `feature/auth-telemetry`.

---

## 2026-07-03 (run automático — cobertura incremental segura, 10 fatias)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #35 ABERTA e atualizada** (auto/daily-improvements → feature/auth-telemetry). NÃO mergeada
  (gate humano; contém a mudança visual do dia 02/07 — badge Coach + CSV — a validar no preview).
- **774 testes verdes (71 arquivos)** (era 739), build verde. `main`/produção intactos.
- **Run 100% testes** — zero mudança de código de produção, zero risco visual.
- Stack: React 19, Vite 8, TypeScript 6, Tailwind 4, react-router 7, lucide-react 1, vitest 4.1.8.

### Feito nesta run (10 commits, cada um test+build verde + push)
1. **test(auth):** LoginPage — cadastro válido/erro chama `authSignup(user,pass,teamCode,name,email,ts)`; Enter nos campos do cadastro; guarda `canSubmit` (não submete sem campos).
2. **test(i18n):** LanguageSelect — clique fora (`mouseDown` no body) e Escape fecham o dropdown.
3. **test(stats):** MyAccountStats — `formatDuration` min/seg (durationSeconds 125→"2m", 45→"45s"), sessão sem expiração ("Iniciada em — · expira em —") e retry do erro de sessões.
4. **test(ranges):** SituationsPage — backdrop do heatmap fecha (clicar no `dialog.parentElement`), olho abre o preview (`Visualizar range`), Novo Range / Criar primeiro navegam.
5. **test(dashboard):** precisão global e por range com `trainingHistory` + `handPerformance` (cobre os reduces).
6. **test(store):** `resetLocalData` (só chaves fbr-/pfp-), `toggleDarkMode`, clamp do `setBrush` (aumentar call reduz o maior=raise; valor 100 zera os demais) e guarda `applyBrushToHands` >100%.
7. **test(matrix):** HandMatrix — ações dominantes por cor de texto (call=rgb(6,43,19)/all-in=rgb(253,230,138)/mista=rgb(255,255,255)), heat vermelho <50% (overlay `.z-\[1\]` com `239, 68, 68`), guarda `readOnly` no mouseDown.
8. **test(trainer):** DrillRangeSelect — sem ranges "Ir para Meus Ranges" navega, "Desfazer seleção" limpa grupo, olho abre preview sem selecionar, badge multi-stack, "Voltar" do filtro volta à seleção.
9. **test(coach):** RangeSelect — busca filtra (`option` some), seleção por clique (label vira o nome), reset "Todos os ranges", ArrowDown×2+ArrowUp; MultiPlayerSelect — "Todos os jogadores" desmarca o selecionado.
10. **test(layout):** AppLayout carrega páginas lazy `editor` (/editor → "Posição do HERO") e `table-editor` (/table-editor → "Configurar Cenários") + fallback de rota desconhecida no dashboard.

### Notas técnicas úteis (replicáveis)
- Cobertura: `npm i -D @vitest/coverage-v8@4.1.8 --no-save` + `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.reporter=json --coverage.reportsDirectory=<dir>`; parsear `coverage-final.json` (`s`/`statementMap`) por arquivo → linhas exatas não cobertas. NÃO commitar a dep (é `--no-save`; confira `grep coverage-v8 package.json` = 0).
- HandMatrix: cor de texto por ação vem de `ACTION_TEXT[cellAction(data)]`; jsdom converte hex do inline style para `rgb(...)`. O overlay de heat é o segundo `div` interno com classe `z-[1]` (querySelector `'.z-\\[1\\]'`).
- CoachPanel: RangeSelect usa `role="option"`; o botão externo tem `aria-label="Filtrar por range"` fixo e o texto (`toHaveTextContent`) reflete a seleção. Sempre `invalidateAnalyticsCache()` no afterEach (cache TTL 15s vaza).
- AppLayout lazy: passar `initialEntries` casando a rota (RouterSync reseta a page se a URL discordar do store). Mapa em RouterSync `PAGE_TO_PATH` (editor→/editor, table-editor→/table-editor).

### Maiores lacunas restantes (alvos do próximo run — baixo ROI daqui pra frente)
- **CoachPanel.tsx**: guardas de token/cancel dos hooks (`useAnalytics`/`useRangeGrid`/`useTrend`…) e TopHandsPanel aba "consultas"/"errors" com dados — precisam de fetch por-view populado.
- **TrainerPage.tsx** (DrillActive): sidebar colapsável, modal "Ver range" backdrop, barra de progresso do auto-advance — exigem sessão de drill montada (setup pesado).
- **useStore.ts**: helpers de boot (`loadRanges` merge por ADMIN_VERSION, `loadTeamRangeIds` filtro) — rodam no import do módulo singleton, difíceis de cobrir sem manipular localStorage antes do import.
- **Turnstile.tsx** / **functions/api** / **worker**: auth-adjacente / gate humano — NÃO cobrir sem decisão.
- Decisões pendentes do Daniel: **PR #35** (validar preview do badge Coach + CSV e mergear), **issue #36** (`proposta` functions/api), **issue #37** (epic smoke — núcleo concluído).

---

## 2026-07-02 madrugada (mapeamento completo dos objetivos + execução em sequência)

### Estado (PONTO DE PARTIDA do próximo run)
- **739 testes verdes (71 arquivos)**, build verde, **SMOKE OK** (render verificado em browser real).
- **PR #35 ABERTA e acumulando** — agora inclui: 6 fatias de teste pós-#34, P1.1 (badge Coach),
  P3.8 (CSV), cobertura fina do drill e o **smoke test**. NÃO mergeada (gate humano; tem
  mudança visual — validar badge/CSV no preview).
- **Issue #36 (label `proposta`)**: P2.6/P3.7 — testes de `functions/api/analytics.js` +
  remoção de endpoints mortos. Aguardando decisão do Daniel (gate humano).
- **Issue #37 (label `agente`)**: novo epic "smoke de render no browser" — JÁ INICIADO
  e núcleo entregue no mesmo run.

### Mapa de objetivos (levantado a pedido do Daniel — fontes: rotina, epic, handoffs, CLAUDE.md)
| Objetivo | Status |
|---|---|
| Epic P1.1 badge "Range do Time" | FEITO (02/07) |
| Epic P3.8 exportar sessão CSV | FEITO (02/07) |
| Extras do epic (cobertura fina drill/coach) | FEITO — ROI de cobertura esgotado (~89% linhas) |
| P2.6/P3.7 `functions/api` (gate humano) | Issue #36 `proposta` criada — decide o Daniel |
| Propor próximo epic (regra da rotina ao fechar epic) | Issue #37 `agente` criada |
| Começar o próximo epic se houver orçamento | FEITO — `npm run smoke` entregue e verificado |
| Validar preview + mergear PR #35 | SÓ DANIEL |
| MFA GitHub/Cloudflare | FEITO (30/06) |
| Dependabot #20/#25 (Tailwind/Vite) | OBSOLETO — migrações já feitas e mergeadas |

### Feito nesta continuação (3 entregas)
1. **test(trainer):** botão "Erro / Acerto" do topo do drill abre o diálogo SEM registrar
   consulta; feedback com RNG ligado mostra a linha de faixas ("RNG 50: 1–70 Raise ..."). +2 testes.
2. **Issues:** #36 (`proposta`, functions/api) e #37 (`agente`, novo epic smoke).
3. **feat(tooling): `npm run smoke`** (`smoke/smoke.mjs`, committado — `scripts/` é gitignored):
   - `vite build` + `vite preview` + Chromium headless via **playwright-core** (devDep NOVA;
     sem postinstall de download — acha o browser por `SMOKE_CHROMIUM`, `/opt/pw-browsers/chromium`
     do ambiente cloud, ou `chromium.executablePath()`).
   - Backend stubado com `page.route` (`/api/auth/me` etc. → jogador fake logado); rede externa
     BLOQUEADA (Google Fonts falha pelo proxy do container — erros externos são ignorados de propósito).
   - Checa: #root monta, nav visível, clique Drill → `/drill`, back → `/dashboard`, F5 em
     `/historico` mantém a rota, zero pageerror/console.error locais. **Pega os dois modos
     históricos de tela branca** (ciclo de chunks e loop do RouterSync).
   - Rodado neste ambiente: **SMOKE OK**.

### Continuação (mesma madrugada — "prossiga com o planejamento")
- **Smoke ESTENDIDO e verde:** agora cobre também o **drill completo** (expande grupo STR
  seedado → Selecionar todos → CONTINUAR → INICIAR TREINO → responde FOLD → feedback ✓/✗)
  e o **painel do coach** (`/coach` como role coach, analytics stubado, aba "Visão do time").
- **Processo documentado no CLAUDE.md** (seção de testes): rodar `npm run smoke` antes de
  merges de dependência/chunks/router.
- 739 testes verdes, build verde, SMOKE OK re-verificado após a extensão.
- **EPIC #37 (núcleo) CONCLUÍDO.** Restam só decisões do Daniel: PR #35 (preview), issue #36.

### Próximas fatias sugeridas
- [ ] Estender o smoke: fluxo coach (`/coach` com analytics stubado) e drill ativo real.
- [ ] Processo: rodar `npm run smoke` antes de merges de risco (deps/chunks/router) — documentar no CLAUDE.md quando o Daniel aprovar o epic #37.
- [ ] Aguardar decisões: PR #35 (preview), issue #36 (functions/api).

---

## 2026-07-02 noite (NOVO EPIC de produto — P1.1 e P3.8 ENTREGUES)

### Estado (PONTO DE PARTIDA do próximo run)
- Daniel autorizou o novo epic ("pode prosseguir com a sua sugestão"). Epic registrado
  em `.agent/epic.md` e **as duas pendências de produto foram entregues no mesmo run**.
- **PR #35 ABERTA e acumulando** (auto/daily-improvements → feature/auth-telemetry):
  6 fatias de teste pós-merge + P1.1 + P3.8. NÃO mergeada (gate humano).
- **737 testes verdes (71 arquivos)**, build verde. `main`/produção intactos.
- **MUDANÇA VISUAL NOVA — validar no preview Cloudflare antes de mergear:**
  badge "Coach" no RangeCard e botão "Exportar CSV" no SessionCard.

### Feito nesta continuação (2 fatias de produto + docs)
1. **P1.1 — Badge "Range do Time" (feat):**
   - `syncTeamRanges` agora persiste os IDs dos ranges do time em
     `localStorage['pfp-team-range-ids']` e no estado `teamRangeIds: number[]`
     (carregado no boot por `loadTeamRangeIds`).
   - `RangeCard` (SituationsPage): badge "Coach" (sky) ao lado do nome + botão
     Editar desabilitado com tooltip `t.ranges.coachLocked`. **Gate:
     `currentUser?.role !== 'coach'`** — o coach continua editando os próprios ranges.
   - i18n: `ranges.coachBadge`/`ranges.coachLocked` em pt/en/es.
   - Obs.: feature fica dormente até o front usar os ranges D1 (hoje a fonte é
     `adminRanges.json`); os IDs só populam quando `syncTeamRanges` aplica versão nova.
2. **P3.8 — Exportar sessão CSV (feat):**
   - `src/utils/sessionCsv.ts`: `buildSessionCsv(session, ranges)` — colunas
     range,stack,mao,tentativas,acertos,precisao a partir do `session.handPerf`;
     chaves `id|||stack` têm precedência sobre a agregada; fallback por nome
     (sessões antigas); escaping CSV correto. `sessionCsvFilename` = `sessao-AAAA-MM-DD.csv`.
   - Botão "Exportar CSV" (ícone download) no `SessionCard` do StatsPage via `downloadText`.
   - i18n: `stats.exportCsv` em pt/en/es. 8 testes novos.
- **docs:** CLAUDE.md ganhou a chave `pfp-team-range-ids` na tabela de localStorage.

### Próximos passos
- [ ] **Daniel validar no preview** (badge Coach + botão CSV) e mergear a PR #35.
- [ ] Extras do epic: polimentos de baixo risco; ou propor próximo epic (UX/polish
      com verificação Playwright, na linha dos scripts `scripts/verify*.cjs`).
- [ ] Gate humano (inalterado): testes de `functions/api`, endpoints mortos (P2.6/P3.7).

---

## 2026-07-02 fim do dia (pós-merge da PR #34 — +6 fatias)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #34 MERGEADA** em `feature/auth-telemetry` (merge `0b63a03`) — Daniel revisou e aprovou. Continha as 23 fatias do dia + cache/locale do dia 01/07.
- **PR #35 ABERTA** (auto/daily-improvements → feature/auth-telemetry) com as 6 fatias pós-merge. NÃO mergeada (gate humano).
- **725 testes verdes (70 arquivos)**, build verde. `main`/produção intactos.
- Branch `auto/daily-improvements` foi RECRIADA a partir de `feature/auth-telemetry` pós-merge (force-with-lease, só histórico mergeado).

### Feito nesta continuação (6 commits, cada um test+build verde + push)
1. **test(coach):** aba Por jogador (PlayersView) — lista com `handsAccSuffix`, tabela de mãos, aba Consultas, reset de senha (confirm → tempPassword → Copiar; clipboard via `Object.defineProperty(navigator,'clipboard',...)`).
2. **test(trainer):** replay da sidebar — clicar entrada errada abre snapshot ("✗ Correto: X"), "← Mão atual" volta.
3. **test(trainer):** DrillSummary multi-stack — severidade, variantes de stack, visão de ações.
4. **test(dashboard):** hero (Iniciar treino / Ver ranges).
5. **test(coach):** PublishTeamRanges — sucesso/recusa/erro.
6. **test(coach):** período Custom envia `from`/`to` sem `days`; MultiPlayerSelect envia `playerIds` (padrão: capturar URLs no mock de fetch e filtrar `/admin/analytics`).

### Próximos alvos (cobertura restante é fina — priorizar por valor)
- **CoachPanel** (~83%): RangeHeatGrid métricas alternáveis dentro da matriz, HandDetailCard fluxos secundários, TrendBadge/Sparkline por jogador na aba Evolução.
- **TrainerPage** (~87%): barra de progresso do auto-advance, botão "Erro/Acerto" do topo do drill, straddle/ante renderizados na mesa.
- **useStore** (~91%): ramos raros de erro (catch de rede em ações menores).
- **Decisões pendentes do Daniel:** P1.1 (badge "Range do Time"), P3.8 (exportar sessão CSV), testes de `functions/api` (gate humano). Cobertura já está alta — talvez valha propor um epic novo (ex.: UX/polish visual validado por Playwright, ou os P1/P3 pendentes) em vez de continuar só cobertura.

---

## 2026-07-02 tarde (continuação do run — +13 fatias de cobertura)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #34 ABERTA e atualizada** (auto/daily-improvements → feature/auth-telemetry). NÃO mergeada (gate humano).
- **714 testes verdes (70 arquivos)** (manhã fechou em 675; ontem 626), build verde. `main`/produção intactos.
- Cobertura global de linhas ~**89%** (useStore 91%, TrainerPage 86%, Turnstile 94%, AdminPanel 89%, CoachPanel 82%).
- As duas runs de 02/07 são SÓ testes — zero mudança de código de produção, zero risco visual.

### Feito nesta continuação (13 commits, cada um test+build verde + push)
1. **test(store):** `loadRangeForEdit` (simples/multi-stack→sessionGrids/customAction/prereq/inexistente) + `logConsult` (assert no `enqueue` — o store importa `enqueue` do eventQueue e embrulha em `fireEvent` local, mockar `enqueue`/`flush`) e `incrementConsults` — `loadRangeForEdit.test.ts`.
2. **test(coach):** Leaks relativos com dados (z-score; `buildRelativeLeaks` exige `total>=15` e `>=3` peers no mesmo range).
3. **test(coach):** matriz do range — Range real/jogado renderizados + clicar mão no Top 20 abre `HandDetailCard` (célula precisa de `accuracy` e `topWrong:{action,n}`; range no store com o mesmo `rangeId` para o gabarito).
4. **test(table-editor):** nome vazio alerta, confirm recusado, label `* 120bb` (stack destoante), updateBet/updateStack (aria `Stack de X` — cuidado com colisão com "Stack para todos").
5. **test(ranges):** Treinar (fluxo completo e sem mãos), badges multi-stack, prereq, heatmap multi-stack (variantes rotuladas pelo stackRange — usar getAllByRole e pegar a última).
6. **test(stats):** Desempenho Global multi-stack (chaves `id|||stack` no handPerformance).
7. **test(auth):** Turnstile HABILITADO — `vi.stubEnv('VITE_TURNSTILE_KEY')` + `vi.resetModules()` + import dinâmico; onload do script disparado via spy no `document.head.appendChild` — `TurnstileEnabled.test.tsx`.
8. **test(admin):** publish ok grava hash, invalid/missing_token, modal interno, Enter.
9. **test(nav):** mousedown fora fecha perfil; publicar do admin abre modal.
10. **test(trainer):** SessionDetail do HistoryModal (acordeão+stacks+toggle; o botão da sessão e o do range casam o mesmo regex — usar getAllByRole e pegar o último) e sessão antiga sem handPerf ("Dados por mão não disponíveis...").
11. **test(editor):** remover grid da sessão (confirm sim/não), stack textual (placeholder exato 'Ex: <= 250, ou 250-300'), prereq via picker.
12. **test(matrix):** arrasto pinta/limpa (mouseDown+mouseEnter), mouseUp encerra, dedupe.
13. **test(trainer):** HandFilterGrid — arrasto de exclusão/inclusão (mouseDown/mouseOver/mouseUp), toggles RNG e Focar erros.

### Maiores lacunas restantes (alvos do próximo run)
- **CoachPanel.tsx** (82% linhas, 53% branch): aba "Por jogador" com jogadores (PlayersView, tendência por jogador), reset de senha do coach, publicar D1 com sucesso/erro.
- **TrainerPage.tsx** (86%): DrillSummary vazio, replay de entrada do histórico (clicar item da sidebar), barra de progresso do auto-advance.
- **LoginPage** (86%): Enter nos campos de cadastro; **Dashboard** (91%): hero start-training; **useStore** (91%): ramos raros de erro.
- Decidir com o Daniel: P1.1 (badge Range do Time), P3.8 (CSV), migração dos testes de `functions/api` (gate humano).

---

## 2026-07-02 (run automático — cobertura incremental, 10 fatias)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #34 ABERTA e atualizada** (auto/daily-improvements → feature/auth-telemetry). NÃO mergeada (gate humano).
- **675 testes verdes (68 arquivos)** (era 626), build verde. `main`/produção intactos.
- Só testes nesta run — nenhuma mudança de código de produção, zero risco visual.
- Stack: React 19, Vite 8, TypeScript 6, Tailwind 4, react-router 7, lucide-react 1.

### Feito nesta run (10 commits, cada um test+build verde + push)
1. **test(store):** `syncTeamRanges` (versão nova/vista/vazia/não-ok), `publishTeamRanges` (ok+erro), `adminSaveRanges` (ok/senha errada/token_expired/invalid_token/erro sem JSON) — `teamRanges.test.ts`.
2. **test(store):** `finalizeRange` — simples, customAction, agrupamento por posição, multi-stack (`stackGrids`), dedupe de slot, edição preservando id — `finalizeRange.test.ts`.
3. **test(layout):** `AppLayout` carrega páginas lazy (drill/history/range-setup/category-detail/coach). **GOTCHA:** RouterSync reseta a page se a rota do MemoryRouter discordar do store — passar `initialEntries` casando a rota (`/drill`, `/historico`, `/range-setup`, `/categoria`, `/coach`).
4. **test(trainer):** atalhos V (Ver Range) e R (Raise), RNG ligado, `acceptAnyFreq` ("Válido"), botão de ação customizada.
5. **test(coach):** ordenação do "Resumo do time" (Mãos/Precisão) e linha agregada TIME.
6. **test(range-setup):** ante desligado (0) e valor de ante customizado (`fireEvent.change`, não `userEvent.type` — input number no jsdom não limpa direito).
7. **test(auth):** `WelcomeModal` fecha (CTA + auto após 6s) e zera `firstLogin` (fake timers + `act`).
8. **test(auth):** `LoginPage` erro de login, validações de cadastro (usuário curto/e-mail inválido), Enter dispara login, "Já tenho conta" volta.
9. **test(dashboard):** navegação por categoria, "Ver todos", cards recentes (principal e secundária >3 ranges).
10. **test(editor):** stack sobreposto bloqueia push (alert), PRÓXIMO com editor vazio + grids na sessão → table-editor, Cancelar sai do modo de edição.

### Notas técnicas úteis (replicáveis)
- Cobertura: `npm i -D @vitest/coverage-v8@<versão do vitest> --no-save` + `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.reporter=json --coverage.reportsDirectory=<dir>` e extrair `coverage-final.json` (statementMap/s) para os ranges exatos. NÃO commitar a dep.
- Mock de rede no store: `globalThis.fetch = vi.fn(async () => ({ ok, status, json }))` (ver `authActions.test.ts`/`teamRanges.test.ts`).
- CoachPanel: sempre `invalidateAnalyticsCache()` no afterEach (cache TTL 15s vaza entre testes).
- `vi.mock('../utils/sentry', ...)` para silenciar `captureError` nos testes de store.

### Maiores lacunas de cobertura restantes (alvos do próximo run)
- **useStore.ts** (~80% linhas): `nextDrillHand` com `focusErrors=true` (peso por desempenho, linha do `weightedPick`); ramos de `checkDrillAnswer` com RNG por faixa; `logConsult`/`incrementConsults` acumulativos.
- **CoachPanel.tsx** (~81%): "Leaks relativos" (z-score), Segmentos/Lacunas com linhas clicáveis populadas, matriz do range (`useRangeGrid`) real/jogado.
- **TrainerPage.tsx** (~74%): DrillActive navegação "← Anterior"/"Mão atual" com snapshot completo, auto-advance com barra de progresso.
- **RangeEditorPage/TableEditorPage/RangeSetupPage**: ramos de overlap e edição de cenários restantes.
- Decidir com o Daniel: **P1.1 (badge Range do Time)** e **P3.8 (exportar sessão CSV)** — precisam de decisão de produto.

---

## 2026-07-01 (run automático — P1/P2 técnicos + cobertura incremental)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR NOVA aberta** auto/daily-improvements → feature/auth-telemetry (NÃO mergeada, gate humano).
- **626 testes verdes (66 arquivos)** (era 582), build verde. `main`/produção intactos.
- Cobertura subiu: linhas 77% → **83%** (StatsPage 50%→92%, useStore 61%→74%, CoachPanel 70%→75%).
- Stack: React 19, Vite 8, TypeScript 6, Tailwind 4, react-router 7, lucide-react 1.

### Feito nesta run (9 commits, cada um test+build verde + push)
1. **test(store):** caminho feliz das ações de auth (login/signup/logout/changePassword/devices/restoreSession) — `authActions.test.ts`.
2. **fix(i18n) [P2.5]:** datas seguem o idioma vigente via novo helper `dateLocale()` (pt-BR/en-US/es-ES). Corrigido `'pt-BR'` fixo em MyAccountStats/StatsPage/TrainerPage/AccuracySparkline.
3. **perf(coach) [P1.3]:** `src/utils/analyticsCache.ts` — `fetchAnalyticsCached` (cache por URL, TTL 15s) usado por todos os hooks do CoachPanel; `reload()` invalida via `invalidateAnalyticsCache`. Testes próprios + guard no CoachPanel.test (limpar cache no afterEach).
4. **test(store):** drill `acceptAnyFreq`/customAction, `startDrillSession` (novo sessionUuid), `stopDrill` (grava sessão), `clearHandPerformance`/`setRangePrereq` — `drillSession.test.ts`.
5. **test(stats):** SessionDetailView (acordeão de range, multi-stack, toggle visão) + Desempenho Global por posição.
6. **test(coach):** seções Segmentos/Lacunas/Evolução com dados (expande + popula fetch por view).
7. **test(editor):** handleNext (navegação), handlePushToSession, handleSaveSessionEdit.
8. **test(layout):** roteamento do AppLayout (ranges/admin fallback) + WelcomeModal/ChangePasswordModal.
9. **test(table-editor):** handleSaveEdit + fluxo de modal de nome (willBeCombined → finalizeRange(nome)).

### Sobre o backlog P1/P2/P3 do handoff anterior
- **P1.2 (gráfico de tendência):** JÁ ESTAVA IMPLEMENTADO no CoachPanel (seção Evolução renderiza `Sparkline` + `TrendBadge` + tabela por jogador). A varredura anterior estava desatualizada. Só faltava cobertura de teste — feita (fatia 6).
- **P1.3 (cache):** FEITO (fatia 3).
- **P2.5 (locale de data):** FEITO (fatia 2).
- **P1.1 (badge "Range do Time"):** NÃO feito. Bloqueio: não há forma robusta de distinguir range do coach (D1) de range nativo/usuário — todos usam IDs de timestamp; o range não persiste flag de origem. Precisaria persistir o set de `teamRangeIds` no `syncTeamRanges` (localStorage) — mudança de store com migração. Valor atual baixo (D1 ranges não ativos: front usa `adminRanges.json`). Recomendo decidir antes de investir.
- **P2.4 (memoizar CoachPanel/TrainerPage):** NÃO feito. Baixo valor: são componentes sem props, `memo` só evita re-render de pai (raro no AppLayout); risco de teste alto em arquivos de 1700 linhas. Deixado de fora.
- **P2.6 / P3.7 (extrair/testar helpers de `functions/api/analytics.js`, remover endpoints mortos):** GATE HUMANO — mexe em `functions/api`. NÃO implementado pelo agente. Registrar como proposta se desejado.
- **P3.8 (exportar sessão CSV):** nice-to-have, não feito (sem decisão do Daniel).

### Próximas fatias sugeridas (todas sem gate humano)
- Cobertura restante: **TrainerPage** (DrillActive navegação/auto-advance/atalhos ainda parciais), **CoachPanel** (Resumo do time ordenável + PlayerQuickSummary inline; relative leaks), **useStore** (finalizeRange multi-grupo/edição; nextDrillHand focusErrors), **AppLayout** (páginas lazy: drill/history/category-detail/coach).
- Decidir P1.1 (badge) e P3.8 (CSV) com o Daniel.

---

## 2026-06-30 (sessão interativa — Tailwind 4 + varredura geral)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #30 MERGEADA** — Vite 6→8 + @vitejs/plugin-react 4→6. Validado no browser.
- **PR #32 MERGEADA** — Tailwind 3→4. Validado no browser.
- **MFA GitHub e Cloudflare** — concluídos em 30/06/2026.
- **582 testes verdes (63 arquivos)**, build verde. `main`/produção intactos.
- Stack atual: React 19, Vite 8, TypeScript 6, Tailwind 4, react-router 7, lucide-react 1.

### Varredura geral — conclusões (30/06/2026)
- Zero TODOs/FIXMEs no código. Cobertura de testes excelente, i18n completo (507 chaves PT/EN/ES), a11y boa.
- **Principais gaps encontrados:**
  1. `coachTrend.ts` (`buildTrend`, `classifyTrend`) calcula regressão linear de precisão semanal mas **o resultado nunca é renderizado** no CoachPanel (seção "Evolução" existe mas está colapsada sem gráfico real).
  2. Ranges publicados pelo coach (D1) chegam ao localStorage do jogador sem **nenhum badge/indicador visual** — jogador não sabe qual range é do coach e pode sobrescrevê-lo acidentalmente.
  3. `CoachPanel` (1728 linhas) e `TrainerPage` (1391 linhas) **não são `React.memo`** — re-render completo ao trocar abas/seções. Padrão de memoização já aplicado em HandMatrix/RangeHeatGrid/HandHistorySidebar.
  4. Fetches de analytics do CoachPanel **sem cache** — cada troca de filtro/aba dispara novo fetch; resultado anterior descartado.
  5. Endpoints `?view=foco` e `?view=consult-hotspots` existem no backend mas **UI foi removida** (código morto no analytics.js).
  6. Datas hardcoded `'pt-BR'` em `MyAccountStats.tsx:48` — deveria usar locale do i18n.

### Próximas fatias para o agente (priorizadas)

#### P1 — Alto impacto, sem gate humano
1. **Badge "Range do Time"** (`src/components/Situations/SituationsPage.tsx` + `src/store/useStore.ts`)
   - Ranges que vieram do D1 (`syncTeamRanges`) têm `id` dentro da faixa dos admin ranges.
   - Exibir badge visual "Coach" no `RangeCard` e bloquear edição (botão Editar desabilitado com tooltip "Range publicado pelo coach — não editável").
   - Baixo risco: só visual + proteção de UX. Testes: RangeCard com range do time.

2. **Renderizar gráfico de tendência no CoachPanel** (`src/components/Admin/CoachPanel.tsx` + `src/utils/coachTrend.ts`)
   - A seção "Evolução" já existe e chama `useTrend` (fetch `?view=trend`). Retorna dados de regressão linear por semana.
   - Renderizar SVG inline (mesmo padrão do `AccuracySparkline`) com accuracy % por semana + linha de tendência + classificação textual (`classifyTrend`: "melhorando", "estável", "piorando").
   - `coachTrend.ts` já tem `buildTrend(weeks)` → `{slope, r2, label}`. Só falta o componente visual.
   - Testes: dados mockados → SVG renderizado com pontos + label de tendência.

3. **Cache de API analytics no CoachPanel** (`src/components/Admin/CoachPanel.tsx`)
   - Padrão simples: guardar último resultado + timestamp por `cacheKey = view + JSON.stringify(params)`.
   - Se mesmo key chamado em menos de 15s, retorna cache sem fetch.
   - Sem biblioteca externa — apenas `useRef` com `{data, ts, key}`.
   - Testes: segundo fetch com mesmos params retorna cache; params diferentes disparam fetch.

#### P2 — Médio impacto, baixo risco
4. **Memoizar CoachPanel e TrainerPage**
   - Exportar como `const CoachPanel = memo(function CoachPanel(...) {...})`.
   - Todos os handlers internos já usam `useCallback`/`useMemo` (varredura confirmou). Risco baixo.
   - Prova com `countRender` (padrão do `src/test/renderCount.ts` já existe): trocar aba não re-renderiza o painel inteiro.

5. **Corrigir locale de data** (`src/components/Stats/MyAccountStats.tsx:48`)
   - Trocar `'pt-BR'` hardcoded por `store.lang === 'en' ? 'en-US' : store.lang === 'es' ? 'es-ES' : 'pt-BR'`.
   - Ou criar helper `formatDate(ts, lang)` em `src/utils/` para reusar em StatsPage/CoachPanel.

6. **Cobertura de testes: `functions/api/`**
   - `analytics.js` (415 linhas) tem zero testes unitários. Extrair helpers puros (ex: `dateCond`, `buildLeaks`, `buildSegments`) para arquivo separado e testá-los com Vitest (mesmo padrão do `worker/index.test.js`).
   - Não requer D1 real — mockar o binding `DB` com objeto `{ prepare: () => ({ bind: () => ({ all: () => ({results:[]}) }) }) }`.

#### P3 — Nice-to-have (só se P1+P2 concluídos)
7. **Remover endpoints mortos do backend** (`functions/api/admin/analytics.js`)
   - `?view=foco` e `?view=consult-hotspots` — remover os blocos de código (sem UI, sem testes) para reduzir complexidade de manutenção.
   - Confirmar que nenhum componente chama esses views antes de remover.

8. **Exportar sessão de treino como CSV** (`src/store/useStore.ts` + `src/utils/download.ts`)
   - `downloadText` já existe. Adicionar `exportSessionCsv(session: TrainingSession)` que gera CSV com colunas: mão, ação tomada, ação correta, acerto, RNG, range, timestamp.
   - Botão no `SessionCard` do StatsPage.

### Regras operacionais do agente (não mudar)
- Nunca mergear em `main`. PRs sempre para `feature/auth-telemetry`.
- Testar `npm run build` (tsc) E `npm test` antes de cada commit — build tsc e vitest podem divergir.
- Mudanças visuais novas (novas seções, gráficos, badges) → sinalizar para validação humana no preview Cloudflare antes de mergear.
- Fatias de cobertura e correções técnicas → pode abrir e mergear sem gate humano se testes passarem.
- Auth/functions/api/worker/D1 com mudanças de schema → gate humano obrigatório.

---

## 2026-06-30 (sessão interativa — Vite 8 + cobertura)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #29 MERGEADA** — cobertura +22 testes (582 total).
- **PR #30 ABERTA** — Vite 6→8 + plugin-react 4→6. **NÃO mergeada** (requer validação visual no browser pelo Daniel).
- **582 testes verdes (63 arquivos)**, build verde. `main`/produção intactos.

### Feito nesta sessão
- Vite 6→8, @vitejs/plugin-react 4→6. `vite.config.ts` e `manualChunks` sem mudança.
- `babel-plugin-react-compiler` e `@rolldown/plugin-babel` são peerDeps opcionais — não instalados.
- **REQUER VALIDAÇÃO VISUAL:** abrir preview do Cloudflare (`auto-daily-improvements.pre-flop-pro.pages.dev`), confirmar que app carrega sem tela branca. Risco: Rolldown (novo bundler do Vite 8) pode alterar chunking e quebrar `forwardRef` como aconteceu antes.

### Pendências
- [ ] **Validar PR #30 no browser** e mergear se OK.
- [ ] **Tailwind 4** — próxima migração após PR #30 mergeada; precisa de sessão dedicada com validação visual.
- [ ] **MFA** GitHub e Cloudflare — manual, só Daniel.

---

## 2026-06-30 (sessão interativa — validação router v7 + cobertura incremental)

### Estado (PONTO DE PARTIDA do próximo run)
- **PR #26 MERGEADA** em `feature/auth-telemetry` — lucide-react 1, TypeScript 6, react-router-dom 7.
- **Fix obrigatório incluso:** RouterSync dessincronizava URL no F5 (effect store→URL lia página stale do render anterior). Corrigido lendo `useStore.getState().page` em vez do valor fechado na closure. Validado manualmente no browser (Cloudflare preview): navegação, back/forward, F5, deep-link OK.
- **PR #29 ABERTA** (auto/daily-improvements → feature/auth-telemetry) — cobertura incremental +22 testes. **NÃO mergeada** (gate humano).
- **582 testes verdes (63 arquivos)**, build verde. `main`/produção intactos.

### Feito nesta sessão (3 commits, cada um testado + build verde)
1. **fix(router):** RouterSync F5 — `useStore.getState().page` no effect store→URL.
2. **test(coach):** ordenação Por range (desc/asc/trocar coluna), 4 seções erro, 2 seções vazio, clicar linha → range-grid, leaks com dados.
3. **test(trainer):** HandFilterGrid Tudo/Nada, DrillSummary accuracy por range, expansão heatmap.
4. **test(store):** nextDrillHand prereq/multi-stack, checkDrillAnswer RNG, incrementConsults, logConsult.

### Maiores lacunas de cobertura restantes
- **CoachPanel.tsx** — seções Segmentos/Lacunas com dados reais (tabelas preenchidas); `PlayerQuickSummary` integrado no Resumo do time (clicar jogador → abre resumo inline com fetch de by-range).
- **TrainerPage.tsx** — HistoryModal: SessionDetail acordeão por range + heatmap dentro do detalhe.
- **useStore.ts** — `checkDrillAnswer` com `acceptAnyFreq=true` ("Válido — ação principal: ..."); `stopDrill` salva sessão; `startDrillSession` inicializa `sessionUuid`.
- Auth/functions/api/worker/D1: seguem gate humano.

### Pendências
- [ ] **Mergear PR #29** após revisão.
- [ ] **Tailwind 4 / Vite 8** — validação visual humana necessária (PRs Dependabot #20/#25); não delegar ao agente sem smoke test no browser.
- [ ] **MFA** GitHub e Cloudflare — manual, só Daniel.

---

## 2026-06-30 (retomada — push da migração de dependências confirmado)
- A run automática abaixo ("migração de dependências") tinha ficado com 3 commits locais
  válidos (560 testes + build verdes) mas **sem conseguir fazer push** por falta de
  autorização de escrita no proxy git daquela sessão (Claude Code on the web). O
  container daquela sessão foi reciclado antes do Daniel conseguir intervir.
- Recuperação: a sessão anterior havia salvo os 3 commits + o commit de handoff como
  4 arquivos `.patch` (`git format-patch`) no scratchpad do próprio container. O Daniel
  colou o conteúdo desses patches nesta conversa (sessão local, com push autorizado).
- Esta sessão: recriou `auto/daily-improvements` a partir de `feature/auth-telemetry`
  (que já tinha a PR #24 mergeada), aplicou os 4 patches com `git am` (sem conflitos,
  autoria/mensagens originais preservadas), rodou `npm install` + `npm test` (560
  testes verdes) + `npm run build` (verde) de novo do zero para confirmar, e então fez
  o push.
- **router 7 + RouterSync continua SEM validação humana no browser** — ver GOTCHA
  abaixo. Isso não mudou; só o push foi destravado.

## 2026-06-30 (run automático — migração de dependências: lucide-react, TypeScript, react-router-dom)

### Estado (PONTO DE PARTIDA do próximo run)
- Branch `auto/daily-improvements` recriada a partir de `feature/auth-telemetry` (PR #24 já mergeada).
- **560 testes verdes (63 arquivos), build verde.** Todas as 3 migrações concluídas com commits locais.
- **BLOQUEIO DE PUSH:** o proxy git desta sessão retornou "Not authorized to access repository danielluizdl/pre-flop-pro" para operações de escrita. Commits existem localmente. Daniel precisa verificar a autorização do GitHub no painel de configuração do ambiente Claude Code on the web e fazer o push manualmente, ou reautorizar e rodar de novo.
  - Alternativa: `git push -u origin auto/daily-improvements` a partir de uma sessão com acesso de escrita.
- **NÃO feito (conforme planejado):** Tailwind 4 (validação visual humana) e Vite 8 (smoke test no browser).

### Feito nesta run (3 commits locais, cada um testado + build verde)

1. **feat(deps): lucide-react 0.47 → 1.22** — todos os 18 ícones usados existem em v1 sem renomeação. Zero mudança de código-fonte.
2. **feat(deps): TypeScript 5.7 → 6.0** — único ajuste necessário: substituir `vi.spyOn(global,` por `vi.spyOn(globalThis,` em 3 arquivos de teste (TS6 não reconhece `global` do Node no ambiente DOM). Zero erros de tipo na produção.
3. **feat(deps): react-router-dom 6.30 → 7.18** — APIs usadas (BrowserRouter, useLocation, useNavigate, MemoryRouter) são idênticas em v7. RouterSync e seu ref `lastSynced` anti-loop-infinito intactos.

### GOTCHA CRÍTICO — react-router-dom v7 + RouterSync
- Testes e build passam, mas **router 7 + React 19 + RouterSync é a combinação mais frágil do projeto**.
- O handoff anterior (PR #24) registrou que o RouterSync entrou em loop infinito com react-router 6 + React 19 — foi resolvido com o ref `lastSynced`. Com router 7 (nova versão), o timing de re-renders pode ser diferente novamente.
- **REQUER VALIDACAO HUMANA NO BROWSER antes de mergear.** Abrir o app no preview do Cloudflare, navegar entre páginas, usar back/forward do browser, testar F5. Se o app travar ou piscar em loop: reverter o commit do router e registrar no handoff.

### Pendências para próximas runs
- Push dos 3 commits (bloqueado nesta sessão por falta de autorização de escrita no proxy).
- Abertura de PR: auto/daily-improvements → feature/auth-telemetry.
- Tailwind 4 e Vite 8 seguem fora do escopo até validação visual humana.
- Cobertura incremental (alvos do run anterior continuam válidos: CoachPanel, TrainerPage, useStore).

---

## 2026-06-30 (sessão interativa — migração base para React 19)
- **React 18 → 19** (react/react-dom/@types). Feito interativamente e **VERIFICADO NO NAVEGADOR** (build+preview+Playwright: app monta, 0 pageerror). Mergeado JUNTO com as 13 fatias de cobertura do agente de hoje.
- **Fix obrigatório:** `RouterSync` entrava em **loop infinito** no React 19 (ping-pong URL↔store entre os dois efeitos com react-router 6). Resolvido com um ref `lastSynced` que ignora a navegação recíproca que nós mesmos disparamos. Resto da suíte do agente passou no 19 sem mudança.
- **560 testes verdes (63 arquivos), build verde, render OK no browser.**
- **LIÇÃO CRÍTICA p/ o agente (repetiu 2x):** `npm test` + `npm run build` VERDES **não garantem** que o app renderiza. Tanto a divisão de chunks (`forwardRef undefined`) quanto o loop do RouterSync passaram em teste/build mas davam **tela branca**. Para mudanças de **dependência (major), `vite.config` chunks, ou react-router/RouterSync**: ser conservador e SINALIZAR pra validação humana no navegador — não assumir que verde = funcionando.
- **NÃO mergear** os PRs Dependabot **#20** (Tailwind 4/Vite 8/TS 6) e **#21** (router 7/lucide 1) — são migrações maiores separadas, adiadas de propósito. React 19 foi feito SOZINHO (sem router 7/lucide 1), e funciona.

## 2026-06-30 (cobertura incremental segura — sem epic novo aberto pelo Daniel)

### Estado (PONTO DE PARTIDA do próximo run)
- **Epic #15 (observabilidade) e #17 (3 opções) já fechados/entregues.** Daniel ainda NÃO abriu/escolheu um epic novo.
  Sem decisão, esta run seguiu o protocolo do handoff: **cobertura incremental segura** (testes + a11y), nada de backend,
  nada de novo epic. Foco: derrubar as maiores lacunas de cobertura (medidas com `@vitest/coverage-v8`, dep instalada só
  para análise e NÃO commitada).
- **PR #23 (seletor de idiomas) já estava MERGEADA** em `feature/auth-telemetry`. A branch `auto/daily-improvements` foi
  recriada a partir de `feature/auth-telemetry` (mergeada a base, que tinha 5 commits novos: bump de actions + fix de ciclo de chunk).
- **560 testes verdes (63 arquivos)** (era 482), build verde. **PR NOVA aberta** auto/daily-improvements → feature/auth-telemetry. `main`/produção intactos.

### Feito nesta run (13 fatias, cada uma commit+push+verde)
1. **test(error-boundary):** fluxo "Exportar backup e resetar dados" (download, dupla confirmação, reset+reload, catch de backup).
2. **test(brush):** condição custom do BrushControls (nome/pct/cor/remover devolve extra ao fold) + raiseSize.
3. **test(ranges):** ações do RangeCard (editar/apagar com confirm/precisão acumulada) + modal de heatmap (sem dados / resetar).
4. **test(my-account):** linhas das tabelas Por range / Piores mãos + gestão de sessões ativas (encerrar / encerrar as outras).
5. **test(editor):** RangeEditorPage — nome, presets de stack, limpar, prereq picker, limpar grid, edição de grids da sessão.
6. **test(table-editor):** cenários (add/editar/remover/finalizar com confirm), botões de stack, troca de ação (updateRole), voltar.
7. **test(hand-quick-select):** aplicar/limpar pincel por grupo, desabilitado com pincel zerado, toggle do filtro.
8. **test(store) scenarioActions:** initTableConfig/setupNewRange + updateHero/Role/Bet/Stack/setAllStacks + buffer de cenários.
9. **test(store) gridActions:** pincel sobre grid, grids da sessão (push/update/remove), seleção do drill, setTableFormat/prereq/toggleEditorPosition.
10. **test(coach):** RangeHeatGrid — métricas consultas/volume (cor), topWrong no tooltip, mouseLeave esconde.
11. **test(ui):** seletor de stackGrids do RangePreviewModal + colapso de grupos do PrereqRangePicker.
12. **test(category):** CategoryDetailPage — treinar (inicia sessão/navega; sem mãos alerta), editar, precisão, "Início".
13. **test(drill):** seleção de ranges (expand + "Selecionar todos"), CONTINUAR → filtro, INICIAR TREINO sem mãos (aviso inline).
- **fix(test) (importante):** uma fatia do TableEditor quebrou o **build tsc** (usei `Array.at`, lib < es2022). Corrigido com
  indexação. **LIÇÃO: rodar `npm run build` (tsc), não só vitest, antes de cada commit** — vitest passa mas o tsc do build não.

### Notas técnicas úteis (replicáveis)
- Cobertura: `npm i -D @vitest/coverage-v8@<versão exata do vitest> --no-save` e
  `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.reporter=text`. NÃO commitar a dep.
- Substituir ações do store por `vi.fn()` via `useStore.setState({ acao: vi.fn() })` para asserir chamadas (sem reset entre
  testes do mesmo arquivo — cada teste re-seta o que precisa).
- jsdom normaliza `rgba(a,b,c,d)` com espaços → casar `'239, 68, 68'` (com espaço), não `'239,68,68'`.
- `getByPlaceholderText(/Ex:/)` colide (nome E stack começam com "Ex:") — usar o placeholder completo.
- Strings i18n: SEMPRE conferir o valor exato em `src/i18n/pt.ts` antes de casar por texto (ex.: `remove: 'remover'` minúsculo, `viewHeatmap: 'Ver heatmap'`).

### Maiores lacunas de cobertura restantes (alvos do próximo run)
- **CoachPanel.tsx** (65% — ainda o maior; muitas seções com ramos error/empty/loading via `Section`: Segmentos/Lacunas/Leaks/Evolução; matriz, ordenações de tabela).
- **TrainerPage.tsx** (DrillActive: navegação prev/próxima já parcial; DrillSummary por range; HandFilterGrid quick-select).
- **useStore.ts** (nextDrillHand com prereq/multi-stack; checkDrillAnswer com RNG ligado; logConsult/incrementConsults).
- Sem nova decisão do Daniel, manter cobertura incremental segura. Auth/functions/api/worker/D1 seguem gate humano.

---

## 2026-06-29 (sessão interativa — seletor de idiomas PT/EN/ES)

### Estado
- **i18n completo do app** (PR #22) foi **mergeado** em `feature/auth-telemetry`. Em cima dele, esta sessão entregou o
  **seletor de idiomas** (PT-BR/EN/ES). **PR #23 ABERTA** (auto/daily-improvements → feature/auth-telemetry), NÃO mergeada.
- **482 testes verdes (61 arquivos)**, build verde. `main`/produção intactos.

### Arquitetura i18n reativa (importante p/ futuras strings)
- `src/i18n/index.ts`: `t` é um **Proxy** que lê o dicionário do idioma vigente (`current`), trocado por `setLangDict(lang)`.
  Componentes seguem `import { t }` e o texto acompanha a troca **ao re-renderizar**.
- `pt.ts` SEM `as const` → `Messages = typeof pt` é estrutural; `en.ts`/`es.ts` `: Messages` → **tsc força completude**.
  Ao adicionar uma chave nova: adicione em pt, en E es (senão não compila). 507 chaves nas 3 línguas.
- **GOTCHA crítico:** NÃO capturar `t.x.y` em constante de MÓDULO (valor congela no idioma do boot). Use função/label em
  tempo de render (ver NAV_ITEMS, metricLabel, tabLabel, trendLabel, severityLabel/Help). Componentes memoizados com texto
  traduzido pegam o idioma via `key={lang}` no AppLayout (re-monta na troca; estado do drill vive no store, não se perde).
- Store: `lang`+`setLang` persistidos em `fbr-ui-state`; `setLangDict` no boot (main.tsx) + `onRehydrateStorage`.
- `LanguageSelect` em TopNav/Sidebar/LoginPage. Tokens de poker (Raise/Call/Fold/All-in/Range/Stack/BB/RNG/Blunder) NÃO traduzidos.

### Próximas fatias possíveis
Revisar/mergear PR #23. Idiomas extras seguem o mesmo padrão (criar `xx.ts: Messages`, adicionar a `DICTS`/`LANGS`).
Sem nova decisão, manter cobertura incremental segura.

---


## 2026-06-29 (sessão interativa — Daniel mandou fazer as 3 opções da #17 + mergear o que aguardava aval)

### Estado (PONTO DE PARTIDA do próximo run)
- **Daniel autorizou explicitamente:** fazer as **3 opções da issue #17** (responsividade, i18n, qualidade) e
  **mergear o que estava no gate humano**.
- **PR #16 MERGEADA** em `feature/auth-telemetry` (merge `406c582`) — observabilidade #15 + cobertura/a11y/type-safety.
- **PR #22 ABERTA** (auto/daily-improvements → feature/auth-telemetry) com o trabalho das 3 opções. NÃO mergeada (deixei pra ele revisar/validar no preview).
- **472 testes verdes (60 arquivos)**, build verde. `main`/produção intactos (nada foi pro `main`).

### Feito nesta run (as 3 opções da #17)
**Opção 1 — Responsividade (mudanças aditivas sm:/md:/lg:/xl:, desktop intacto):**
- TopNav: rótulos de nav viram `sr-only` no mobile (ícones-only, nome acessível preservado); "Novo Range"/conta recolhem com `aria-label`; padding do `main` menor no mobile.
- DrillActive: empilha mesa + histórico no mobile (`flex-col` → `lg:flex-row`); sidebar usa `--sw` p/ manter largura fixa sticky só em lg+.
- CoachPanel: "Matriz do range" vira coluna abaixo de `xl` (real/jogado + precisão/Top20/detalhe); xl+ intacto.
- Grids de stats (4 métricas) → 2x2 no mobile; 3 cards de nuvem → 1 coluna.
- Editor/TableEditor JÁ eram responsivos (flex-col xl:flex-row).
- **PENDENTE (precisa de validação visual no preview, NÃO fiz por risco):** escalonar a mesa de poker (`PokerTableEditor`)
  em telas <360px — os assentos são `w-[55px]` posicionados por % e vazam/sobrepõem quando o container encolhe. Abordagem
  provável: `transform: scale()` no wrapper da mesa em mobile (cuidar do espaço vertical que o scale deixa). Conferir no preview.

**Opção 2 — i18n (fundação + áreas-chave):**
- `src/i18n/pt.ts` (dicionário tipado `as const`) + `src/i18n/index.ts` (`t = pt`). Teste `src/i18n/i18n.test.ts`.
- Migrados: `LoginPage`, `WelcomeModal`, `ChangePasswordModal`, `TopNav`. **Texto visível idêntico** (conferi contra os testes).
- PADRÃO: `import { t } from '../../i18n'` e trocar literal por `t.area.chave`. Greeting parametrizado = função `(name) => ...`.
  Strings com markup inline: dividir em `bodyBefore`/`bodyAfter` + `t.common.appName`. **Gotcha:** casar EXATAMENTE o texto atual
  (ex.: ChangePasswordModal era "Defina sua senha"/"Salvar senha", não inventar) senão quebra os testes que usam `getByText`.
- Áreas a migrar depois (incremental): Dashboard, SituationsPage, TrainerPage (drill), StatsPage, CoachPanel, editores.

**Opção 3 — Qualidade/type-safety:**
- tsconfig: `noUnusedLocals`/`noUnusedParameters` = true (código já passava com 0 erros; agora barra código morto futuro).
- Cobertura de store: `src/store/editorActions.test.ts` (toggleEditorPosition single-select + apostas do updateRole).

### Continuação (mesma sessão — Daniel validou o preview e mandou "continue com o resto")
- **Mesa de poker responsiva (FEITO):** `ResizeObserver` no DrillActive mede o wrapper e aplica `transform: scale`
  proporcional abaixo de 529px (largura de projeto), com `transformOrigin: top center` e altura ajustada
  (`TABLE_DESIGN_H * scale`) p/ não deixar gap. Desktop (>=529px) → scale 1 (intacto). Stub de `ResizeObserver`
  no `src/test/setup.ts`. Padding da mesa virou `px-8 sm:px-10`.
- **i18n +2 áreas:** `Dashboard` (t.dashboard) e `RangeSetupPage` (t.rangeSetup).

### Continuação (mesma sessão — Daniel: "siga migrando até terminar")
- **i18n CONCLUÍDO em TODO o app.** Todas as áreas migradas para `src/i18n/pt.ts` (dicionário tipado `as const` + `t`):
  auth (Login/Welcome/ChangePassword), nav (TopNav/Sidebar), AppLayout, Dashboard, RangeSetup, RangeEditor, TableEditor,
  Situations, CategoryDetail, TrainerPage (drill inteiro), StatsPage, MyAccountStats, AccuracySparkline, AdminPanel,
  CoachPanel (TODAS as seções/tabelas/matriz/PlayersView/legendas/metas), RangeHeatGrid, RangeActionGrid, ComboCounter,
  BrushControls, HandMatrix, PrereqRangePicker, RangePreviewModal, PokerTableEditor, ErrorBoundary, e strings de UI do
  **store** (feedback do drill em `checkDrillAnswer`, erros de rede `t.netErrors`).
- **Mesa de poker responsiva** entregue (scale via ResizeObserver no DrillActive).
- **472 testes verdes (60 arquivos)**, build verde. Branch `auto/daily-improvements` pushada. PR #22 atualizada (NÃO mergeada — gate humano).

### Padrão i18n (replicável para novas strings)
- `import { t } from '<path>/i18n'`; trocar literal por `t.area.chave`. Parametrizado = função `(x) => \`...${x}...\``.
- **SEMPRE casar o texto atual EXATAMENTE** (rodar o teste do componente: `getByText`/`getByRole name`/`getByLabelText`).
- Strings com markup inline → dividir em `before`/`after` + span no meio (ex.: legendas do CoachPanel).
- Tokens de domínio NÃO traduzidos (são constantes): FOLD/CALL/RAISE/ALL-IN, BB, RNG, posições (BTN/CO/…), nomes de mãos.
- **Gotcha:** `.map(t => …)` sombreia o import `t` — renomeie o param (ex.: `tab`, `col`) se precisar de i18n dentro.

### PRÓXIMA FATIA
Épico #17 essencialmente concluído (3 opções entregues). Próximos passos possíveis (precisam de aval/decisão do Daniel):
revisar/mergear PR #22; criar `en.ts` e um seletor de idioma (a fundação já permite); responsividade fina adicional
validada no preview. Sem nova decisão, manter cobertura incremental segura.

---

## 2026-06-29 (cobertura incremental + a11y polish — ainda aguardando decisão da issue #17)

### Estado (PONTO DE PARTIDA do próximo run)
- **Issue #17 (próximo epic) SEM resposta do Daniel** (sem comentários). Sem decisão, esta run seguiu o protocolo
  do handoff: **cobertura incremental segura + pequenos polimentos de a11y/UX** (Opção 3), nada de backend, nada de novo epic.
- **PR #16** (auto/daily-improvements → feature/auth-telemetry) atualizada com a seção de hoje no topo. NÃO mergeada (gate humano).
- **462 testes verdes (58 arquivos)**, build verde. Branch `auto/daily-improvements` pushada. `main`/produção intactos.

### Feito nesta run (9 fatias, cada uma commit+push+verde)
1. **feat(coach):** `RangeSelect` rola a opção ativa para a vista ao navegar por setas (`scrollIntoView`); stub de
   `scrollIntoView` em `src/test/setup.ts` (jsdom não implementa — sem ele jsdom loga "Not implemented").
2. **test(drill):** navegação "← Anterior"/"← Mão atual" do `DrillActive`. Padrão: stub `nextDrillHand` via setState
   que retorna `true` (e seta novo `activeHand`) para habilitar o snapshot anterior.
3. **test(coach):** erro de rede + "Tentar novamente" da seção "Por range" (flag `failByRange` no mock de fetch que vira `false` no retry).
4. **test(matrix):** `HandMatrix` — clearHand em célula preenchida, aviso brush >100% (não aplica), tooltip de precisão
   no modo Erro/Acerto (treinado e "Não treinado"), troca de modo.
5. **a11y:** `aria-label="Fechar"` nos 4 botões ✕ de modais (RangePreviewModal/AdminPanel/SituationsPage heatmap/Ver Range do drill).
   **GOTCHA:** o teste do RangePreviewModal usava `getByRole('button',{name:'✕'})` → trocar para `name:'Fechar'`.
6. **a11y:** `aria-pressed` nos toggles Ações/Erro-Acerto da HandMatrix e no "2s" do drill (+ `aria-label` "Avanço automático em 2 segundos").
   **GOTCHA:** ao dar `aria-label` no "2s", os testes que o buscavam por `name:'2s'` quebram → usar o novo nome.
7. **test(stats):** tooltip de hover do `AccuracySparkline` (mouseEnter mostra %, mouseLeave esconde).
8. **test(coach):** busca por nome no `MultiPlayerSelect` (digitar restringe a lista; mock de `/admin/users`).
9. **test(topnav):** navegação (setPage), toggle de tema, menu de perfil + logout, "Painel Coach" só para coach.
   **GOTCHA:** `CurrentUser` usa `firstLogin: boolean` (NÃO `first_login`); shape errado passa no vitest mas quebra o `tsc` do build.

### Notas técnicas úteis
- `useStore.setState({ acao: vi.fn() })` substitui ações no store p/ asserir chamadas (não há reset entre testes do mesmo arquivo — independência por ordem).
- Para tooltips/hover SVG: `fireEvent.mouseEnter(circle)` + asserir texto; `mouseLeave` some.
- Maiores gaps restantes (baixo ROI): `useStore`/`TrainerPage`/`StatsPage` ramos muito ligados a DOM/localStorage; `CoachPanel` ramos por seção (cada seção tem error/empty/loading via `Section`).

### PRÓXIMA FATIA
**Aguardar decisão do Daniel na issue #17.** Se escolher antes do run, começar o epic escolhido (Opção 1 responsividade =
mudanças aditivas `sm:`/`md:` + teste de render por fatia, validar no preview Cloudflare). Sem decisão, seguir cobertura
incremental: alvos sugeridos = `SessionDetailView` (acordeão por range + heatmap dentro do detalhe) e ramos de error/empty
das seções restantes do `CoachPanel` (Segmentos/Lacunas/Leaks/Evolução).

---

## 2026-06-28 (cobertura incremental + type-safety — aguardando decisão da issue #17)

### Estado (PONTO DE PARTIDA do próximo run)
- **Epic #15 (observabilidade) já estava FECHADO.** Daniel ainda NÃO escolheu o próximo epic na **issue #17**
  (opções: 1=responsividade/mobile [recomendado], 2=i18n, 3=qualidade de código). Sem decisão, esta run fez
  só **cobertura incremental segura + qualidade de código** (Opção 3), nada de novo epic, nada no backend.
- **PR #16** (auto/daily-improvements → feature/auth-telemetry) atualizada com as fatias de hoje. NÃO mergeada (gate humano).
- **449 testes verdes (58 arquivos)**, build verde. Branch `auto/daily-improvements` pushada. `main`/produção intactos.

### Feito nesta run (7 fatias, cada uma commit+push+verde)
1. **test(hands):** `src/utils/handsHelpers.test.ts` (novo) — grupos de mãos, `weightedPick`, `focusWeight`,
   `generateSuits`, `getHighestFrequencyAction`, `countNonFoldHands`, `stackRangesOverlap`. (+34)
2. **refactor(types):** zero `any` no código de produção — `CoachPanel.detail` → `CoachDetailRow` tipada;
   `Turnstile` tipa `window.turnstile` via global augmentation (remove `window as any`).
3. **test(stats):** StatsPage — precisão global, fluxo Ver detalhes↔Voltar, gate da aba de nuvem.
4. **test(combo):** ComboCounter — estado vazio, total ✓ (1326) e ⚠ (soma incompleta).
5. **test(dashboard):** estado vazio (navega range-setup) + seção secundária >3 ranges.
6. **test(a11y):** useModalA11y — Tab no meio não prende; modal sem focáveis ignora Tab.
7. **test(admin):** AdminPanel — bloqueio por validação + "Publicar mesmo assim", status token_expired/erro,
   descarte de hash legado.

### Notas técnicas úteis
- Coverage: instalar `@vitest/coverage-v8` (mesma versão do vitest) e rodar
  `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.reporter=text` para achar lacunas.
  NÃO commitar a dep — usar só para análise (foi revertida nesta run).
- Maiores gaps de cobertura restantes (componentes, em ordem de tamanho): `StatsPage`/`TrainerPage`/`useStore`
  (muito ligado a DOM/localStorage — baixo ROI), `CoachPanel` (43% branch), `HandMatrix`, `TopNav`.
- `getByText` único quebra com texto repetido (ex.: "88%" no card global e no SessionCard) — usar `getAllByText`.

### PRÓXIMA FATIA
**Aguardar decisão do Daniel na issue #17.** Se escolher antes do run, começar o epic escolhido. Sem decisão,
seguir cobertura incremental segura: próximos alvos sugeridos = comportamento do `CoachPanel` (abas/filtros já
parcialmente testados; faltam ramos de erro/empty por seção) e do `TrainerPage` (navegação prev/próxima, Ver Range).

---

## 2026-06-27 (run das 5h — EPIC #15 FECHADO; próximo epic à espera de decisão)

### Estado atual (PONTO DE PARTIDA do próximo run)
- **Epic #15 (observabilidade) COMPLETO** — todas as fases + continuações. **PR #16 ABERTA e atualizada**
  (auto/daily-improvements → feature/auth-telemetry), NÃO mergeada (gate humano). **402 testes verdes (57 arquivos)**, build verde.
- Comentei na issue **#15** marcando como completo (fechar quando a PR #16 for revisada).
- **Próximo epic à espera da escolha do Daniel: issue #17** (3 opções: 1=responsividade/mobile [recomendado],
  2=i18n, 3=qualidade de código). Enquanto não decide, o agente faz só cobertura incremental segura.
- Branch `auto/daily-improvements` ✓ pushada; base `feature/auth-telemetry`; `main`/produção intactos.

### Feito nesta run (6 fatias, cada uma commit+push+verde)
1. **FASE 2 (resto):** `captureError(e,{area})` nos demais catches silenciosos do `useStore.ts`
   (`authLogin`/`authSignup`/`changePassword`/`restoreSession`/`syncTeamRanges`/`listDevices`/`revokeDevice`/
   `revokeOtherDevices`/`adminSaveRanges`) — sem mudar o retorno.
2. **FASE 4 (extensão):** `eventQueue` reporta telemetria degradada UMA vez por sessão (flags dedup) —
   fila cheia (cap 500) e falha de gravação por cota. Testes mockam `./sentry`.
3. **FASE 3 (extensão):** breadcrumbs nas ações de dados (`finalizeRange`/`deleteRange`/`exportData`/
   `resetLocalData`) + novo `src/store/breadcrumbs.test.ts` (mocka sentry).
4. **FASE 2:** `ErrorBoundary.componentDidCatch` passa `variant` (page/section) no `captureError`; teste cobre.
5. **FASE 2:** reset de senha do `CoachPanel` (coach) reporta `captureError(e,{area:'admin-reset-password'})`.
6. **Cobertura:** `src/store/networkErrors.test.ts` — authLogin/changePassword/listDevices/publishTeamRanges
   com fetch rejeitando → `{ok:false}` e `captureError` com a area certa.

### Padrão útil (replicável)
- Testar observabilidade: `vi.mock('../utils/sentry', () => ({ addBreadcrumb: vi.fn(), captureMessage: vi.fn(), captureError: vi.fn() }))`
  e asserir as chamadas. Helpers são no-op sem DSN, então o mock é a forma de verificar o payload.
- jsdom: para forçar erro de `localStorage.setItem`, use `vi.spyOn(Storage.prototype, 'setItem')` (atribuição direta não pega).

### PRÓXIMA FATIA
Aguardar decisão do Daniel na **issue #17**. Se ele escolher antes do run: começar a opção escolhida
(responsividade = mudanças aditivas `sm:`/`md:` + teste de render por fatia; validar no preview Cloudflare).
Sem decisão: cobertura incremental de testes/a11y sem abrir epic novo.

---

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
