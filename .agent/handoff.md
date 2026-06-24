# Handoff — Agente Diário (Pre-Flop Pro)

## 2026-06-23 (terça — UI/design)

### Feito hoje
- **UI: indicador de preset ativo no `BrushControls`** (`src/components/RangeBuilder/BrushControls.tsx`). Os botões 0/25/50/75/100% agora destacam qual valor está aplicado (borda + fundo brand). Extraído `PresetButton` para deduplicar as duas cópias (Call/Raise/All-In e condição custom) e trocados os handlers de hover inline (`style` mutado em mouseEnter/mouseLeave) por classes Tailwind. Puramente visual, sem mudança de comportamento.

### Estado
- Testes: 214 passam (21 arquivos). Build: verde.
- Warning conhecido: chunk principal ~553KB > 500KB (issue #4). `CoachPanel` já é lazy.
- Branch de trabalho: `auto/daily-improvements` (a partir de `feature/auth-telemetry`); pushada.
- PR: #5 ABERTA (auto/daily-improvements → feature/auth-telemetry), corpo atualizado com o incremento de hoje. NÃO mergeada (gate humano — validações de hardening pendentes no preview).
- **Riscos:** nenhum novo hoje (mudança só visual). Riscos do hardening N1–N4 seguem pendentes de validação no preview (CSP, PBKDF2 100k CPU, login legado re-hash, sessões ativas).

### Próximas tarefas (priorizadas)
1. **#4 — code-split do chunk principal** (performance, tema quarta). Revisar `manualChunks` em `vite.config.ts` (separar vendor react/zustand) OU lazy-load de página pesada ainda não lazy. Pronto: warning some/reduz, antes/depois em KB no PR.
2. **#2 — atualizar CLAUDE.md** (doc interna, tema domingo). Documentar `Auth/`, `CoachPanel`/`RangeHeatGrid`/`RangeActionGrid`, `TopNav`/`RouterSync`, `MyAccountStats`, `CategoryDetailPage`, utils novos (coach*, handCategories, rangeCombos, eventQueue, sentry) e a seção de segurança (PBKDF2, _headers/CSP, scrub Sentry, sessões ativas).
3. **UI/acessibilidade (próxima terça/sexta):** padronizar estados de foco dos `<input>`/`<select>` que não usam a classe `.input` (muitos usam só `border border-warm-600` sem `:focus`). Candidatos: inputs numéricos em `BrushControls`, `TableEditorPage`, filtros do drill. Pronto: foco visível consistente (borda brand + glow) sem mudança de layout.

### Propostas (gate humano) — restante de segurança ainda NÃO feito
- **N2 rate limit real:** WAF Rate Limiting Rules em `/api/auth/*` ou KV/Durable Object (exige wrangler.toml/painel — fora do agente). Issue #6.
- **Operacional (só Daniel):** GitHub Secret Scanning + Push Protection; MFA em GitHub/Cloudflare.
- **Validar no preview** (antes de mergear #5): CSP, login de conta legada (re-hash), CPU do PBKDF2, sessões ativas (listar/revogar/revogar-outras).
- Lembrete: auth/, worker/, functions/api, schema*.sql/D1 NÃO são implementáveis pelo agente sem autorização explícita do Daniel.
