# Pre-Flop Pro — Guia do Projeto

## Stack
- **Vite + React + TypeScript + Tailwind CSS + Zustand**
- Sem backend. Dados persistidos via `localStorage` manualmente (exceto `darkMode` que usa `zustand/persist`).
- Deploy: GitHub Pages via GitHub Actions ao fazer push para `main` (`https://github.com/danielluizdl/pre-flop-pro`)
- Testes: **Vitest** (`npm test` → `vitest run`), ambiente jsdom. Specs em `src/**/*.test.ts` e `worker/**/*.test.js` (ver `vitest.config.ts`).
- Bundle: `adminRanges.json` (1.4MB) é separado em chunk próprio via `manualChunks` (`vite.config.ts`). Chunk principal ~480KB.

## Estrutura de Pastas
```
src/
  components/
    Layout/       AppLayout.tsx, Sidebar.tsx, Dashboard.tsx
    RangeBuilder/ RangeEditorPage.tsx, RangeSetupPage.tsx, HandMatrix.tsx, BrushControls.tsx
    TableEditor/  TableEditorPage.tsx
    Trainer/      TrainerPage.tsx
    Situations/   SituationsPage.tsx
    Stats/        StatsPage.tsx
    ui/           PokerTableEditor.tsx, HandQuickSelect.tsx, RangePreviewModal.tsx
  store/          useStore.ts  (toda a lógica de estado)
  types/          index.ts     (tipos, constantes de posições/slots)
  utils/          hands.ts     (ALL_HANDS, makeEmptyGrid, getRngCorrectAction, getRngBands, formatRngBands, getTopFrequencyActions, stackMatchesRange, generateSuits, focusWeight, weightedPick)
                  validateRanges.ts (validateRanges(Range[]) → string[] de problemas legíveis)
                  sparseGrid.ts (encodeSparse/decodeSparse + encodeRange/decodeRange/encodeRanges/decodeRanges)
                  hash.ts (djb2 → hash compacto base36)
                  download.ts (downloadText, backupFilename)
  components/Layout/ ErrorBoundary.tsx (class component global)
  components/Admin/  AdminPanel.tsx (publicação de ranges)
  data/           defaultRanges.ts  (ranges nativos, seed no localStorage)
  worker/         index.js (Cloudflare Worker; deploy manual) + index.test.js
```

## Tipos Principais (`src/types/index.ts`)
```ts
type RoleType   = 'fold'|'post'|'limp'|'limp-fold'|'open'|'3bet'|'iso'|'call'|'allin'
type TableSize  = 6 | 8
type Page       = 'dashboard'|'editor'|'table-editor'|'ranges'|'drill'|'history'|'range-setup'
type ActionType = 'fold'|'call'|'raise'|'allin'

interface HandData         { fold:number; call:number; raise:number; allin:number; extra?:number; size?:number|string }
interface PositionConfig   { role:RoleType; bet:number; isHero:boolean; stack:number }
interface Scenario         { id:number; data:Record<string,PositionConfig>; pot:string; ante:number; summary:string; heroRaiseSize?:number }
interface Range            { id:number; name:string; positions:string[]; grid:Record<string,HandData>; scenarios:Scenario[]; tableSize:TableSize; customAction?:{label:string;color:string}; stackRange?:string; stackGrids?:StackGrid[]; prereqRangeId?:number }
interface StackGrid        { stackRange:string; grid:Record<string,HandData>; name?:string }
interface BrushState       { call:number; raise:number; allin:number; extra:number; raiseSize:string; extraLabel:string; extraColor:string }
interface HandHistoryEntry { id:number; hand:string; suits:[string,string]; actionTaken:string; correctAction:string; rng:number; correct:boolean; rangeName:string; rangeId:number; stackGridIdx:number; raiseSize?:number|string; stackRange?:string; severity?:'grave'|'impreciso' }
interface SessionStats     { hands:number; correct:number; errors:number; consults:number }
interface TrainingSession  { id:number; timestamp:number; rangeNames:string[]; tableSize:number; hands:number; correct:number; errors:number; consults:number; durationSeconds:number }

SEAT_ROLE_LABELS: Record<RoleType, string>  // labels PT-BR para selects
POS_6MAX / POS_8MAX: PokerPosition[]         // {id, label}
SLOTS_6MAX / SLOTS_8MAX: Slot[]              // {t:%, l:%} posição visual dos assentos
```

