# Worklog

## 2026-08-06 — disponibilidade explícita de metas e roleta

- A primeira carga real foi autorizada sem fonte oficial para metas ou roleta,
  desde que zero não fosse apresentado como resultado comercial.
- O contrato candidato avançou para `schemaVersion: 2`, com
  `goalsAvailable` e `rouletteAvailable` obrigatórios. Fonte indisponível exige
  zeros técnicos e falha se transportar valor comercial diferente de zero.
- A migration `20260806222732_salesforce_source_availability.sql` adiciona flags
  fail-closed aos snapshots. A função v1 foi movida para schema privado, sem
  execução externa, e o wrapper v2 persiste as flags atomicamente sem permitir
  que replay idempotente as altere.
- Dashboard e detalhes mostram “Fonte não configurada”/“Dados indisponíveis” e
  ocultam progresso, atingimento e gap. O ranking exclui roleta da pontuação e
  não apresenta seus pesos como disponíveis.
- Validação parcial: TypeScript, 45 Vitest, 8 testes Node e 190 pgTAP locais
  aprovados. A migration ainda não foi aplicada remotamente e nenhuma carga ou
  automação foi ativada.

## 2026-08-04 — lançamento sem Salesforce

- Branch `feat/salesforce-capability-flags` criada a partir de
  `c1d6af7b80d9ee33b694bdb8907e0a05183c9691` para separar o lançamento inicial
  da ativação futura das integrações.
- Ingestão M2M e refresh humano foram confirmados como capacidades
  independentes. Flags server-side exigem o valor literal `true`; qualquer
  ausência, valor diferente ou configuração incompleta falha fechada com
  `503`, sem cliente privilegiado ou chamada externa.
- A interface recebe somente o booleano de disponibilidade calculado no
  servidor. URL e segredos não atravessam a fronteira de Server Components.
- A configuração Supabase Auth de produção exige somente Site URL
  `https://crm.descomplicapro.com.br`. O código atual não possui callback OAuth,
  magic link ou recuperação de senha e, portanto, não requer redirects
  adicionais de produção.
- Validação local: 40 Vitest, 162 pgTAP, formatação, ESLint, TypeScript, build
  Next.js de 19 rotas, pnpm audit, OSV-Scanner, Gitleaks, actionlint,
  ShellCheck e validadores operacionais aprovados. Nenhuma migration foi criada
  ou aplicada; o Supabase local foi encerrado após os testes.

## 2026-08-04 — preparação da VPS de produção

- Commit-base inspecionado: `e14e9cf24966b86f835c2b717e1af4a42b32f568`.
- Validação da main: Prettier, ESLint, TypeScript, 30 Vitest, build de 18
  rotas, auditoria pnpm, Gitleaks, OSV-Scanner e actionlint aprovados.
- Supabase estritamente local: 162 testes pgTAP aprovados; lint e advisors de
  segurança/performance sem achados. Nenhuma migration remota foi aplicada.
- A implantação Docker/Nginx foi preparada na branch
  `ops/production-vps-docker`; o app permanece em loopback e HTTP público não
  encaminha tráfego antes do TLS.
- Smoke test da imagem standalone: container sem privilégios, filesystem
  somente leitura, limite de 2 GiB/1,5 CPU, healthcheck `healthy`, `/api/health`
  e `/login` respondendo `200` exclusivamente em `127.0.0.1:3000`.
- Hardening do host: usuário `deploy` com chave, senhas SSH desativadas, root
  mantido somente por chave, Fail2ban, atualizações automáticas, sysctl e UFW
  com entrada limitada a 22/80/443. O Nginx retorna `503` em HTTP até o TLS.
- DNS confirmado por Cloudflare, Google, Quad9 e pelos autoritativos
  `pixel.dns-parking.com`/`byte.dns-parking.com`: A `187.127.249.50` e AAAA
  `2a02:4780:75:cad3::1`, ambos com TTL de 300 segundos.
