# Pre-Flop Pro — Guia do Projeto

## Stack
- **Vite + React + TypeScript + Tailwind CSS + Zustand**
- Sem backend. Dados persistidos via `localStorage` manualmente (exceto `darkMode` que usa `zustand/persist`).
- Deploy: GitHub Pages (`https://github.com/danielluizdl/pre-flop-pro`)

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
    ui/           PokerTableEditor.tsx, HandQuickSelect.tsx
  store/          useStore.ts  (toda a lógica de estado)
  types/          index.ts     (tipos, constantes de posições/slots)
  utils/          hands.ts     (ALL_HANDS, makeEmptyGrid, getRngCorrectAction, getHighestFrequencyAction, countNonFoldHands, generateSuits)
  data/           defaultRanges.ts  (41 ranges nativos, seed no localStorage)
```

## Tipos Principais (`src/types/index.ts`)
```ts
type RoleType   = 'fold'|'post'|'limp'|'open'|'3bet'|'iso'|'call'|'allin'
type TableSize  = 6 | 8
type Page       = 'dashboard'|'editor'|'table-editor'|'ranges'|'drill'|'history'|'range-setup'
type ActionType = 'fold'|'call'|'raise'|'allin'

interface HandData      { fold:number; call:number; raise:number; allin:number; size?:number|string }
interface PositionConfig{ role:RoleType; bet:number; isHero:boolean; stack:number }
interface Scenario      { id:number; data:Record<string,PositionConfig>; pot:string; ante:number; summary:string; heroRaiseSize?:number }
interface Range         { id:number; name:string; positions:string[]; grid:Record<string,HandData>; scenarios:Scenario[]; tableSize:TableSize }
interface BrushState    { call:number; raise:number; allin:number; raiseSize:string }
interface HandHistoryEntry { id:number; hand:string; suits:[string,string]; actionTaken:string; correctAction:string; rng:number; correct:boolean; rangeName:string; raiseSize?:number|string }

SEAT_ROLE_LABELS: Record<RoleType, string>  // labels PT-BR para selects
POS_6MAX / POS_8MAX: PokerPosition[]         // {id, label}
SLOTS_6MAX / SLOTS_8MAX: Slot[]              // {t:%, l:%} posição visual dos assentos
```

## LocalStorage Keys
```
'fbr-ranges-v1'           → Range[]     (ranges salvos)
'fbr-training-history-v1' → TrainingSession[]
'pfp-hand-perf-v1'        → HandPerfMap (Record<rangeId, Record<hand, {c,t}>>) heatmap
'fbr-ui-state'            → {darkMode}  (zustand persist)
```

## Ranges Nativos (`src/data/defaultRanges.ts`)
- 41 ranges nativos definidos com helper `const g = (hands) => ({ ...makeEmptyGrid(), ...hands })`
- Seed no `loadRanges()` do store: injeta ranges com IDs ausentes sem sobrescrever os do usuário
- Para atualizar: exportar `localStorage.getItem('fbr-ranges-v1')` do browser → processar com PowerShell → substituir o arquivo

## Store (`src/store/useStore.ts`) — Estado Principal
Estado relevante (não persistido entre sessões, exceto darkMode):
- `page` — navegação atual
- `ranges` — carregado do localStorage na inicialização (com seed de DEFAULT_RANGES)
- `rangeData` — range sendo editado no momento (`{id,name,grid,positions,tableSize}`)
- `selectedEditorPositions` — posição do HERO selecionada no EditorPage (**single-select**)
- `brush` — `{call,raise,allin,raiseSize}` — pincel para HandMatrix
- `currentScenario` — `Record<posId, PositionConfig>` — cenário sendo configurado
- `tempScenarios` — cenários salvos no buffer antes de finalizar o range
- `currentHeroRaiseSize` — raise size do HERO para o cenário
- `currentHasStraddle` — se mesa 8-max tem straddle obrigatório
- `currentAnte` / `currentTableSize` / `activePositions` / `activeSlots`
- `activeDrillRange` / `activeHand` / `sessionStats` / `handHistory` / `currentRng`
- `correctActionForCurrentHand` / `currentHandSuits`
- `useRngForFrequency` — true=RNG, false=ação de maior frequência
- `handPerformance: HandPerfMap` — carregado do localStorage na inicialização
- `selectedDrillRangeIds` / `drillExcludedHands`

**`toggleEditorPosition(label)`** — single-select: clica na posição selecionada → deseleciona; clica em outra → troca. `selectedEditorPositions` sempre tem 0 ou 1 elemento. Ranges armazenam `positions` como array de **labels** (ex: `["STR"]`, `["BTN"]`), não ids.

**`updateRole(pid, role)`** — ao setar `fold` em SB/BB/STR, mantém a aposta do blind (0.5/1.0/2.0) para chips continuarem na mesa.

## Fluxo de Navegação
```
dashboard
  → range-setup   (RangeSetupPage: tableSize, straddle, ante — defaults: 8-max, sim, sim)
      → editor     (RangeEditorPage: Posição do HERO + Nome + pintar HandMatrix)
          → table-editor  (TableEditorPage: configurar roles/bets/stacks + cenários)
              → ranges     (após finalizeRange())
  → ranges        (SituationsPage: acordeão por posição com RangeCards)
  → drill         (TrainerPage: acordeão por posição → filtro de mãos → DrillActive)
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