## LocalStorage Keys
```
'fbr-ranges-v1'           → Range[]          (ranges salvos — gravados em FORMATO ESPARSO)
'fbr-training-history-v1' → TrainingSession[] (histórico de sessões)
'pfp-hand-perf-v1'        → HandPerfMap       (Record<rangeId, Record<hand, {c,t}>>) — acumulativo
'fbr-ui-state'            → {darkMode}        (zustand persist)
'pfp-last-published-hash' → string           (hash djb2 do último publish — antes guardava o JSON inteiro)
'admin-ranges-version' / 'fbr-deleted-admin-ids' / 'admin-worker-url'
```

## Formato Esparso de Grids (`src/utils/sparseGrid.ts`)
- `encodeSparse(grid)` guarda só as mãos jogáveis (`fold < 100`); `decodeSparse(grid)` expande a partir de `makeEmptyGrid`.
- **Compat retroativa automática**: `decodeSparse` lê tanto o formato esparso novo quanto o denso antigo (overlay reproduz o denso intacto).
- `saveRanges` grava esparso (alivia cota); `loadRanges`/seed/`importData`/`adminSaveRanges` decodificam/codificam. **Estado em memória é sempre denso (169 mãos)** — o resto do app não muda.
- `adminRanges.json` segue denso até o próximo publish, que o encolhe (worker recebe esparso).

## Robustez / Backup
- **ErrorBoundary** (`src/components/Layout/ErrorBoundary.tsx`) envolve o app em `main.tsx`: em erro de render mostra a mensagem, botão Recarregar e botão "Exportar backup e resetar dados locais" (download do backup + dupla confirmação → limpa chaves `fbr-*`/`pfp-*` e recarrega).
- **Cota de localStorage**: `saveRanges`/`saveHistory`/`saveHandPerf` passam por `trySave` (try/catch). Falha seta `storageBlocked` no store (via `storageErrorReporter`) e exibe banner persistente no topo (`AppLayout`). Save bem-sucedido limpa o aviso.
- **Backup** (Dashboard): `exportData()` baixa JSON `{ version, ranges, trainingHistory, handPerformance }`; `importData(json)` valida com `validateRanges` e **substitui** (com confirmação). `resetLocalData()` limpa chaves `fbr-*`/`pfp-*`.

## Worker de Admin (`worker/index.js`) — segurança
- Arquivo único (deploy manual copiando para o Cloudflare). Funções puras exportadas e testadas em `worker/index.test.js`.
- **CORS** (`corsOrigin`): ecoa a Origin só se estiver na allowlist (`danielluizdl.github.io`, `localhost:5173`).
- **Senha** (`passwordMatches`): compara digests SHA-256 byte a byte (constant-time), sem early-return.
- **Rate limit** (`checkRateLimit`): Map em memória por `CF-Connecting-IP`, 5 tentativas/min → 429. Best-effort (reseta por isolate; complementar com WAF).
- **Token de sessão** (`generateToken`/`verifyToken`): action `validate` com senha correta retorna `{ ok, token, expiresAt }`, token = HMAC-SHA256 (chave = `ADMIN_PASSWORD`, exp 30 min). Publish aceita `Authorization: Bearer <token>` OU senha no body.
- Front: `login` guarda `adminToken` **em memória** (não persistido); `AdminPanel` publica via Bearer sem redigitar senha enquanto vale; 401 por expiração (`token_expired`) pede senha de novo.

