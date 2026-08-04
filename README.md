# Descomplica CRM

Base consolidada do Descomplica CRM. O sistema de login Next.js/Supabase é a fundação; as páginas, APIs e integrações do CRM serão migradas de forma controlada. Esta branch contém somente a preparação obrigatória do ambiente. A migração funcional ainda não começou.

## Arquitetura alvo

- Next.js nativo com App Router, React e TypeScript.
- Supabase Auth e PostgreSQL, com grants, RLS e auditoria.
- `pnpm` como único gerenciador de pacotes.
- Build `standalone` do Next.js em VPS Hostinger, gerenciado por PM2 e servido por Nginx/HTTPS.
- GitHub privado e CI antes da homologação.

As decisões completas estão em [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) e [MIGRATION_PLAN.md](MIGRATION_PLAN.md).

## Pré-requisitos

| Ferramenta                 | Versão validada | Uso                               |
| -------------------------- | --------------: | --------------------------------- |
| Node.js                    |     24.19.0 LTS | Runtime e build                   |
| NVM                        |          0.40.6 | Seleção reproduzível do Node      |
| pnpm                       |         11.20.0 | Dependências e scripts            |
| Git                        |          2.50.1 | Controle de versão                |
| Docker Desktop/Engine      |          29.4.3 | Supabase local                    |
| Docker Compose             |           5.1.4 | Serviços locais                   |
| Supabase CLI               |         2.111.0 | Migrações e banco local           |
| PostgreSQL client (`psql`) |            18.4 | Administração local controlada    |
| Gitleaks                   |          8.30.1 | Detecção de segredos              |
| OSV-Scanner                |           2.4.0 | Vulnerabilidades por lockfile     |
| GitHub CLI                 |          2.97.0 | Repositório e autenticação GitHub |
| actionlint                 |          1.7.12 | Validação da CI GitHub Actions    |
| ShellCheck                 |          0.11.0 | Validação de shell na CI          |

No macOS, o ambiente preparado usa Homebrew para CLIs e NVM para Node:

```bash
brew install git gh nvm libpq gitleaks osv-scanner actionlint
brew install supabase/tap/supabase
brew install --cask docker-desktop
nvm install
corepack enable
corepack prepare pnpm@11.20.0 --activate
```

Abra o Docker Desktop antes de iniciar o Supabase. Em outra plataforma, use os instaladores oficiais equivalentes.

## Instalação local

```bash
git clone <URL-PRIVADA-DO-REPOSITORIO>
cd descomplica-crm
nvm use
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Preencha em `.env.local` somente:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
MASTER_USER_ID=
```

Não use `service_role`, secret key ou credenciais PostgreSQL no bundle da aplicação. `.env.local` nunca deve entrar no Git.

## Banco local e aplicação

```bash
pnpm db:start
pnpm dev
```

- Aplicação: `http://127.0.0.1:3000`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Para reconstruir o banco do zero com as migrations versionadas:

```bash
pnpm exec supabase db reset
pnpm exec supabase migration list --local
pnpm exec supabase db lint --local
```

O bootstrap inicial do usuário `master` é uma operação privilegiada e separada. Siga [docs/runbooks/bootstrap-master.md](docs/runbooks/bootstrap-master.md); nunca transforme esse procedimento em endpoint público.

## Validação obrigatória

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm audit
pnpm security:secrets
pnpm security:secrets:history
pnpm security:osv
pnpm build
```

`pnpm verify` executa lint, typecheck, testes e build em sequência. O lockfile permite scripts de instalação somente para `esbuild`, `sharp`, `supabase` e `unrs-resolver`.

## Build e execução de produção

```bash
pnpm install --frozen-lockfile
pnpm build
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js
```

O diretório `.next/standalone` é o artefato de runtime. O fluxo completo de Hostinger, Nginx, PM2, backup, homologação e rollback está em [DEPLOYMENT.md](DEPLOYMENT.md). Produção exige autorização explícita.

## Documentação

- [WORKLOG.md](WORKLOG.md): evidências da preparação e resultados de comandos.
- [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md): inventário dos dois projetos e da base final.
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md): ferramentas e reconstrução do ambiente.
- [docs/DATABASE.md](docs/DATABASE.md): migrations, RLS e procedimentos de banco.
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): integrações encontradas e política de migração.
- [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md): backup e restauração.
- [CONTRIBUTING.md](CONTRIBUTING.md): fluxo de branch, commits e qualidade.

## Checkpoints de origem

As duas origens continuam recuperáveis por tags e bundles Git:

- `checkpoint/login-original-2026-08-03` — sistema de login original.
- `checkpoint/crm-original-2026-08-03` — CRM original.
- Bundles: diretório irmão `../source-checkpoints/` no pacote de entrega.

Os ZIPs originais não são versionados e não devem ser enviados ao GitHub.
