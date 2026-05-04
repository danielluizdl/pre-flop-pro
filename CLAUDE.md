# Pre-Flop Pro — Guia do Projeto

## Stack
- **Vite + React + TypeScript + Tailwind CSS + Zustand**
- Sem backend. Dados persistidos via `localStorage` manualmente (exceto `darkMode` que usa `zustand/persist`).
- Deploy: GitHub (`https://github.com/danielluizdl/pre-flop-pro`)

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
'fbr-ranges-v1'        → Range[]          (ranges salvos)
'fbr-training-history-v1' → TrainingSession[]
'pfp-hand-perf-v1'     → HandPerfMap      (Record<rangeId, Record<hand, {c,t}>>) heatmap
'fbr-ui-state'         → {darkMode}       (zustand persist)
```

## Store (`src/store/useStore.ts`) — Estado Principal
Estado relevante (não persistido entre sessões, exceto darkMode):
- `page` — navegação atual
- `ranges` — carregado do localStorage na inicialização
- `rangeData` — range sendo editado no momento (`{id,name,grid,positions,tableSize}`)
- `selectedEditorPositions` — posição do HERO selecionada no EditorPage (**single-select**)
- `brush` — `{call,raise,allin,raiseSize}` — pincel para HandMatrix
- `currentScenario` — `Record<posId, PositionConfig>` — cenário sendo configurado
- `tempScenarios` — cenários salvos no buffer antes de finalizar o range
- `currentHeroRaiseSize` — raise size do HERO para o cenário
- `currentHasStraddle` — se mesa 8-max tem straddle obrigatório
- `currentAnte` / `currentTableSize` / `activePositions` / `activeSlots`
- `activeDrillRange` / `activeHand` / `sessionStats` / `handHistory` / `currentRng`
- `correctActionForCurrentHand` / `currentHandSuits` / `currentHeroRaiseSize`
- `useRngForFrequency` — true=RNG, false=ação de maior frequência
- `handPerformance: HandPerfMap` — carregado do localStorage na inicialização
- `selectedDrillRangeIds` / `drillExcludedHands`

**`toggleEditorPosition(label)`** — single-select: clica na posição selecionada → deseleciona; clica em outra → troca. `selectedEditorPositions` sempre tem 0 ou 1 elemento. Ranges armazenam `positions` como array de **labels** (ex: `["STR"]`, `["BTN"]`), não ids.

## Fluxo de Navegação
```
dashboard
  → range-setup   (RangeSetupPage: 3 perguntas: tableSize, straddle, ante)
      → editor     (RangeEditorPage: Posição do HERO + Nome + pintar HandMatrix)
          → table-editor  (TableEditorPage: configurar roles/bets/stacks + cenários)
              → ranges     (após finalizeRange())
  → ranges        (SituationsPage: seleção de formato → mesa com posições → lista filtrada)
  → drill         (TrainerPage: selecionar ranges → filtro de mãos → treinar)
  → history       (StatsPage)