## Backend de Nuvem — Auth + Telemetria + Painel Coach (`functions/api/`)
Cloudflare **Pages Functions** (serverless, cada arquivo exporta `onRequest(context)`) + **D1** (binding `DB`, banco `preflop-db`). Config em `wrangler.toml`. Schema em `schema.sql` (base) e `schema_v2.sql` (migração aditiva: `session_uuid`, `client_event_id`, índices/dedupe). **Deploy automático**: push na branch → Cloudflare Pages builda (preview por branch em `<branch>.pre-flop-pro.pages.dev`; produção em `pre-flop-pro.pages.dev` a partir de `main`).

- **Secrets por ambiente** (Production e Preview separados no dashboard): `TEAM_CODE` (gate de cadastro), `SESSION_SECRET`. Faltando → signup retorna 500 explícito.
- **Helpers** `functions/api/_utils.js`: `sha256Hex`, `hashPassword` (`SHA-256(salt + ':' + senha)`), `randomHex`, `getAuthUser` (deriva user do `Authorization: Bearer` via `sessions.token_hash`), `emailDomainExists` (DNS sobre HTTPS, fail-open), `isHand`/`isUuidOrNull`/`isShortStr`, `json`, `CORS_HEADERS`, `handleOptions`.
- **Auth** (`functions/api/auth/`): `signup` (valida TEAM_CODE, username≥6, senha≥8, e-mail regex+DNS, unicidade), `login`, `me`, `logout`, `change-password` (senha≥8). Tabela `users` (role `player`|`coach`, `first_login`, `name`, `email`); `sessions` (token_hash, expira 30 dias).
- **Telemetria** (`functions/api/events/`): `hand`, `consult`, `session-end`. `user_id` SEMPRE do token (nunca do body); sem auth respondem 200 `{ok:false, code:'unauthenticated'}`. `hand` valida payload e usa `INSERT OR IGNORE` (dedupe por `client_event_id`). Tabelas `hand_events`, `consult_events`, `training_sessions`.
- **Analytics do coach** (`functions/api/admin/analytics.js`, coach-only 401/403) — query `?view=`:
  - `team-overview` (por jogador + linha TIME), `leaks` (mãos mais erradas, ≥5 tentativas), `consult-hotspots`, `by-range`, `range-grid` (por mão de UM range: total/acertos/graves/consultas + ação correta predominante + ação errada mais comum).
  - Filtros: `playerIds` (CSV, multi-jogador), `rangeId`, `days` (1..365), `stackGridIdx` (no range-grid). Agrupam por `range_id` com `MAX(range_name)` para nunca duplicar range com nomes divergentes.
  - `functions/api/admin/users.js` e `admin/user/[id].js` (tabs hands/consults/sessions por jogador). Import paths: `events/*` e `admin/*` usam `../_utils.js`; `admin/user/*` usa `../../_utils.js`.
- **Stats do jogador** (`functions/api/me/stats.js`, requer auth): `?view=` overview/by-range/by-hand/sessions, sempre `WHERE user_id = <token>`.

### Frontend de nuvem
- **Store** (`useStore`): `currentUser` (`CurrentUser`), `authToken` (sessionStorage `pfp-auth-token`), ações `authLogin`/`authSignup`/`authLogout`/`changePassword`/`restoreSession` (chamada em `main.tsx` antes do render). `userMode` derivado (`coach`→`'admin'`) para compat com `AdminPanel`. Telemetria via `fireEvent()` → fila `src/utils/eventQueue.ts` (localStorage `pfp-event-queue`, cap 500, retry, descarte em 400, flush no login/restore). `startDrillSession` gera `session_uuid`; cada evento `hand` envia `client_event_id`.
- **LoginPage** (porta única: login/signup/forgot; sem gate admin/visitante), **WelcomeModal** (boas-vindas no `first_login`, substitui o antigo force-change-password), **ChangePasswordModal** (ainda existe, usado no fluxo de senha temporária).
- **CoachPanel** (`src/components/Admin/CoachPanel.tsx`, rota `page==='admin'`, botão "Painel Coach" no TopNav para coach): abas "Visão do time" e "Por jogador". Visão do time: filtros (multi-jogador com checkboxes em ordem alfabética via `MultiPlayerSelect`; range agrupado por posição via `groupRangesByPosition`/`POSITION_ORDER`; período), **matriz 13×13 no topo** (`RangeHeatGrid.tsx`: métricas Precisão/Graves/Consultas/Volume + tooltip de confusão; chips de stack efetivo quando o range tem `stackGrids.length>1`), e caixas **colapsáveis** (default minimizadas) Resumo/Leaks/Hotspots/Por range (clicáveis para selecionar o range).
- **MyAccountStats** (`src/components/Stats/MyAccountStats.tsx`): "Meus dados na nuvem" na StatsPage.

