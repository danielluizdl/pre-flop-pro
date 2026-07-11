STATUS: DONE

# Rotina auto/fable-analysis — página "Análise" pessoal

Objetivo COMPLETO em 1 run (11/07/2026). PR aberto: **#55 → feature/auth-telemetry**
(https://github.com/danielluizdl/pre-flop-pro/pull/55). Aguardando revisão do Daniel — a rotina NÃO mergeia.

## O que foi feito
- `MyCoachPanel.tsx` (aba Análise do Histórico) **movido** (git rename) pra `src/components/Analysis/AnalysisPage.tsx`:
  export `AnalysisPage` (cabeçalho h1 + intro + estado vazio deslogado, sem chamar API) envolvendo o
  painel interno `AnalysisContent` (conteúdo idêntico ao que existia — a paridade pessoal com a aba Drill
  do coach JÁ estava completa: filtros Período/Range, matriz real vs jogado + ComboSummary, RangeHeatGrid,
  TopHandsPanel/HandDetailCard em slot fixo, Por range/Maiores leaks/Consulta no drill ordenáveis).
- **Nenhuma mudança de backend**: `functions/api/me/analytics.js` já tinha todas as views (`PLAYER_VIEWS`).
- `Page` += `'analysis'`; `RouterSync` += `/analise`; lazy no `AppLayout`; item TopNav/Sidebar entre
  Range Check e Histórico (ícone `BarChart3`); i18n `nav.analysis` + seção `analysis` nos 3 idiomas
  (`stats.tabAnalysis`/`analysisIntro` removidas).
- `StatsPage`: aba Análise removida, wrapper volta a `max-w-2xl` fixo.
- Headings da página: h1 → h2 (Matriz do range) → h3 (Precisão/erros; `Section` de shared já é h3) —
  necessário pro axe `heading-order` (o painel antes era renderizado sem h1 acima).
- Testes: `MyCoachPanel.test.tsx` → `AnalysisPage.test.tsx` (+ teste deslogado, + StatsPage sem a aba);
  TopNav.test cobre clique em Análise → `setPage('analysis')`.
- `smoke/smoke.mjs`: passo 4 novo — TopNav→Análise renderiza seções, F5 em `/analise`, `/analise` sem
  token não quebra (verificação real no Chromium headless, pedida no objetivo).
- CLAUDE.md: pasta Analysis/, rota `/analise`, seção "AnalysisPage", abas atuais do StatsPage.

## Verificação (todos verdes no commit final)
- `npm test`: 1185 testes / 100 arquivos.
- `npm run build`: ok (warning >500kB é o chunk admin-ranges, conhecido).
- `npm run smoke`: ok, incluindo o passo novo da página Análise.

## Commits na branch
- 8fc2742 feat(analysis): promove a análise pessoal a página própria na navegação
- 981dddf test(smoke): verifica a página Análise no browser (navegação, F5, deslogado)
- 9815c4c docs: documenta a página Análise e as abas atuais do Histórico
