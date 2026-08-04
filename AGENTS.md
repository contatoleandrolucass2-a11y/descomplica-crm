# AGENTS.md

## Escopo

Este repositório consolida o sistema de login e o Descomplica CRM. O login Next.js/Supabase é a base arquitetural. Migre funcionalidades do CRM em incrementos pequenos, sem reintroduzir Cloudflare, D1, Vinext, Vite ou Wrangler.

## Regras obrigatórias

- Use Node 24.19.x e pnpm 11.20.x. Não crie `package-lock.json` nem `yarn.lock`.
- Antes de concluir qualquer alteração, execute `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.
- Não use `--force` ou `--legacy-peer-deps`.
- Não adicione pacote sem import, script ou requisito de runtime verificável.
- Nunca versione `.env.local`, tokens, chaves secret/service role, senhas, dumps ou artefatos de usuário.
- Toda tabela exposta deve ter grants mínimos e RLS validada. Autorização de interface nunca substitui autorização no servidor/banco.
- Não exponha `bootstrap_master_user` por endpoint, Server Action ou cliente público.
- Atualize `WORKLOG.md`, `CHANGELOG.md` e a documentação afetada no mesmo commit.
- Produção, DNS, cobranças e dados remotos exigem autorização explícita.

## Estrutura

- `app/`: rotas Next.js.
- `lib/auth/`: autenticação Supabase SSR.
- `lib/authorization/`: permissões e guards.
- `supabase/migrations/`: fonte versionada do schema.
- `tests/`: testes automatizados.
- `docs/`: inventários, runbooks e decisões operacionais.

## Fluxo

Crie branch por etapa, faça commits pequenos e descritivos, abra pull request e mantenha a CI verde. O plano de migração está em `MIGRATION_PLAN.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