### Dados demo / utilitários
- Contas demo: `demo_01`..`demo_15`, senha `demo1234`, role player. Limpeza: `DELETE FROM users WHERE username LIKE 'demo\_%' ESCAPE '\'` (CASCADE apaga eventos). Conta coach: `admin001`.
- Geradores de seed ficam em `scripts/` (**gitignored**, não vão pro repo): `seedFake.cjs` (geral), `seedFakeRfi.cjs` (RFI >5k/range + multi-stack, realismo via grid real — mãos mistas erram mais). Migração de schema é manual: `npx wrangler d1 execute preflop-db --file=schema_v2.sql --remote`.

## Ranges Nativos (`src/data/defaultRanges.ts`)
- Ranges nativos definidos com helper `const g = (hands) => ({ ...makeEmptyGrid(), ...hands })`
- Seed no `loadRanges()` do store: injeta ranges com IDs ausentes sem sobrescrever os do usuário
- Versionamento via `ADMIN_VERSION`: ao publicar nova versão, sobrescreve ranges admin preservando os do usuário
- Para atualizar: exportar `localStorage.getItem('fbr-ranges-v1')` do browser → processar com PowerShell → substituir o arquivo
- `validateRanges` roda em `loadRanges` (apenas `console.warn`) e no `AdminPanel` antes de publicar (lista problemas e bloqueia até marcar "Publicar mesmo assim")

## Store (`src/store/useStore.ts`) — Estado Principal
Estado relevante (não persistido entre sessões, exceto darkMode):
- `page` — navegação atual
- `ranges` — carregado do localStorage na inicialização (com seed de DEFAULT_RANGES)
- `rangeData` — range sendo editado (`{id,name,grid,positions,tableSize,stackRange,prereqRangeId?}`)
- `selectedEditorPositions` — posição do HERO selecionada no EditorPage (**single-select**)
- `brush` — `{call,raise,allin,extra,raiseSize,extraLabel,extraColor}` — pincel para HandMatrix
- `currentScenario` — `Record<posId, PositionConfig>` — cenário sendo configurado
- `tempScenarios` — cenários salvos no buffer antes de finalizar o range
- `currentHeroRaiseSize` — raise size do HERO para o cenário
- `currentHasStraddle` — se mesa 8-max tem straddle obrigatório
- `currentAnte` / `currentTableSize` / `activePositions` / `activeSlots`
- `activeDrillRange` / `activeDrillStackRange` / `activeDrillStackGridIdx`
- `activeHand` / `sessionStats` / `handHistory` / `currentRng`
- `correctActionForCurrentHand` / `correctActionsForCurrentHand` / `currentHandSuits`
- `useRngForFrequency` — true=RNG, false=ação de maior frequência
- `acceptAnyFreq` — (RNG off) aceita qualquer ação com frequência > 0 como acerto (feedback "Válido — ação principal: ...")
- `focusErrors` — (D1) liga amostragem ponderada do nível 2 do `nextDrillHand` (mão dentro do range) por `handPerformance`: peso `3` para mãos nunca treinadas, `1 + 4*(1 - acerto)` para treinadas. Nível 1 (entre ranges) segue uniforme. Desligado (default) = sorteio uniforme atual intacto.
- `sessionSeverity: { grave, impreciso }` — (D2) contadores da sessão; reset em `startDrillSession`, incrementado em `checkDrillAnswer`. `DrillSummary` exibe as contagens.
- `sessionHandPerf: HandPerfMap` — acumulador por id da sessão atual (fora do `handHistory`, que tem cap de 50). `stopDrill`/`DrillSummary` usam ele para stats por range; `TrainingSession.handPerf` é gravado por id (leitura com fallback por nome para sessões antigas)
- `handPerformance: HandPerfMap` — carregado do localStorage na inicialização
- `selectedDrillRangeIds` / `drillExcludedHands`
- `trainingHistory: TrainingSession[]` — carregado do localStorage
- `sessionStartTime: number` — timestamp de início da sessão atual