- `Generating static pages` reportou 23 unidades internas do build, não rotas.
  A `main` exibe 18 rotas; esta branch exibe 19 porque acrescenta somente
  `/api/health`. Os manifests confirmam 20 caminhos de aplicação na `main` e 21
  nesta branch, sem remoção. A única mudança no `next.config.ts` é o
  `deploymentId` opcional; não há filtro, rewrite ou alteração de descoberta de
  rotas.
- Node 24.19.0 e pnpm 11.20.0 foram confirmados, sem divergência, no host,
  `package.json`, `.nvmrc`, Dockerfile e GitHub Actions.
- Assistente seguro de ambiente adicionado para uso no Terminal. Ele preserva
  valores válidos, valida as novas chaves Supabase, gera os dois Bearers
  Salesforce e grava o arquivo com troca atômica e permissões restritas.
- Validação final da branch: formatação, ESLint, TypeScript, 30 Vitest, 162
  pgTAP, auditorias pnpm/OSV, Gitleaks de árvore/histórico, actionlint e build
  Next.js com 19 rotas aprovados. O assistente passou por Bash syntax,
  ShellCheck, `visudo`, teste de entrada sem eco e reexecução com preservação
  byte a byte. O Supabase local foi encerrado após os testes.

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

### Encerramento do Gate 1

- Autorização ampla recebida para promover e mesclar o trabalho validado.
- PR #5 mesclada na `main` em `33c134a`; GitHub Actions run `30877996373` passou após o merge.

## 2026-08-04 — Gate 2: dashboard somente leitura

- Branch `feat/gate2-dashboard-read-model` criada a partir da `main` atualizada.
- O contrato D1/JSON foi substituído por quatro tabelas normalizadas: snapshots, resumos por visão, métricas e empreendimentos.
- Grants explícitos concedem somente `SELECT` a `authenticated`; RLS exige `crm.dashboard.view`; `anon` e escrita direta permanecem bloqueados.
- `/app` passou a renderizar três visões e três períodos, progresso das cinco etapas, conversões, valor vendido por visão/período e destaques.
- Sem snapshot `global`, a interface exibe estado de espera. Dados demonstrativos e usuário hard-coded não foram migrados.
- Testes locais: 52 pgTAP e 7 Vitest aprovados; schema lint, advisors, ESLint, TypeScript e build também aprovados.
- Teste autenticado no navegador aprovado em 390×844 e 1440×900, sem overflow do corpo ou erros de console. Troca de visão e período atualizou métricas e URL corretamente.
- A fixture e a conta de QA foram criadas apenas no Supabase local e removidas por reset ao final.

### Encerramento do incremento do dashboard

- PR #6 mesclada na `main` no commit `66da130`; GitHub Actions run `30878565908` passou antes do merge e run `30878648010` passou na `main`.
- Branch `feat/gate2-funnel-goals` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: metas dos funis

- O contrato de `GoalsSettingsClient` e `/api/settings/goals` foi analisado no CRM original: dois perfis, seis etapas, cinco taxas e parâmetros operacionais de equipe.
- Migration `20260804044701_funnel_goals.sql` criada sem seed comercial. A tabela usa chave única por perfil/mês, colunas tipadas, constraints, grants mínimos e RLS.
- A RPC `upsert_crm_funnel_goals` exige sessão ativa e `crm.settings.manage`, normaliza o mês, calcula os volumes no servidor, força o escopo reduzido de parcerias, faz upsert e registra auditoria na mesma transação.
- `/app/configuracoes/metas` e `/app/configuracoes/metas/parcerias` substituíram os placeholders. Ambas usam sessão Supabase SSR; a antiga API pública e seus objetos JSON não foram copiados.
- `supabase db reset` aplicou as sete migrations do zero. Os 77 testes pgTAP passaram; Vitest passou com 3 arquivos e 11 testes.
- ESLint, TypeScript e build Next.js passaram. A primeira execução paralela de `typecheck` com `build` encontrou arquivos transitórios de `.next` removidos pelo build; a repetição sequencial passou, sem alteração de código necessária.
- QA autenticada criou metas DV e parcerias no Supabase local. O funil DV foi calculado como `90 → 45 → 30 → 15 → 12 → 10`; parcerias ocultou e zerou as etapas não aplicáveis.
- Usuário comum foi redirecionado para `/unauthorized`. Em 1280 px, largura do documento e `scrollWidth` permaneceram iguais, sem overflow horizontal.
- A conta administrativa, a conta comum e as metas de QA foram removidas por `supabase db reset` ao final.
- Gates finais: instalação congelada, formatação, ESLint, TypeScript, 11 testes Vitest, build de 21 páginas, 77 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: `pnpm audit` sem vulnerabilidades; Gitleaks sem achados na árvore ou em 174 commits; OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de metas

