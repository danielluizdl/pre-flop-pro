# Rotina 4 — concluída

Ultimo commit: 0d897ece6dd27052d1e83921e672c4a143ff262d

## Migracao do banco (obrigatoria antes do deploy)

Rodar a migracao:

```
npx wrangler d1 execute preflop-db --file=schema_v2.sql --remote
```

## Entregas

- Bloco A: telemetria confiavel — session_uuid ligando eventos as sessoes, dedupe via client_event_id (UNIQUE INDEX + INSERT OR IGNORE), validacao server-side nos tres endpoints de events, fila offline (src/utils/eventQueue.ts) com retry e cap de 500.
- Bloco B: API /api/me/stats (overview, by-range, by-hand, sessions) + aba "Meus dados na nuvem" na StatsPage.
- Bloco C: API /api/admin/analytics (team-overview, leaks, consult-hotspots, by-range) com filtros playerId/rangeId/days.
- Bloco D: CoachPanel reestruturado em "Visao do time" (filtros, resumo, leaks, hotspots, por range) e "Por jogador".