**`toggleEditorPosition(label)`** — single-select: clica na posição selecionada → deseleciona; clica em outra → troca. `selectedEditorPositions` sempre tem 0 ou 1 elemento. Ranges armazenam `positions` como array de **labels** (ex: `["STR"]`, `["BTN"]`), não ids.

**`updateRole(pid, role)`** — ao setar `fold` em SB/BB/STR, mantém a aposta do blind (0.5/1.0/2.0) para chips continuarem na mesa.

**`stopDrill()`** — salva sessão em `trainingHistory` (se `sessionStats.hands > 0`), limpa `activeDrillRange`. NÃO limpa `sessionStats` nem `handHistory` (disponíveis para DrillSummary após encerrar).

## Fluxo de Navegação
```
dashboard
  → range-setup   (RangeSetupPage: tableSize, straddle, ante — defaults: 8-max, sim, sim)
      → editor     (RangeEditorPage: Posição do HERO + Nome + pintar HandMatrix)
          → table-editor  (TableEditorPage: configurar roles/bets/stacks + cenários)
              → ranges     (após finalizeRange())
  → ranges        (SituationsPage: acordeão por posição com RangeCards)
  → drill         (TrainerPage: DrillRangeSelect → HandFilterGrid → DrillActive)
  → history       (StatsPage)
```

**Ações de navegação chave no store:**
- `setupNewRange(size, hasStraddle, ante)` → inicializa tudo e vai para `'editor'`
- `loadRangeForEdit(id)` → carrega range existente e vai para `'editor'`
- `finalizeRange()` → salva range no localStorage e vai para `'ranges'`
- `initTableConfig()` → popula `currentScenario` com todos os `activePositions` (roles defaults: post para SB/BB/STR, fold para o resto, stack padrão 250bb)
- `handleNext()` em RangeEditorPage chama `initTableConfig()` + `setPage('table-editor')`

## RangeSetupPage (`src/components/RangeBuilder/RangeSetupPage.tsx`)
- Defaults: 8-max, straddle sim, ante sim (0.5bb)
- Straddle só disponível para 8-max

## RangeEditorPage (`src/components/RangeBuilder/RangeEditorPage.tsx`)
- Label "Posição do HERO" (single-select) — apenas uma posição pode ser selecionada
- Campo "Nome:" fica **abaixo** dos botões de posição, com `max-w-xs`
- Layout: título → posições → nome → HandMatrix (esquerda) + BrushControls (direita)
- Picker de pré-requisito: abre modal com lista de ranges existentes; armazenado em `rangeData.prereqRangeId`

## HandMatrix (`src/components/RangeBuilder/HandMatrix.tsx`)
- Grid 13×13 de mãos (169 células)
- Props: `readOnly?`, `grid?` (externo ou do store), `heatmap?: Record<hand, {c,t}>`, `forceViewMode?`
- Clique em célula vazia → `applyBrush()`. Clique em célula preenchida → `clearHand()`
- Quando `heatmap` prop fornecido: toggle **"Ações" / "Erro / Acerto"** (default: "Erro / Acerto")
  - Modo "Ações": gradient de frequências (allin=roxo, raise=vermelho, call=verde)
  - Modo "Erro / Acerto": cores de precisão (verde ≥80%, amarelo 50-79%, vermelho <50%, azul-acinzentado=não treinado)