- PR #7 mesclada na `main` em `ca279fd`; GitHub Actions run `30879238469` aprovou a branch e run `30879283419` aprovou a `main`.
- Branch `feat/gate2-points-settings` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: configuração de pontos

- O contrato D1 foi extraído de `PointsSettingsClient`, `/api/settings/points` e `point_goals`: sete métricas, pesos e objetivos armazenados em JSON sem autorização.
- Migration `20260804045945_point_settings.sql` criou o singleton de configuração e sete linhas tipadas, sem seed. `crm.ranking.view` permite leitura; escrita direta permanece revogada.
- A RPC `replace_crm_point_settings` exige conta ativa e `crm.settings.manage`, rejeita payload incompleto/desconhecido/fracionário, substitui a configuração em uma transação e audita.
- `/app/configuracoes/metas/pontos` substituiu o placeholder por formulário server-rendered. Os pesos sugeridos originais aparecem apenas como proposta não persistida no estado vazio.
- Reset integral das oito migrations e 103 testes pgTAP passaram. ESLint, TypeScript, 14 testes Vitest e build de 21 páginas também passaram.
- QA autenticada salvou peso de venda `12` e objetivo de visitas `25`; a releitura confirmou ambos. Em 1280 px não houve overflow horizontal nem warning no servidor.
- Conta e configuração temporárias foram removidas por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 14 testes Vitest, build, 103 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 175 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de pontos

- PR #8 mesclada na `main` em `40982e7`; GitHub Actions run `30879627188` aprovou a branch e run `30879687370` aprovou a `main`.
- Branch `feat/gate2-ranking-read-model` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: ranking

- O `RankingClient` original foi analisado: quatro períodos, corretores/gerentes, sete atividades ponderadas, bônus por conversão e critérios de desempate.
- Migration `20260804050720_ranking_read_model.sql` criou snapshots e atividades por corretor/período, sem seed, JSON ou pontuação final congelada.
- A aplicação combina as atividades com os pesos atuais, calcula bônus, ordena corretores e agrega gerentes antes da pontuação.
- `/app/ranking` substituiu o placeholder por Server Component com pódio, resumo, placar, quatro períodos, duas visões e estado vazio sem dados demo.
- Reset integral das nove migrations e 128 testes pgTAP passaram. ESLint, TypeScript, 18 testes Vitest e build de 21 páginas também passaram.
- QA autenticada confirmou três corretores, duas equipes, troca de mês para hoje, URL, placar e cálculo. Documento e `scrollWidth` ficaram em 1280 px, sem warning no servidor.
- Conta, pesos e snapshot temporários foram removidos por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 18 testes Vitest, build, 128 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 176 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de ranking

- PR #9 mesclada na `main` em `ced2e14`; GitHub Actions run `30880051063` aprovou a branch e run `30880105833` aprovou a `main` após o merge.
- Branch `feat/gate2-stage-details` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: detalhes das etapas

