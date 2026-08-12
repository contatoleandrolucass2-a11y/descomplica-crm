# Relatório de validação

Data: 2026-08-09 (UTC)

## Base

- Base obrigatória: `codex/supabase-proof-rls-hardening`
- SHA de base: `8ae8a42a7182e432657676e28b4ec29ef7eb354b`
- Branch: `codex/integration-read-model-v3`
- Node: `v24.19.0`
- pnpm: `11.20.0`
- Supabase CLI local: `2.111.0`
- Lockfile: preservado
- Dependências adicionadas: nenhuma

## Baseline anterior à implementação

| Validação        | Resultado                           |
| ---------------- | ----------------------------------- |
| `pnpm lint`      | aprovado                            |
| `pnpm typecheck` | aprovado                            |
| `pnpm test`      | 103 aprovados, 1 ignorado; Node 8/8 |
| `pnpm build`     | aprovado; 29 páginas                |
| `pnpm db:test`   | 13 arquivos, 518 testes aprovados   |

## Validação final local

| Validação                                | Resultado                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| reset completo do banco local            | 20 migrations aplicadas em ordem; seed concluído                                           |
| `pnpm lint`                              | aprovado                                                                                   |
| `pnpm typecheck`                         | aprovado                                                                                   |
| `pnpm test`                              | 24 arquivos; 125 Vitest aprovados, 1 ignorado; Node 8/8                                    |
| `pnpm build`                             | aprovado; 37 páginas                                                                       |
| `pnpm db:test`                           | 15 arquivos; 684/684 testes pgTAP aprovados                                                |
| Vitest direcionado v3/integrações/acesso | 6 arquivos, 41/41 aprovados                                                                |
| teste pgTAP v3 isolado                   | 143/143 aprovados, incluindo ingestão e agregação reais de 10.000 fatos dentro do timeout  |
| governança de identidades isolada        | 20/20 aprovados; histórico, DELETE restrito, lineage temporal e revisores negativos        |
| teste pgTAP Qlik isolado                 | 54/54 aprovados                                                                            |
| Prettier somente no diff                 | aprovado; o check global identifica 12 arquivos preexistentes fora do diff                 |
| `git diff --check`                       | aprovado                                                                                   |
| `bash -n` do configurador de ambiente    | aprovado                                                                                   |
| `pnpm audit`                             | nenhuma vulnerabilidade conhecida                                                          |
| Gitleaks árvore/histórico                | nenhum vazamento; 207 commits inspecionados                                                |
| OSV                                      | nenhum problema em 518 pacotes                                                             |
| lint DB `public,private`                 | nenhum erro                                                                                |
| advisors DB de segurança/performance     | nenhum warning ou erro local                                                               |
| QA autenticado local                     | 72 checks responsivos, 54 de tema e 18 rotas a 200%; teclado e reduced-motion aprovados    |
| QA PostgREST/RLS local                   | 9 perfis; 8 negações comerciais, 8 anônimas e dupla afiliação negada; 9/9 contas removidas |

## Cobertura de segurança

- negação anônima;
- ACL exata de RPCs e zero grant direto nos fatos;
- RLS e FORCE RLS em todas as tabelas v3;
- Master, Admin, gestor e corretor;
- isolamento organização/equipe/pessoa;
- tentativa de ampliação por filtro de outro tenant;
- parâmetro extra, malformado, duplicado e array vazio;
- mapping sem owner;
- ID desconhecido e fila de reconciliação;
- target de mapping imutável;
- lineage pai/raiz e falha após suspensão do ancestral;
- lineage delegado negado após expiração de qualquer aresta topológica;
- replay idêntico/noop e replay conflitante;
- grão duplicado;
- timezone inválido;
- literais temporais não ISO/não finitos, timezone incompatível com `Intl` e
  decimal `NaN` rejeitados;
- meses fechados explícitos;
- zero real versus indisponível;
- run rejeitado sem mover ponteiro ativo;
- facts/runs imutáveis;
- ausência de reabertura das permissões v2.
- autoridade exata por dataset/fonte/workflow/produtor e owner ativo;
- decimal textual exato na soma v3 e na leitura Qlik;
- promoção, retry, rejeição e reabertura do ciclo de mapping;
- ingestão e agregação no limite de 10.000 registros.
- cap determinístico de 100 opções com truncamento sinalizado;
- preservação da opção selecionada mesmo quando ela seria a 101ª no catálogo;
- chaves de provenance limitadas a 100 caracteres no TypeScript e no SQL;
- allowlist de timezone comum ao produtor TypeScript e ao banco;
- cobertura parcial e escopo/período sem evidência nunca apresentados como
  zero real;
- manifesto imutável e exato de escopo/run, inclusive para escopo vazio;
- zero atribuição automática das permissões v3 por papel.

## Evidência e limites do QA

O QA visual usou exclusivamente Supabase local, conta dedicada efêmera
`@local.invalid` e dados sintéticos marcados. Cobriu `1440×900`, `1280×720`,
`768×1024`, `390×844`, três temas, teclado, zoom de 200% e reduced-motion; conta
e fixtures foram removidas. As capturas versionadas ficam em
`docs/qa/reference-parity/target-authenticated/` e o resultado estruturado em
`docs/qa/reference-parity/authenticated-results.json`.

As rotas shadow permaneceram desligadas por padrão e sem fonte real publicada.
Sua apresentação, filtros e estados foram cobertos por testes de componentes;
o QA visual autenticado prova a ausência de regressão nas 18 rotas de produção,
não um cutover v3. Nenhuma conta remota, Master/Admin pessoal ou dado real foi
usado.

A revisão independente final encerrou com **0 P0 / 0 P1** após corrigir os
achados de cobertura, opções truncadas, contrato temporal, estado vazio e
lineage topológico. A CI GitHub será registrada no SHA final do PR draft.
Nenhuma validação remota mutável será executada.

## Bloqueio operacional comprovado

Esta conclusão histórica foi supersedida em 10 de agosto de 2026: o publisher
técnico foi identificado e `20260809144143_qlik_rls_contract_hardening.sql` foi
convertida em ponte aditiva que preserva o caminho legado. O relay/mapping
cutover está documentado em [`../qlik-relay-mapping-cutover/`](../qlik-relay-mapping-cutover/README.md).

A pilha ainda não é candidata a aplicação remota: owner operacional/backup,
leitores residuais, restore/drift, credenciais privadas, duas janelas shadow,
canário e autorizações continuam pendentes. Nenhum teste local transforma isso
em autorização de cutover.