- Tooltip no modo "Erro / Acerto": `x/y w%` em posição `fixed` seguindo o cursor
- `showWarning` quando brush total >100%

## BrushControls (`src/components/RangeBuilder/BrushControls.tsx`)
- Controla `brush.call`, `brush.raise`, `brush.allin`, `brush.raiseSize`
- Preset buttons: 0%, 25%, 50%, 75%, 100%
- `setBrush` clampeia automaticamente para total ≤ 100%
- Fold é read-only = 100 - (call+raise+allin)

## TableEditorPage (`src/components/TableEditor/TableEditorPage.tsx`)
- Grid colunas: `'20px 44px 1fr 56px 56px'` (H / Pos / Ação / Stack / Aposta)
- Select de Ação tem `w-full` (importante para funcionar em todos os browsers)
- Global stack setter: botões 100bb / 250bb + input customizado
- Sub-row HERO: input para `currentHeroRaiseSize` — se 0, botão RAISE não aparece no drill
- `getStackLabel()`: "250bb" se todos iguais, "* 120bb" se um outlier
- Clicar em cenário salvo carrega + destaca verde; botão "Salvar alterações no #X" confirma edição
- `PokerTableEditor` dentro de wrapper `maxWidth: 575px`, padding `px-10 pt-8 pb-16`

## SituationsPage (`src/components/Situations/SituationsPage.tsx`)
- Acordeão por posição (ordem: STR, BB, SB, BTN, CO, HJ, MP, EP, LJ, UTG, demais alfabético)
- Cada caixa: header com nome da posição + count → expande mostrando RangeCards em grid
- `RangeCard`: nome, mãos não-fold, cenários, accuracy% de treino; botões Treinar/Editar/Heatmap/Deletar
- Botão "+ Novo Range" no cabeçalho da página
- Modal heatmap: `fixed inset-0 z-50`, HandMatrix com toggle Ações/Erro-Acerto + botão resetar dados

## TrainerPage (`src/components/Trainer/TrainerPage.tsx`)

### Render order no TrainerPage
```tsx
if (showHistory)      → <HistoryModal>
if (showSummary)      → <DrillSummary>        // stopDrill() chamado ao fechar
if (activeDrillRange) → <DrillActive>
else                  → <DrillRangeSelect>
```
- `showSummary` é mostrado ANTES de verificar `activeDrillRange` — permite "Voltar ao treino" sem perder estado
- `stopDrill()` só é chamado ao clicar "Encerrar" no DrillSummary, não ao abrir o resumo

### DrillRangeSelect
- Acordeão por posição idêntico ao SituationsPage
- `POSITION_ORDER = ['STR','BB','SB','BTN','CO','HJ','MP','EP','LJ','UTG']`
- Badge mostra quantos ranges selecionados por grupo
- "CONTINUAR →" → step 'filter' (HandFilterGrid) sem modificar `drillExcludedHands`
- HandFilterGrid → "INICIAR TREINO" → `startDrillSession()` + `nextDrillHand()`

### HandFilterGrid
- Mostra grid 13×13 com todas as 169 mãos
- Usuário exclui manualmente as mãos que não quer treinar
- **Nunca é modificado automaticamente** ao selecionar ranges
- Só se aplica a ranges SEM `prereqRangeId` (ver lógica de `nextDrillHand` abaixo)

### nextDrillHand — Lógica de candidatos
```
Para cada range selecionado, por cenário:
  Se range TEM prereqRangeId (e prereq encontrado):
    → candidatos = ALL_HANDS onde prereqGrid[h].fold < 100
    → drillExcludedHands é IGNORADO
  Se range NÃO TEM prereqRangeId (ou prereq não encontrado):
    → candidatos = ALL_HANDS onde !drillExcludedHands.includes(h)
    → sem filtro de fold — mãos fold=100 aparecem (resposta correta = Fold)
  A ação correta sempre vem de activeGrid[hand] (nunca do prereqGrid)
```
- Cenário-first: resolve stackGrid baseado no heroStack do cenário antes de filtrar mãos
- `correctAction` calculado de `activeGrid[hand]` via `getRngCorrectAction` ou `getTopFrequencyActions`
- `getRngCorrectAction` ordena as faixas por agressividade: **Allin > Raise > Call > extra > Fold** (ex: 20% allin/50% raise/30% fold → 1–20 Allin, 21–70 Raise, 71–100 Fold). Com prereq, `drillExcludedHands` é ignorado ao montar candidatos.

