# Pre-Flop Pro — Guia do Projeto

## Stack
- **Vite + React + TypeScript + Tailwind CSS + Zustand**
- Sem backend. Dados persistidos via `localStorage` manualmente (exceto `darkMode` que usa `zustand/persist`).
- Deploy: GitHub Pages via GitHub Actions ao fazer push para `main` (`https://github.com/danielluizdl/pre-flop-pro`)

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
  utils/          hands.ts     (ALL_HANDS, makeEmptyGrid, getRngCorrectAction, getTopFrequencyActions, stackMatchesRange, generateSuits)
  data/           defaultRanges.ts  (ranges nativos, seed no localStorage)
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
interface HandHistoryEntry { id:number; hand:string; suits:[string,string]; actionTaken:string; correctAction:string; rng:number; correct:boolean; rangeName:string; raiseSize?:number|string }
interface SessionStats     { hands:number; correct:number; errors:number; consults:number }
interface TrainingSession  { id:number; timestamp:number; rangeNames:string[]; tableSize:number; hands:number; correct:number; errors:number; consults:number; durationSeconds:number }

SEAT_ROLE_LABELS: Record<RoleType, string>  // labels PT-BR para selects
POS_6MAX / POS_8MAX: PokerPosition[]         // {id, label}
SLOTS_6MAX / SLOTS_8MAX: Slot[]              // {t:%, l:%} posição visual dos assentos
```

## LocalStorage Keys
```
'fbr-ranges-v1'           → Range[]          (ranges salvos)
'fbr-training-history-v1' → TrainingSession[] (histórico de sessões)
'pfp-hand-perf-v1'        → HandPerfMap       (Record<rangeId, Record<hand, {c,t}>>) — acumulativo
'fbr-ui-state'            → {darkMode}        (zustand persist)
```

## Ranges Nativos (`src/data/defaultRanges.ts`)
- Ranges nativos definidos com helper `const g = (hands) => ({ ...makeEmptyGrid(), ...hands })`
- Seed no `loadRanges()` do store: injeta ranges com IDs ausentes sem sobrescrever os do usuário
- Versionamento via `ADMIN_VERSION`: ao publicar nova versão, sobrescreve ranges admin preservando os do usuário
- Para atualizar: exportar `localStorage.getItem('fbr-ranges-v1')` do browser → processar com PowerShell → substituir o arquivo

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

### DrillSummary
- Props: `onClose: () => void` (chama stopDrill + fecha), `onBack?: () => void` (volta ao drill sem encerrar)
- Botão "← Voltar ao treino" só aparece quando `onBack` é definido (drill ainda ativo)
- Stats do topo: lê `sessionStats` do store (sessão atual, não acumulativo)
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
