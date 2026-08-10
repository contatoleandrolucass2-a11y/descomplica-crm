# Relatório de validação

## Identificação

- Data UTC: 10 de agosto de 2026.
- Branch-base: `codex/integration-read-model-v3`.
- SHA-base: `96d48b0e64ad85c5020d4ec69b6f1dd0bf408e08`.
- Branch: `codex/qlik-relay-mapping-cutover`.
- Migration nova: `20260810165927_qlik_relay_mapping_cutover.sql`.
- SHA-256 da migration nova:
  `d8b7788f4f5809cc5297919818bcd265a2d1259b952b7583bb239c0406e661d5`.

## Resultado funcional e de segurança

- relay HMAC implementado, `off` por padrão e sem credenciais montadas pelo
  configurador quando desligado;
- papel PostgreSQL dedicado `NOLOGIN`; nenhuma credential ou gate seedado;
- wrapper única, sem acesso direto a tabelas, ligada a `session_user`, atributos
  e ACLs exatos, sem `GRANT OPTION`;
- readiness local permanece `false` pelos grants estruturais `PUBLIC` de
  `pg_net` e banco; qualquer `LOGIN` falha fechado;
- duas janelas shadow e duas canary exigidas antes de `active`;
- manifesto de mappings com preview padrão, hash canônico TS/SQL, conflitos,
  plano vigente, apply atômico e replay validado;
- primitiva elementar de mapping owner-only; Data API não contorna autoridade,
  lote ou hashes;
- zero owner, mapping, organização, equipe, carteira, responsável ou valor
  comercial inventado.

## Gates executados

| Gate                             | Resultado                                               |
| -------------------------------- | ------------------------------------------------------- |
| Node / pnpm / Supabase CLI       | `24.19.0` / `11.20.0` / `2.111.0`                       |
| `pnpm install --frozen-lockfile` | verde; lockfile íntegro                                 |
| `pnpm lint`                      | verde                                                   |
| `pnpm typecheck`                 | verde                                                   |
| `pnpm test`                      | 193 Vitest aprovados, 1 skip esperado; 8 Node aprovados |
| `pnpm build`                     | verde; 37 páginas geradas, incluindo `/api/ingest/qlik` |
| reset Supabase local             | verde; 21 migrations aplicadas do zero                  |
| `pnpm db:test`                   | 16 arquivos; 770/770 pgTAP aprovados                    |
| pgTAP relay/mappings             | 86/86 aprovados                                         |
| DB security/performance advisors | zero achados                                            |
| `pnpm audit --audit-level high`  | zero vulnerabilidades conhecidas                        |
| OSV Scanner                      | zero achados em 519 pacotes                             |
| Gitleaks tree / history          | zero leaks no tree e no histórico completo              |
| Actionlint / ShellCheck          | verdes                                                  |
| `git diff --check`               | verde                                                   |
| Prettier no escopo alterado      | verde                                                   |

`supabase db lint --local --level warning` terminou com código zero e nenhuma
advertência nova. Permanecem somente duas advertências já presentes no
SHA-base, ambas na inicialização de arrays UUID de
`public.ingest_crm_read_model_v3`; esta branch não altera essa função.

O `pnpm format:check` global preserva a dívida do SHA-base: 11 arquivos de
skills em `.agents/` e `docs/qa/login-visual/results.json`. Nenhum deles foi
alterado neste incremento; todos os arquivos tocados passaram no Prettier.

Dois reviewers independentes encerraram a revisão com zero P0/P1 residual: um
para relay/ACL/runbooks e outro para canonicalização, replay, autorização e
atomicidade dos mappings.

Não houve alteração visual de layout ou componente; somente o aviso textual da
página shadow do Canal de Parcerias foi atualizado com o caller confirmado. O
build e os testes de contrato cobrem a regressão deste incremento; nenhuma conta
QA remota foi usada.

## Inspeção remota somente leitura

O inventário confirmou o workflow n8n `r4DyPyOTDtoROXq0` (`ranking imobs`) como
publisher ativo, com papel efetivo `anon`; 27 de 27 execuções bem-sucedidas
correlacionaram com runs. O owner técnico foi identificado nos metadados. Owner
operacional formal, backup owner e leitores `GET` residuais continuam pendentes.
Nenhum valor de credential foi coletado ou registrado.

## Bloqueios e estado remoto

- nenhuma migration remota foi aplicada;
- nenhum dado, grant, policy, role, credential ou flag remota foi alterado;
- nenhum workflow n8n, Salesforce ou Qlik foi modificado;
- nenhum VPS, container, DNS ou Nginx foi alterado;
- não houve canário, cutover, hardening destrutivo, merge ou deploy.

A ativação exige autorização futura separada, owner/backup formalizados,
leitores residuais resolvidos, backup/restore comprovado, remediação de ACL por
`supabase_admin`/owners dos bancos, readiness `true`, identidade
`session_user = 'crm_qlik_relay'` validada no endpoint escolhido e execução do
runbook 2 shadow + 2 canary.
