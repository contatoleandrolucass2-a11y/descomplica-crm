# Worklog

## 2026-08-03 — preparação obrigatória do ambiente

### Fontes preservadas

| Fonte                        | SHA-256                                                            | Git original             |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `descomplica-crm.zip`        | `1b80ed5f548216fb82452cde93e88b352b3114a9d8fd191b15a24f7950730bbd` | `6783f68`, branch `main` |
| `sistema login completo.zip` | `0ff10c588dede98572f434d0fc58cd64860302d686ef203a595472a6d2c317bb` | `09ae627`, branch `main` |

Os arquivos foram extraídos em cópias isoladas, excluindo `node_modules`, `.next`, metadados Apple e artefatos gerados. Os históricos originais foram preservados em tags e bundles. O repositório final nasceu de clone limpo dos arquivos rastreados do sistema de login.

### Higiene e segredos

- O ZIP do login continha `.env.local` ignorado pelo Git, com credencial pública legada e identificadores reais.
- O arquivo foi movido para quarentena local com permissão restrita; nenhum valor foi copiado para a entrega, logs ou Git.
- Gitleaks do histórico Git: zero achado em 35 commits do login e 126 commits do CRM.
- Gitleaks da árvore: um achado no arquivo local do ZIP do login; zero no CRM.
- Decisão: usar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e solicitar rotação da chave legada ao proprietário antes de qualquer uso remoto.
- O scan bruto da árvore final sinalizou 13 valores aleatórios exclusivamente em manifests/cache `.next`. A configuração Gitleaks passou a excluir somente artefatos gerados/ignorados; código atual e histórico continuam verificados separadamente.

### Baseline — sistema de login original

Ambiente: Node 24.19.0 e pnpm 11.1.2 conforme lockfile original.

| Comando                                | Resultado                                           |
| -------------------------------------- | --------------------------------------------------- |
| `pnpm install --frozen-lockfile`       | aprovado                                            |
| `pnpm lint`                            | aprovado                                            |
| `pnpm typecheck`                       | aprovado                                            |
| `pnpm test`                            | inexistente                                         |
| `pnpm build`                           | aprovado com Next.js 16.2.6                         |
| `pnpm audit`                           | 23 vulnerabilidades: 14 altas, 8 moderadas, 1 baixa |
| smoke local `/`, `/login`, `/register` | 307, 200, 200                                       |

### Baseline — CRM original

Ambiente: Node 24.19.0 e npm/package-lock original.

| Comando            | Resultado                                                        |
| ------------------ | ---------------------------------------------------------------- |
| `npm ci`           | instalou 708 pacotes; aviso de pacote depreciado                 |
| `npm run lint`     | exit 0, um warning de variável não usada                         |
| `npx tsc --noEmit` | falhou com 16 erros de tipos Cloudflare/D1 e componentes         |
| `npm run build`    | gerou build Vinext com warnings de imports Node/compatibilidade  |
| `npm test` isolado | falhou: URL ESM `cloudflare:` e arquivo SkeletonPreview ausente  |
| `npm run dev`      | falhou: data de compatibilidade nova demais para o binário local |
| `npm audit`        | 18 vulnerabilidades: 13 altas, 4 moderadas, 1 baixa              |

Uma falha `EEXIST` observada ao executar teste e build simultaneamente foi descartada como corrida artificial; o teste isolado acima é o baseline canônico.

### Dependências e incompatibilidades

- Inventários completos diretos estão em `docs/DEPENDENCIES.md`; `pnpm-lock.yaml` registra a árvore transitiva final.
- Removidos do alvo: Cloudflare plugin, Wrangler, Vinext, Vite/RSC, Drizzle/D1, React Server DOM direto e package-lock.
- Consolidados: Next, React, React DOM, Tailwind, TypeScript, ESLint e tipos.
- Adicionados com uso comprovado: Vitest, Supabase CLI e Sharp.
- Atualizados seletivamente para correções compatíveis: Next 16.3.0, React 19.2.8, Supabase SDK 2.112.0 e SSR 0.12.4.
- Mantidos em versões estáveis compatíveis: TypeScript 5.9.3, ESLint 9.39.5 e Tailwind 4.3.0; não houve atualização indiscriminada.
- Nenhum `--force` ou `--legacy-peer-deps` foi usado.

### Ferramentas instaladas/validadas

