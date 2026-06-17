# Painel Coach — Ciência de Dados

Doc vivo do trabalho de elevar o Painel Coach a um nível de análise de dados
mais profundo, estatisticamente sólido e acionável. Atualizado a cada ciclo.

Branch de trabalho: `feature/auth-telemetry`. **Merge para `main` NÃO é feito
de propósito** — fica a critério do Daniel.

## Princípios
- Extrair MAIS SINAL dos dados que já existem (não inventar features de vaidade).
- Toda lógica de cálculo estatístico vive em funções puras em `src/utils/` com
  testes unitários (vitest). Cálculo errado engana o coach — testes inegociáveis.
- Agregar no SQL quando possível; reaproveitar filtros (`playerIds`, `rangeId`,
  `days`, `stackGridIdx`) e o agrupamento por `range_id` com `MAX(range_name)`.
- Visualização: SVG inline / CSS (como `AccuracySparkline`/`RangeHeatGrid`),
  sem libs pesadas. Coach-only nos endpoints `admin/*` (401/403).

## Dados disponíveis (D1)
- `hand_events`: user_id, range_id, range_name, hand, action_taken,
  correct_action, is_correct, severity ('grave'|'impreciso'|null), rng,
  stack_range, stack_grid_idx, session_uuid, created_at.
- `consult_events`: user_id, range_id, range_name, hand, session_uuid, created_at.
- `training_sessions`: user_id, range_names, hands, correct, errors, consults,
  duration_seconds, started_at, ended_at, session_uuid.
- ~80k+ mãos demo (`demo_*`), RFI por posição (>5k cada) e ranges multi-stack.

---

## Ciclos

### Ciclo 1 — Robustez estatística dos leaks (Wilson + Impacto) — FEITO (8ea389d)
Problema: a view `leaks` ordenava por precisão bruta (ASC) com `HAVING total>=5`.
Estatisticamente frágil: 1/5 (20%) aparecia acima de 40/200 (20%), mesmo com
evidência muito mais fraca; sem noção de tamanho de amostra nem de gravidade.

Solução:
- `src/utils/coachStats.ts` (funções puras + testes):
  - `wilsonInterval(correct,total,z)` / `wilsonLowerBound` — IC de proporção
    (score de Wilson, default z=1.96 ≈ 95%). Robusto para n pequeno e p≈0/1.
  - `confidenceLevel(total)` — 'low' (<15), 'medium' (<50), 'high' (≥50).
  - `leakImpact({total,correct,graves,imprecisos})` = erros ponderados por
    gravidade: `graves*1.0 + imprecisos*0.4 + outrosErros*0.7`. Equivale a
    frequência × taxa de erro × peso de gravidade (acionável: "quantos erros
    ponderados esta mão custa ao time").
  - `rankLeaks(rows)` — anexa impact/wilson/confidence e ordena por impacto desc.
- Backend `analytics.js` view `leaks`: retorna `imprecisos`; ordena por impacto
  ponderado no próprio SQL (expressão espelha o util — manter em sincronia) e
  ainda re-ranqueia no JS via util. Threshold mínimo de tentativas baixado para 3
  (o ranking por impacto já desprioriza n pequeno).
- UI `CoachPanel` (tabela Leaks): coluna Impacto, precisão com piso de Wilson
  (mín X%) e marcador visual de baixa confiança (n pequeno).

Commit: 8ea389d

### Ciclo 2 — Tendência/evolução (regressão linear semanal) — FEITO
Objetivo: dizer se cada jogador e o time estão MELHORANDO ou PIORANDO, e
destacar regressões — sinal que nenhuma tabela de precisão absoluta mostra.

Solução:
- `src/utils/coachTrend.ts` (puro + testes): `linreg` (mínimos quadrados com
  peso opcional), `classifyTrend` (improving/regressing/stable/insufficient,
  zona morta 0.5pp/sem), `buildTrend` (série semanal ponderada por nº de mãos,
  x respeita lacunas de semana), `aggregateTeamBuckets`.
- Backend `analytics.js` view `trend`: precisão por jogador × semana (bucket
  `created_at/604800`) + lista de jogadores. Inclinação calculada no front.
- `CoachPanel`: Section "Evolução" com sparkline SVG do time + tabela por
  jogador (sparkline, início→fim, badge de tendência), ordenada com regressões
  no topo e linha vermelha para quem regrediu.
Metodologia: regressão ponderada por volume (semanas com mais mãos pesam mais);
trend só é classificado com ≥2 semanas e ≥20 mãos (senão "sem base").

Commit: 3d9bcb0

### Ciclo 3 — Segmentação de mãos (categoria + ação correta) — FEITO
Objetivo: revelar padrões que a matriz por range não mostra — o time erra mais
em quê? (suited connectors? broadways offsuit?) e em qual decisão? (fold? 3bet?).

Solução:
- `src/utils/handCategories.ts` (puro + testes): `parseHand`, `rankIndex`,
  `segmentsOf` (Pares/Broadways/Suited/Offsuit/Conectores/Ases suited — segmentos
  podem se sobrepor, ex. AKs ∈ Suited+Broadways+Ases suited), `aggregateSegments`
  (reaproveita leakImpact/Wilson/confidence de coachStats).
- Backend `analytics.js` view `segments`: byHand (≤169 grupos) + byAction
  (GROUP BY correct_action). Categorização no front (SQLite não classifica mãos).
- `CoachPanel`: Section "Segmentos" com duas tabelas — por categoria e por ação correta.

Commit: 2f1cbea

### Ciclo 4 — Lacunas de conhecimento (consulta × erro) — FEITO
Objetivo: separar "consulta porque erra" de "consulta por hábito". Mãos muito
consultadas E ainda muito erradas = lacuna real, alvo prioritário de estudo.

Solução:
- `src/utils/coachStats.ts`: `weightedErrorRate`, `knowledgeGapScore`
  (consultas × taxa de erro ponderada por gravidade), `rankKnowledgeGaps`
  (filtra consults>0, ordena por score; funções puras + testes).
- Backend `analytics.js` view `knowledge-gaps`: junta consult_events (por
  range_id,hand) com hand_events (total/correct/graves/imprecisos); merge no JS.
- `CoachPanel`: Section "Lacunas de conhecimento" — Mão/Range/Consultas/
  Precisão(mín Wilson)/Graves/Score, com ponto de confiança.

Commit: _(a preencher)_

---

## Backlog priorizado (próximos ciclos)
1. **Jogador vs time** — z-score/percentil por range e por mão (leaks relativos).
3. **Foco da semana** — recomendação automática: top N mãos/ranges por impacto
   por jogador e para o time.
4. **Segmentação por posição** — agregar by-range por `range.positions[0]` (client).
5. **Consistência** — variância da precisão entre sessões (estável vs oscilante).
6. **Severidade por range** — razão grave/impreciso (conceitual vs estratégia mista).

## Passos manuais pendentes
- Nenhuma migração de schema nova até agora (ciclo 1 só usa colunas existentes).
- Se algum ciclo criar `schema_vN.sql`, rodar manualmente:
  `npx wrangler d1 execute preflop-db --file=schema_vN.sql --remote` (aditivo, nunca DROP).

## Metodologia estatística (referência)
- **Intervalo de Wilson**: IC de proporção mais confiável que Wald para n pequeno
  e proporções extremas; usado para o "piso" de precisão (lower bound) — não
  confiar em 100% de 3 mãos.
- **Impacto de leak**: erros ponderados por gravidade — prioriza o que mais custa
  ao time, não o maior % de erro isolado.
