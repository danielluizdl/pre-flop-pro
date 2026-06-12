# Rotina 3a — Concluída

- Branch: `feature/auth-telemetry`
- Último commit: `394ced1936ae061e14871aa57dfc47b721221a1e`

## Antes de usar

Rodar uma vez para criar as tabelas no D1 remoto:

```
npx wrangler d1 execute preflop-db --file=schema.sql --remote
```

## Entregue

- Bloco A: `wrangler.toml`, `schema.sql`, `vite.config.ts` com `base: '/'`, deploy GitHub Pages desativado no workflow (CI build mantido), `functions/api/_utils.js`.
- Bloco B: Pages Functions `functions/api/auth/` — signup, login, me, logout, change-password.
- Bloco C: `CurrentUser` + page `'admin'` nos tipos; store com `currentUser`/`authToken` (sessionStorage `pfp-auth-token`) e ações `authLogin`/`authSignup`/`authLogout`/`changePassword`/`restoreSession` (chamada em `main.tsx`); `AuthModal`, `ChangePasswordModal`, stub `CoachPanel`; botões Entrar/Olá+Sair/Painel Coach no `TopNav`.

## Adaptações em relação à especificação original

- O store já tinha `login(password)`/`logout()` do fluxo admin/visitante (worker) — as ações de conta foram nomeadas `authLogin`/`authSignup`/`authLogout` para não colidir.
- O header do app é o `TopNav` (não há mais header no `AppLayout`) — os botões de conta e os modais foram integrados lá; `AppLayout` só roteia `case 'admin'` (coach → `CoachPanel`, senão Dashboard).