```

**Ações de navegação chave no store:**
- `setupNewRange(size, hasStraddle, ante)` → inicializa tudo e vai para `'editor'`
- `loadRangeForEdit(id)` → carrega range existente e vai para `'editor'`
- `finalizeRange()` → salva range no localStorage e vai para `'ranges'`
- `initTableConfig()` → popula `currentScenario` com todos os `activePositions` (roles defaults: post para SB/BB/STR, fold para o resto)
- `handleNext()` em RangeEditorPage chama `initTableConfig()` + `setPage('table-editor')`

## RangeEditorPage (`src/components/RangeBuilder/RangeEditorPage.tsx`)
- Label "Posição do HERO" (single-select) — apenas uma posição pode ser selecionada
- Campo "Nome:" fica **abaixo** dos botões de posição, com `max-w-xs`
- Layout: título → posições → nome → HandMatrix (esquerda) + BrushControls (direita)

## HandMatrix (`src/components/RangeBuilder/HandMatrix.tsx`)
- Grid 13×13 de mãos (169 células)
- Props: `readOnly?`, `grid?` (externo ou do store), `heatmap?: Record<hand, {c,t}>`
- Clique em célula vazia → `applyBrush()`. Clique em célula preenchida → `clearHand()`
- Quando `heatmap` prop é fornecido, exibe toggle **"Ações" / "Erro / Acerto"** acima da grade (default: "Erro / Acerto")
  - Modo "Ações": mostra gradient de frequências (allin=roxo, raise=vermelho, call=verde), sem overlay de acerto
  - Modo "Erro / Acerto": mostra só cores de precisão (verde ≥80%, amarelo 50-79%, vermelho <50%, azul-acinzentado=não treinado), sem gradient de ações
- Tooltip no modo "Erro / Acerto": ao passar o mouse sobre uma célula, mostra `x/y w%` (acertos/tentativas e %) em posição `fixed` seguindo o cursor
- `showWarning` quando brush total >100%

## BrushControls (`src/components/RangeBuilder/BrushControls.tsx`)
- Controla `brush.call`, `brush.raise`, `brush.allin`, `brush.raiseSize`
- Preset buttons: 0%, 25%, 50%, 75%, 100%
- `setBrush` clampeia automaticamente para total ≤ 100%
- Fold é read-only = 100 - (call+raise+allin)

## HandQuickSelect (`src/components/ui/HandQuickSelect.tsx`)
- Botões "Pares", "Suiteds", "Offsuits" — quando `disabled`, usa `border-gray-700/50 bg-gray-800 text-gray-500` (sem `opacity-30` que tornava o texto ilegível)

## TableEditorPage (`src/components/TableEditor/TableEditorPage.tsx`)
- Grid colunas: `'20px 44px 1fr 56px 56px'` (H / Pos / Ação / Stack / Aposta)
- Select de Ação tem `w-full` (importante para funcionar em todos os browsers)
- Global stack setter: botões 100bb / 250bb + input customizado
- Sub-row HERO: aparece quando `data.isHero=true`, input para `currentHeroRaiseSize`
- `PokerTableEditor` dentro de wrapper `maxWidth:500px`, padding `px-10 pt-8 pb-16` para conter badges de stack e assentos nas bordas
- **IMPORTANTE**: PokerTableEditor neste contexto é puramente visual

## SituationsPage (`src/components/Situations/SituationsPage.tsx`)
- Fluxo em 2 steps: `'select'` → `'list'`
- Step `'select'`: dois botões (6-max / 8-max); ao clicar em um, aparece abaixo a mesa de poker com os assentos como botões toggle ("Selecione uma ou mais posições para o HERO."); botão OK habilitado só com ≥1 posição selecionada
  - Mesa usa mesmo visual do PokerTableEditor (elipse verde, SLOTS_6MAX/SLOTS_8MAX)
  - Clicar no outro formato de mesa troca a mesa e limpa seleção
  - Posições armazenadas como **labels** (ex: "STR", "BTN") para bater com `r.positions`
- Step `'list'`: ranges filtrados por `tableSize` + `positions.some(p => selectedPos.includes(p))`
- `RangeCard`: botões Treinar/Editar/Heatmap/Deletar; mostra accuracy% se tiver dados de treino
- Modal heatmap: `fixed inset-0 z-50`, usa HandMatrix com toggle Ações/Erro-Acerto
- Seta `<` volta do step `'list'` para `'select'`

## PokerTableEditor (`src/components/ui/PokerTableEditor.tsx`)
- Assentos: `w-[48px] h-[48px] absolute z-10/z-20`
- Seat badge de stack: `absolute -bottom-7` — vaza ~28px abaixo do assento; container precisa de `pb-16` mínimo
- Posição visual determinada por `activeSlots` (SLOTS_6MAX ou SLOTS_8MAX)
- Rotação: se há HERO, rota os assentos para que o HERO apareça na posição do slot 0
- Assentos em `l:0%` / `l:100%` vazam lateralmente — container precisa de `px-10` mínimo

## Convenções e Padrões
- **Sem comentários** no código (exceto WHY não-óbvios)
- **Sem features extras** além do solicitado
- **Tailwind** para todo styling; sem CSS modules ou styled-components
- Validação apenas nas bordas (inputs de usuário); confiar no estado interno
- `useStore(s => s.ação)` para selecionar ações; `useStore.setState({})` para updates diretos pontuais
- Nunca criar arquivos `.md` além deste, a menos que explicitamente pedido

## Bugs Conhecidos / Gotchas
- `{0 && <span>}` em React renderiza literal `0` — usar `{!!valor && <span>}`
- `setBrush` deve sempre fazer `set({ brush: { ...brush, call:c, raise:r, allin:a } })` com os 3 campos (não só o campo alterado)
- Assentos do PokerTableEditor têm `z-10/z-20` e podem vazar para fora do container — adicionar `pointer-events-none` no wrapper quando o componente for puramente visual
- `<select>` em CSS Grid pode não esticar em Safari sem `w-full` explícito
- Badge de stack (`-bottom-7`) vaza 28px abaixo do assento — wrapper precisa de `pb-16` para conter

## Preferências do Usuário (Daniel)
- Respostas em português
- Sem emojis
- Mensagens curtas e diretas
- Não precisa confirmar cada passo antes de executar
- Prefere commits separados por feature
