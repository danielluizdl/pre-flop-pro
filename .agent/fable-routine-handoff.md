STATUS: EM ANDAMENTO

# Handoff — rotina auto/fable-routine

Branch: `auto/fable-routine` (criada de `feature/auth-telemetry` em 10/07/2026).
Estado ao fim do run 2 (10/07): **1134 testes verdes (96 arquivos)**, build verde,
smoke verde. Tudo pushed. Falta só abrir o PR final (em andamento neste run).

## Progresso — OS 4 ITENS DO BACKLOG ESTÃO COMPLETOS

### Item 1 — Painel coach pessoal do jogador: FEITO (run 1, commit 1082f5d)
- Backend `functions/api/me/analytics.js` (player-scoped, `playerIds` SEMPRE do
  token, whitelist PLAYER_VIEWS); front `MyCoachPanel.tsx` na aba "Análise" do
  Histórico. Detalhes no histórico do git / versão anterior deste handoff.

### Item 2 — Auditoria Histórico + coach via Playwright: FEITO (run 1)
- Corrigido: abas do Histórico no mobile (commit 1fd6152).
- Achado NÃO corrigido (decisão de design pro Daniel): header do TopNav estoura
  viewport em 390px em todas as páginas (precisa decisão de nav mobile).
- Achado "ranges por nome no detalhe da sessão" → corrigido no item 4 (run 2).

### Item 3 — Relógio ao vivo Drill/Range Check: FEITO (run 1, commit fb62260)
- `ui/ElapsedClock.tsx`, no placar do Drill e no cabeçalho do round do Range Check.

### Item 4 — Replay completo do histórico: FEITO (run 2, 4 fatias)
1. **Resolução por id + placeholder de range apagado** (commit 02e85aa):
   `TrainingSession.rangeIds` (paralelo a rangeNames) gravado no upsert ao vivo e
   no stopDrill; `utils/sessionRanges.ts` (`resolveSessionRanges`: id primeiro,
   fallback por nome pra sessões antigas) usado no `SessionDetailView` (StatsPage)
   e no `SessionDetail` (HistoryModal do TrainerPage). Range renomeado mostra o
   nome novo; range apagado vira linha com badge "Range excluído do catálogo" e
   heatmap por mão (sobre grid vazio) ainda acessível.
2. **Replay mão a mão do Drill** (commit a126b73): novo `sessionHandLog` no store
   (acumula TODAS as respostas da sessão, sem o cap de 50 do handHistory visual),
   persistido como `TrainingSession.handLog` (cap 500 mãos/sessão — cota do
   localStorage). Seção colapsável "Mãos da sessão" nos dois detalhes de sessão,
   via `ui/SessionHandLog.tsx` (HandHistoryItem/MiniCard extraídos do TrainerPage
   pra lá; prop `showRange` quando a sessão tem >1 range). Sessões antigas sem
   handLog mostram aviso i18n.
3. **Replay rodada a rodada do Range Check** (commit fdcb79f): `BuildHistoryRound`
   ganha `userGrid`/`answerGrid` (ESPARSOS via encodeSparse) + rangeId/stackRange/
   customAction, gravados em `makeBuildSession` (answerGrid é snapshot do gabarito
   do momento — range editado/apagado depois não corrompe o replay). No
   `BuildHistoryPanel`, round com grid gravado vira linha clicável → expande
   `BuildRoundReplay` (RangeActionGrid "Seu range" vs "Gabarito" + DiffGrid;
   perHand recomputado via `scoreBuild`). `DiffGrid` extraído de ExercisePage pra
   `ui/DiffGrid.tsx`.
4. **Paginação** (commit 6420687): `ui/PagedList.tsx` (`usePagedList` + botão
   "Mostrar mais (N)", páginas de 20) nas 3 listas: Histórico de Sessões, aba
   Range Check e HistoryModal do Drill.
- i18n ×3 em todas as fatias (`stats.rangeDeleted`, `stats.handLog`,
  `stats.handLogUnavailable`, `stats.showMore`). Sem migração D1 em nada do item 4
  (tudo localStorage).

## Decisões de design (run 2)
- `handLog` cap 500/sessão e grids do Range Check em esparso: proteção da cota do
  localStorage; falha de save já cai no banner `storageBlocked` existente.
- Snapshot do gabarito por round em vez de resolver do catálogo: fidelidade do
  replay (o range pode mudar depois); pro Drill, o grid vem do catálogo por id
  (com fallback por nome) porque lá o heatmap da sessão é o dado primário.
- `openKey: string` (id ou `n:nome`) substitui `openRangeId: number` nos detalhes
  de sessão pra permitir expandir placeholders de ranges apagados.

## Bloqueios / dúvidas pro Daniel
- TopNav mobile (acima) — fora do escopo dos 4 itens.
- Migração D1: NENHUMA pendente desta branch (o painel pessoal só lê tabelas
  existentes).