## HandMatrix (`src/components/RangeBuilder/HandMatrix.tsx`)
- Grid 13×13 de mãos (169 células)
- Props: `readOnly?`, `grid?` (externo ou do store), `heatmap?: Record<hand, {c,t}>`
- Clique em célula vazia → `applyBrush()`. Clique em célula preenchida → `clearHand()`
- Quando `heatmap` prop é fornecido, exibe toggle **"Ações" / "Erro / Acerto"** acima da grade (default: "Erro / Acerto")
  - Modo "Ações": gradient de frequências (allin=roxo, raise=vermelho, call=verde)
  - Modo "Erro / Acerto": cores de precisão (verde ≥80%, amarelo 50-79%, vermelho <50%, azul-acinzentado=não treinado)
- Tooltip no modo "Erro / Acerto": `x/y w%` em posição `fixed` seguindo o cursor
- `showWarning` quando brush total >100%

## BrushControls (`src/components/RangeBuilder/BrushControls.tsx`)
- Controla `brush.call`, `brush.raise`, `brush.allin`, `brush.raiseSize`
- Preset buttons: 0%, 25%, 50%, 75%, 100%
- `setBrush` clampeia automaticamente para total ≤ 100%
- Fold é read-only = 100 - (call+raise+allin)

## HandQuickSelect (`src/components/ui/HandQuickSelect.tsx`)
- Botões "Pares", "Suiteds", "Offsuits" — quando `disabled`, usa `border-gray-700/50 bg-gray-800 text-gray-500` (sem `opacity-30`)

## TableEditorPage (`src/components/TableEditor/TableEditorPage.tsx`)
- Grid colunas: `'20px 44px 1fr 56px 56px'` (H / Pos / Ação / Stack / Aposta)
- Select de Ação tem `w-full` (importante para funcionar em todos os browsers)
- Global stack setter: botões 100bb / 250bb + input customizado
- Sub-row HERO: input para `currentHeroRaiseSize` — se 0, botão RAISE não aparece no drill
- `getStackLabel()`: "250bb" se todos iguais, "* 120bb" se um outlier
- Clicar em cenário salvo carrega + destaca verde; botão "Salvar alterações no #X" confirma edição
- `PokerTableEditor` dentro de wrapper `maxWidth:500px`, padding `px-10 pt-8 pb-16`