| Ferramenta              |   Versão final |
| ----------------------- | -------------: |
| Node.js via NVM         |        24.19.0 |
| NVM                     |         0.40.6 |
| pnpm via Corepack       |        11.20.0 |
| Git                     |         2.50.1 |
| GitHub CLI              |         2.97.0 |
| Docker Engine / Compose | 29.4.3 / 5.1.4 |
| Supabase CLI            |        2.111.0 |
| PostgreSQL client       |           18.4 |
| Gitleaks                |         8.30.1 |
| OSV-Scanner             |          2.4.0 |
| actionlint              |         1.7.12 |
| ShellCheck              |         0.11.0 |

O Homebrew instalou Node 26 como dependência transitiva de uma CLI, mas o shell do projeto foi corrigido para sempre selecionar Node 24 pelo NVM. `.zprofile` e `.zshrc` foram validados em nova sessão.

### Segurança da base final

- Overrides mínimos corrigem faixas vulneráveis de `@babel/core`, `brace-expansion` e `postcss`.
- Uma primeira auditoria final encontrou `@babel/core` 7.29.0 com severidade baixa. OSV indicou correção em 7.29.6; a versão foi confirmada no registro e aplicada por override compatível da mesma linha principal.
- Resultado após correção: 0 crítica, 0 alta, 0 moderada e 0 baixa.
- Política pnpm permite scripts de instalação somente para `esbuild`, `sharp`, `supabase` e `unrs-resolver`.
- CI preparada com permissões somente de leitura, instalação congelada, lint, typecheck, testes, auditoria de severidade alta/crítica e build.

### Supabase local

- PostgreSQL 17.6 validado.
- Quatro migrations aplicadas e sincronizadas localmente.
- Sete tabelas públicas, todas com RLS habilitada.
- Oito papéis e oito permissões estruturais.
- `supabase db lint --local`: nenhum erro de schema.
- `supabase test db`: harness pgTAP disponível; ainda não há arquivos de teste SQL (`NOTESTS`). Os testes atuais obrigatórios são executados pelo Vitest, e cada migration do CRM deverá incluir teste SQL.
- Security advisors: nenhum achado.
- Performance advisors: três warnings de múltiplas policies permissivas de `SELECT`, registrados em `docs/DATABASE.md`.
- Configuração atualizada de `inbucket` para `local_smtp`, redirects HTTP locais e senha mínima de oito caracteres.

### Validação da base final

| Comando                                                  | Resultado                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                         | aprovado                                                          |
| `pnpm lint`                                              | aprovado                                                          |
| `pnpm typecheck`                                         | aprovado                                                          |
| `pnpm test`                                              | aprovado: 1 arquivo, 4 testes                                     |
| `pnpm build`                                             | aprovado: Next.js 16.3.0, output standalone                       |
| `pnpm dedupe --check`                                    | aprovado após deduplicação controlada                             |
| `pnpm audit` e OSV-Scanner                               | aprovados: zero vulnerabilidade conhecida                         |
| smoke local `/`, `/login`, `/register`, `/app`, `/admin` | 307, 200, 200, 307, 307; áreas protegidas redirecionam sem sessão |
| smoke `node .next/standalone/server.js`                  | aprovado em `/`, `/login` e `/app`; artefato de produção inicia   |
| `actionlint .github/workflows/ci.yml`                    | aprovado                                                          |

Na primeira repetição dos gates com o stack local ativo, o ESLint varreu código minificado gerado pela CLI em `supabase/.temp`. O diretório já era gitignored; ele foi também excluído explicitamente do escopo do lint, junto dos demais artefatos de build, e a sequência foi reiniciada.

### Decisões técnicas

1. Sistema de login como base e CRM como fonte funcional.
2. Next.js nativo, sem Cloudflare/Vinext/Vite.
3. Supabase PostgreSQL/Auth/RLS no lugar de D1 e autenticação manual.
4. pnpm único e lockfile único.
5. Build standalone + PM2/Nginx para Hostinger; Docker apenas no desenvolvimento Supabase.
6. GitHub, CI e branch protegida antes da homologação.
7. Nenhuma publicação em produção sem autorização explícita.

### Checkpoint remoto e Gate 0