### DrillActive — Layout
Container: `w-full h-[calc(100vh-90px)] overflow-auto`

**Coluna esquerda (flex-1 flex flex-col gap-2):**
- Dark box (rounded-2xl, background #030712):
  - Linha de topo: RNG badge (esquerda) + botões "Erro/Acerto" e "Ver Range" (direita)
  - Mesa: `flex justify-center px-10 pt-1 pb-[60px]` → `PokerTableEditor heroCards={{r1,s1,r2,s2}}`
  - Cartas do hero renderizadas **dentro** do PokerTableEditor, à direita do círculo do hero
  - Feedback: `min-h-[56px] flex flex-col justify-center text-center px-4 py-2`
  - Botões de ação: FOLD/CALL/RAISE(se heroRaiseSize>0)/ALL IN — `px-5 py-2.5 text-sm`
  - Navegação: Próxima Mão / 2s (auto-advance com barra de progresso) / ← Anterior

**Coluna direita (`sticky top-0 self-start h-[calc(100vh-90px)]`):**
- `HandHistorySidebar` com scroll interno, título clicável → abre HistoryModal
- Stats box: nome range, stackRange badge, grid 2 colunas (Mãos/Acertos/Erros/Consultas)
- Botões: "Encerrar Treino" (chama stopDrill) / "Encerrar e ver resumo" (só chama onShowSummary)
- Sidebar colapsável (botão ‹ / HIST ›)

### DrillActive — Comportamento
- `goNextRef` pattern para auto-advance estável em useEffect
- `PrevSnapshot` salva estado da mão anterior (hand, suits, rng, feedback, freqLabel)
- `viewingPrev` exibe snapshot anterior sem avançar; "← Mão atual" volta
- `getFreqLabel()` formata "75% Raise e 25% Call"
- **Atalhos de teclado (D3)** via `keyHandlerRef` (mesmo pattern do `goNextRef`, listener montado uma vez): `F`=Fold, `C`=Call, `R`=Raise (se visível), `A`=All-in, inicial do `customAction` (resolvida por `pickHotkey` evitando colisão com F/C/R/A), `Espaço`=próxima, `ArrowLeft`=anterior, `V`=abre/fecha Ver Range. Ignorados com foco em input/select/textarea ou modal aberto (exceto V para fechar). Legenda discreta da tecla em cada `DrillActionButton`.

### checkDrillAnswer — severidade (D2)
- Erro `grave` = ação respondida tem 0% na mão; `impreciso` = freq > 0 mas não é a principal (só com `acceptAnyFreq` desligado).
- Feedback: `✗ Erro grave — Call tinha 0%. Correto: Raise` / `✗ Impreciso — Call tinha 25%. Principal: Raise 75%`.
- Retorna `{ correct, message, severity? }`; grava `severity` no `HandHistoryEntry` e incrementa `sessionSeverity`.

### DrillSummary
- Props: `onClose: () => void` (chama stopDrill + fecha), `onBack?: () => void` (volta ao drill sem encerrar)
- Botão "← Voltar ao treino" só aparece quando `onBack` é definido (drill ainda ativo)
- Stats do topo: lê `sessionStats` do store (sessão atual, não acumulativo)
- Linha extra com contagem de **erros graves** e **imprecisos** (`sessionSeverity`) quando há erros
- Stats por range: computados de `handHistory` (entries têm `rangeName`) — sessão atual
- Heatmap por range: usa `handPerformance` (acumulativo histórico — correto por design)

### HistoryModal
- Sub-componente `SessionDetail` com estado próprio (`openRangeId`, `viewMode`)
- Cada sessão: clicável → expande `SessionDetail`
- `SessionDetail`: stats box (Mãos/Acertos/Erros/Precisão da sessão) + acordeão por range com heatmap
- Heatmap usa `handPerformance` acumulativo (sessões passadas não têm dados por mão)

## PokerTableEditor (`src/components/ui/PokerTableEditor.tsx`)
- Assentos: `w-[55px] h-[55px]` — 15% maior que original
- Exported: `HeroCards` interface `{ r1, s1, r2, s2 }` e componente `PokerTableEditor`
- Prop `heroCards?: HeroCards` — renderiza `SmallCard` pares à direita do círculo do hero via `activeSlots[0]`
- `SmallCard`: `width:38, height:56`, fundo por naipe (`SUIT_BG`), ícone naipe (`SUIT_ICON`)
- Cartas posicionadas com `transform: 'translate(32px, -50%)'` a partir do slot do hero
- Seat badge de stack: apenas número bb (`text-[11.5px]` azul), sem nome da posição
- Villain mini cards: `w-3.5 h-[18px]` em `top-[39px]`
- `BLIND_BET` fallback: SB/BB/STR fold mostram fichas dos blinds mesmo com `bet=0`
- Assentos em `l:0%`/`l:100%` vazam lateralmente — container precisa de `px-10` mínimo
- Stack badge vaza 28px abaixo — wrapper precisa de `pb-8` mínimo (ou `pb-[60px]` no drill)

## StatsPage (`src/components/Stats/StatsPage.tsx`)
- Lista sessões em ordem reversa com `SessionCard`
- `SessionCard`: accuracy%, data, tableSize, duração, range names, mãos/acertos/erros + botão olhinho
- Botão olhinho → `setSelectedSession(session)` → renderiza `SessionDetailView`
- `SessionDetailView`: cabeçalho com "← Voltar", stats box idêntico ao DrillSummary, acordeão por range com heatmap
- **`AccuracySparkline` (D4)**: SVG inline (sem biblioteca) com accuracy % por sessão em ordem cronológica (`trainingHistory`), escala fixa 0–100, linha de referência tracejada em 80% e tooltip (data + %) ao passar o mouse nos pontos. Some com menos de 2 sessões.

## Convenções e Padrões
- **Sem comentários** no código (exceto WHY não-óbvios)
- **Sem features extras** além do solicitado
- **Tailwind** para todo styling; sem CSS modules ou styled-components
- Validação apenas nas bordas (inputs de usuário); confiar no estado interno
- `useStore(s => s.ação)` para selecionar ações; `useStore.setState({})` para updates diretos pontuais
- Nunca criar arquivos `.md` além deste, a menos que explicitamente pedido

## Bugs Conhecidos / Gotchas
- `{0 && <span>}` em React renderiza literal `0` — usar `{!!valor && <span>}`
- `setBrush` deve sempre fazer `set({ brush: { ...brush, call:c, raise:r, allin:a } })` com os 3 campos
- Assentos do PokerTableEditor têm `z-10/z-20` e podem vazar — `pointer-events-none` no wrapper quando puramente visual
- `<select>` em CSS Grid pode não esticar em Safari sem `w-full` explícito
- Badge de stack vaza 28px abaixo — wrapper precisa de `pb-8` mínimo
- `stopDrill()` NÃO limpa `sessionStats`/`handHistory` — DrillSummary depende disso após encerrar
- `handPerformance` é acumulativo (all-time). Para stats da sessão atual usar `sessionStats` + `handHistory`
- Sub-componentes com estado próprio (ex: SessionDetail) evitam conflito de viewMode entre sessões no accordion

## Preferências do Usuário (Daniel)
- Respostas em português
- Sem emojis
- Mensagens curtas e diretas
- Não precisa confirmar cada passo antes de executar
- Prefere commits separados por feature
