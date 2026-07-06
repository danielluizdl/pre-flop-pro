# Pre-Flop Pro

Ferramenta de treino de ranges de poker (pré-flop) com editor de ranges, simulador de mesa,
drill de treino e painel de analytics para coach de time.

Front-end React + TypeScript, sem backend tradicional: persistência local via `localStorage`
e uma camada opcional de nuvem (Cloudflare Pages Functions + D1) para autenticação, telemetria
e o painel do coach.

## Stack

- Vite + React 19 + TypeScript + Tailwind CSS + Zustand
- Cloudflare Pages Functions + D1 (SQLite) + KV — auth, telemetria e analytics do coach
- Vitest + React Testing Library + jest-axe — testes unitários, de componente e acessibilidade
- Playwright(-core) — smoke test de render real em Chromium headless

## Setup

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Sem variáveis de ambiente obrigatórias para rodar localmente —
o app funciona 100% com `localStorage` mesmo sem a camada de nuvem configurada (fail-open).

## Scripts

| Comando           | O que faz                                                              |
|--------------------|--------------------------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento (Vite)                                    |
| `npm run build`     | Type-check (`tsc`) + build de produção                                |
| `npm run preview`   | Serve o build de produção localmente                                  |
| `npm test`          | Roda a suíte de testes (Vitest)                                       |
| `npm run smoke`     | Builda e verifica render real no Chromium headless (ver abaixo)       |
| `npm run e2e`       | Testes end-to-end (Playwright)                                        |

### Smoke test

`npm run smoke` builda o projeto, sobe o preview e usa `playwright-core` para confirmar que o
app realmente renderiza no navegador (monta a raiz, navegação, um drill completo, painel do
coach) — pega quebras que teste unitário + build verdes não pegam (ex.: tela branca por ciclo
de import). Precisa de um Chromium disponível; se não houver um instalado, aponte
`SMOKE_CHROMIUM` para o executável (ex.: `SMOKE_CHROMIUM="/caminho/para/chrome"`).

## Estrutura

Ver [CLAUDE.md](./CLAUDE.md) para o mapa completo de pastas, tipos, store, convenções e o
backend de nuvem (auth, telemetria, painel do coach). Este README é só o ponto de entrada;
o CLAUDE.md é a referência viva do projeto.

## Deploy

- **Produção (jogadores):** GitHub Pages, deploy automático do `main` — link congelado, não
  recebe merges até liberação explícita.
- **Preview do site novo:** Cloudflare Pages, deploy automático por branch. O trabalho ativo
  acontece em `feature/auth-telemetry`, validado no preview
  `feature-auth-telemetry.pre-flop-pro.pages.dev` antes de qualquer promoção futura ao `main`.