- Checkpoint local criado na branch `chore/environment-preparation`: `dcb4257` (toolchain/dependências) e `217da89` (CI).
- Todos os gates foram repetidos após documentação e formatação; Supabase reiniciou limpo e foi encerrado com backup local preservado.
- Autenticação `gh` validada em 2026-08-04. Repositório privado criado em `contatoleandrolucass2-a11y/descomplica-crm`, com `main` definida como branch padrão.
- Branch `chore/environment-preparation` e três tags de checkpoint enviadas. PR #1 aprovada pela CI e mesclada em `main` no commit `474e4b9`.
- GitHub Actions run `30875961593`: aprovado em 54 segundos. Instalação congelada, lint, typecheck, 4 testes, auditoria e build passaram.
- A segunda execução verde apontou runtime Node 20 depreciado nas actions v4. `actions/checkout` foi atualizado para v7.0.1 e `actions/setup-node` para v7.0.0, ambas fixadas por SHA completo para reduzir risco de alteração de tag.
- GitHub Actions run `30876134775`: aprovado em 50 segundos com actions v7 e sem a anotação de runtime depreciado.
- GitHub Actions run `30876287356` na `main`: aprovado em 56 segundos após o merge.
- Dependabot alerts e security updates habilitados; branches passam a ser apagadas automaticamente após merge.
- Após a atualização da `main`, Dependabot recalculou zero alerta aberto. A PR automática #2, baseada no lockfile antigo e conflitante com Next.js 16.3.0, foi fechada e sua branch removida.
- Proteção da `main` não foi habilitada: a API exige GitHub Pro para este repositório privado. O projeto permaneceu privado e nenhum plano/cobrança foi alterado. Pull request e CI continuam sendo o fluxo obrigatório documentado.
- Gate 0 encerrado. A migração funcional pode começar em nova etapa/branch a partir da `main` validada.

## 2026-08-04 — visibilidade pública do repositório

- Por solicitação explícita do proprietário, `contatoleandrolucass2-a11y/descomplica-crm` mudou de privado para público.
- Antes da exposição, Gitleaks verificou a árvore atual e 169 commits: zero segredo encontrado.
- GitHub confirmou `visibility: public`; código, histórico, tags, issues, pull requests e Actions passaram a ser acessíveis publicamente.
- Nenhuma configuração de produção, plano ou cobrança foi alterada.
- A proteção da `main`, antes indisponível no plano para repositório privado, tornou-se tecnicamente disponível; não foi alterada porque o pedido se limitou à visibilidade.

## 2026-08-04 — início do Gate 1

- Branch `feat/gate1-page-catalog` criada a partir da `main` pública e verde.
- CRM original inventariado: sete superfícies de página, cinco etapas dinâmicas, nove componentes reutilizáveis e oito endpoints.
- O login Supabase SSR permanece como autenticação única. As três APIs manuais de autenticação do CRM serão descartadas.
- Menu estático será substituído por catálogo PostgreSQL associado a permissões efetivas. Cloudflare, D1, Vinext, Vite, Wrangler e dados demo continuam proibidos.
- Inventário detalhado: `docs/CRM_INVENTORY.md`.

### Catálogo, autorização e painel administrativo

- Migration `20260804041218_page_catalog_and_crm_permissions.sql` criada com 9 novas permissões, catálogo de 14 páginas, grants explícitos, RLS e RPC auditada de visibilidade.
- Novas contas Auth recebem perfil e papel `user`; contas existentes são preenchidas de forma idempotente. Usuário inativo não obtém contexto nem permissões efetivas.
- Painel `/admin/usuarios` permite atribuição de papéis, exceções `allow`/`deny`, remoção de exceções e ativação/desativação dentro da hierarquia.
- Painel `/admin/paginas` controla visibilidade do catálogo. A navegação protegida consulta apenas páginas ativas autorizadas pela RLS.
- Todas as rotas CRM inventariadas existem sob `/app` e possuem guarda server-side específica; conteúdo funcional ainda será migrado por domínio.
- As três policies SELECT duplicadas preexistentes foram consolidadas. Advisors locais de segurança e performance passaram sem achados.
- Reset integral das cinco migrations aprovado. `supabase test db`: 26 testes aprovados; `supabase db lint`: sem erros.
- Build `standalone` gerou 21 páginas. Smoke sem sessão confirmou `/login` e `/register` com HTTP 200 e todas as rotas protegidas redirecionando para `/login`.
- O primeiro processo `standalone` foi iniciado sem as variáveis públicas do Supabase e respondeu 500; a repetição com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` locais passou. Nenhum segredo foi exibido ou persistido.
- Checkpoint funcional criado em `800ba10` e publicado na branch `feat/gate1-page-catalog`.
- PR draft #5 aberta contra `main`; GitHub Actions run `30877794127` aprovou o workflow `validate` em 39 segundos.