## SituationsPage (`src/components/Situations/SituationsPage.tsx`)
- Acordeão por posição (ordem: STR, BB, SB, BTN, CO, HJ, MP, EP, LJ, UTG, demais alfabético)
- Cada caixa: header com nome da posição + count → expande mostrando RangeCards em grid
- `RangeCard`: nome, mãos não-fold, cenários, accuracy% de treino; botões Treinar/Editar/Heatmap/Deletar
- Botão "+ Novo Range" no cabeçalho da página
- Modal heatmap: `fixed inset-0 z-50`, HandMatrix com toggle Ações/Erro-Acerto + botão resetar dados

## TrainerPage / Drill (`src/components/Trainer/TrainerPage.tsx`)
- Sidebar e título: "Drill" (antes "Treinar")

### DrillRangeSelect
- Acordeão por posição idêntico ao SituationsPage
- `POSITION_ORDER = ['STR','BB','SB','BTN','CO','HJ','MP','EP','LJ','UTG']`
- Badge mostra quantos ranges selecionados por grupo
- Contador total + botão "CONTINUAR →" → step 'filter' (HandFilterGrid) → INICIAR TREINO

### DrillActive — Layout
Container: `flex gap-3 h-[calc(100vh-90px)] overflow-hidden`

**Coluna esquerda (flex-1 flex flex-col gap-3 overflow-hidden):**
- Dark box (`flex-1 min-h-0 relative flex flex-col`):
  - Botão "Ver Range" `absolute top-3 right-3`
  - PokerTableEditor com `maxWidth: 'calc((100vh - 500px) / 0.63)'` — limita largura pela altura disponível para evitar scroll
  - Faixa de cartas (`flex-shrink-0 border-t`): RNG badge (w-20 espaçador esquerdo) + 2 cartas + w-20 espaçador direito (cartas sempre centralizadas)
- Resposta/feedback (`flex-shrink-0 min-h-[44px] text-center`)
- Botões de ação (`flex-shrink-0 flex gap-2 justify-center`): FOLD/CALL/RAISE/ALL IN com `px-7 py-3.5` fixo; RAISE só aparece quando `currentHeroRaiseSize > 0`
- Navegação (`flex-shrink-0 flex justify-center gap-2`): Próxima Mão / 2s (auto-advance) / ← Anterior (sempre visível, `disabled` quando sem mão anterior)

**Coluna direita (w-52 flex flex-col gap-2):**
- `HandHistorySidebar` (`flex-1 min-h-0`) — scroll interno
- Stats box (`flex-shrink-0`): nome do range, Mãos/Acertos/Erros/Consultas em grid 2 colunas, botão Encerrar Treino

### DrillActive — Comportamento
- `goNextRef` pattern para auto-advance estável em useEffect
- `PrevSnapshot` salva estado da mão anterior (hand, suits, rng, feedback, freqLabel)
- `viewingPrev` exibe snapshot anterior sem avançar; "← Mão atual" volta
- `getFreqLabel()` formata "75% Raise e 25% Call"

## PokerTableEditor (`src/components/ui/PokerTableEditor.tsx`)
- Assentos: `w-[48px] h-[48px] absolute z-10/z-20`
- Seat badge de stack: `absolute -bottom-7` — vaza 28px abaixo; container precisa de `pb-8` mínimo (ou `pb-16` para folga)
- Posição visual determinada por `activeSlots` (SLOTS_6MAX ou SLOTS_8MAX)
- Rotação: HERO sempre no slot 0; dealer button segue posição BTN após rotação
- Assentos em `l:0%`/`l:100%` vazam lateralmente — container precisa de `px-10` mínimo
- Sistema de fichas com denominações (100/25/5/2/1/0.5bb) em cores realistas, pilha única
- `BLIND_BET` fallback: SB/BB/STR fold mostram fichas dos blinds mesmo com `bet=0` (compatibilidade com cenários antigos)

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
- Badge de stack (`-bottom-7`) vaza 28px — wrapper precisa de `pb-8` mínimo para não clipar

## Preferências do Usuário (Daniel)
- Respostas em português
- Sem emojis
- Mensagens curtas e diretas
- Não precisa confirmar cada passo antes de executar
- Prefere commits separados por feature
