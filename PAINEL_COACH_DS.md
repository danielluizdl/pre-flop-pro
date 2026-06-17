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

### Ciclo 1 — Robustez estatística dos leaks (Wilson + Impacto) — EM ANDAMENTO
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

Commit: _(a preencher)_

---

## Backlog priorizado (próximos ciclos)
1. **Tendência/evolução** — precisão por semana com inclinação (regressão linear
   simples) por jogador e time; destacar quem regrediu. Util `weeklyTrend`/`linregSlope`.
2. **Segmentação de mãos** — agregar por categoria (par/suited/offsuit/broadway/
   conector), por ação correta (erram mais em 3bet? call? fold?) e por posição.
3. **Jogador vs time** — z-score/percentil por range e por mão (leaks relativos).
4. **Hotspots de consulta × erro** — mãos muito consultadas E muito erradas =
   lacuna de conhecimento real (cruzar `consult_events` com `hand_events`).
5. **Consistência** — variância da precisão entre sessões (estável vs oscilante).
6. **Foco da semana** — recomendação automática: top N mãos/ranges por impacto
   por jogador e para o time.
7. **Severidade por range** — razão grave/impreciso (erro conceitual vs variância
   de estratégia mista).

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