- `StageDetailClient` foi analisado e reduzido ao contrato persistido: cinco etapas, três visões, três períodos, metas, conversões e cinco janelas comparativas.
- As rotas reutilizam `crm_dashboard_metrics`; nenhuma tabela ou cópia JSON adicional foi criada.
- `/app/etapas/[stage]` substituiu o placeholder por Server Component com atingimento, gap, conversão, histórico, plano de ação e navegação sequencial.
- Slugs inválidos retornam 404; `crm.stages.view` protege a rota e a RLS do dashboard continua protegendo os dados.
- ESLint, TypeScript, 21 testes Vitest e build de 21 páginas passaram.
- QA autenticada confirmou `Visitas` com 45/60, conversão de 56,3%, filtros Canal Imob/semana e navegação até `Vendas`. Sem overflow ou warning no servidor.
- Conta e snapshot temporários foram removidos por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 21 testes Vitest, build e 128 testes pgTAP aprovados. O schema lint reportou apenas falsos positivos conhecidos da extensão pgTAP; advisors de segurança e performance não encontraram problemas.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 177 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de detalhes

- PR #10 mesclada na `main` em `c4c959a`; GitHub Actions run `30880417097` aprovou a branch e run `30880462632` aprovou a `main` após o merge.
- Branch `feat/gate2-secure-ingestion` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: ingestão e Salesforce

- Os três endpoints originais foram relidos. Cloudflare/D1, fallback n8n fixo, status público e refresh sem sessão não foram copiados.
- Migration `20260804052500_secure_salesforce_ingestion.sql` criou `crm_ingestion_runs`, quatro RPCs, grants explícitos, RLS, auditoria, idempotência, locks, cotas, cooldown e rejeição de snapshot antigo.
- `/api/ingest/salesforce` aceita somente contrato Zod v1 normalizado, Bearer M2M de no mínimo 32 caracteres e corpo de até 1 MB. A secret key Supabase está isolada em módulo server-only.
- `/api/refresh/salesforce` exige sessão, `crm.salesforce.refresh`, origem da aplicação e configuração explícita; usa timeout de 15 segundos e nunca devolve resposta ou segredo do provedor.
- `/api/dashboard/status` exige `crm.dashboard.view` e lê uma RPC que expõe somente timestamps e estados seguros.
- O dashboard mostra o botão de refresh somente para usuário autorizado e informa sucesso, concorrência, cooldown ou falha sem detalhes internos.
- Cópias não versionadas `arquivo 2.*` surgiram durante a validação: 16 eram idênticas e uma continha o placeholder antigo do ranking. Todas foram removidas após comparação, evitando compilação duplicada/obsoleta.
- Reset integral das dez migrations passou. `supabase test db` aprovou 161 testes; schema lint e advisors de segurança/performance não encontraram problema no schema da aplicação.
- QA local: status sem sessão `401`, ingestão com segredo inválido `401`, ingestão válida `201`, replay idempotente `200`, refresh autorizado `202` e repetição no cooldown `429`.
- A ingestão de QA atualizou atomicamente dashboard (3 visões/15 métricas) e ranking; o navegador exibiu os dados e não teve overflow em 1280 px. Runs e auditoria registraram somente metadados sanitizados.
- Foi usado apenas um webhook HTTP local descartável. Nenhuma credencial, URL, base ou chamada de produção foi utilizada.
- Gates finais repetidos em banco limpo: instalação congelada, formatação, ESLint, TypeScript, 28 testes Vitest, build de 23 páginas e 162 testes pgTAP aprovados. Schema lint, Actionlint e advisors de segurança/performance passaram sem achados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 178 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de ingestão

- PR #11 mesclada na `main` em `9eba53b`; GitHub Actions run `30881418246` aprovou a branch e run `30881474209` aprovou a `main` após o merge.
- Branch `feat/gate3-interface-shell` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 3: shell da interface

- O `SiteMenu` estático foi mantido fora da migração: `AuthorizedNavigation` recebe o catálogo já filtrado e marca a rota atual com `aria-current`.
- `ThemeSwitch` migrou os modos claro, equilibrado e escuro com catálogo fechado, persistência local não sensível e fallback claro quando storage/valor não é válido.
- Tokens globais cobrem superfícies, textos, bordas e campos; foco visível e `prefers-reduced-motion` foram adicionados sem dependência nova ou script inline.
- ESLint, TypeScript, 30 testes Vitest e build de 23 páginas passaram antes da QA.
- QA autenticada confirmou os três temas, persistência ao navegar para Ranking, item ativo e ausência de overflow em 1280 px.
- Conta e preferência de QA foram removidas do banco por reset integral; nenhum dado remoto foi alterado.
- Gates finais repetidos: instalação congelada, formatação, ESLint, TypeScript, 30 testes Vitest e build de 23 páginas aprovados. Auditoria pnpm, Gitleaks na árvore e em 179 commits e OSV-Scanner em 514 pacotes não encontraram problemas.

## 2026-08-04 — compatibilidade de grants do Supabase

- A mudança de defaults da Data API para projetos novos foi confrontada com
  todos os acessos `.from()` e `.rpc()` da aplicação, migrations e testes.
- Migration `20260804191713_normalize_new_project_grants.sql` normaliza ACLs
  atuais e futuras: navegador somente leitura/RPCs guardadas, ingestão somente
  pela RPC server-only e bootstrap exclusivamente por `postgres`.
- A correção não altera policies, RLS, dados, índices ou integração remota. Uma
  matriz pgTAP dedicada cobre tabelas, sequências, funções, `rls_auto_enable`,
  `ensure_rls` e o bootstrap administrativo.
- Reset integral das onze migrations e 177 testes pgTAP passaram. O cenário em
  que `rls_auto_enable`/`ensure_rls` já existem também foi reproduzido em
  transação local; a função perdeu execução pública e o trigger continuou ativo.
- Formatação, ESLint, TypeScript, 40 testes Vitest e build Next.js de 23 páginas
  passaram. Schema lint não encontrou erro; auditoria pnpm, Gitleaks da árvore e
  do histórico, OSV-Scanner e Actionlint não encontraram problema.
- Advisors mantiveram somente o `INFO` de segurança intencional da tabela de
  ingestão sem policy e os informativos preexistentes de performance, sem
  adicionar índices a este escopo.

## 2026-08-06 — candidata Salesforce/n8n de produção

- Os quatro workflows n8n relevantes e o exportador da VPS legada foram
  copiados para backups root-only com SHA-256 antes de qualquer criação.
- Uma alteração externa de estoque no workflow ativo foi identificada e
  preservada sem mistura com a migração do CRM novo.
- O `success` do coordenador foi classificado corretamente como aceite
  assíncrono, não sucesso fim a fim. O ramo externo de estoque passou a expirar
  antes do agendamento/webhook; o transformador ativo não recebe execução
  completa desde 16:04 UTC.
- A resposta bruta da Analytics Reports API confirmou `recordId` estável para
  Opportunity, avaliação de crédito, Contact e Account. O XLSX legado descartava
  essa informação; a candidata agora a usa somente em memória.
- O exportador candidato coleta os sete reports autorizados, remove PII antes da
  serialização, agrega dashboard/ranking e grava o arquivo de validação
  atomicamente com modo `0600`.
- A primeira coleta real produziu 3 views, 15 métricas e 108 participantes. O
  schema Zod aceitou o payload; buscas por IDs Salesforce, e-mail, números longos
  e chaves proibidas no payload final retornaram zero.
- A segunda coleta reproduziu exatamente os tamanhos das sete fontes e
  reconciliou por ID/nome: 63 visitas sem agendamento, 19 pastas e 18 vendas fora
  do recorte de oportunidades, 122 pastas aprovadas, 27 corretores ativos e
  cinco ainda sem gerente resolvido.
- O workflow `GnSUcxUhyPYq6d1l` foi criado inativo, sem credenciais nem chamadas
  externas. Nenhum snapshot, usuário, papel, grant ou policy do Supabase novo
  foi alterado.
- Metas seguem sem fonte M2M confirmada e roleta não existe nos sete relatórios;
  a ativação e a primeira persistência permanecem bloqueadas até decisão
  explícita sobre esses dois campos.
