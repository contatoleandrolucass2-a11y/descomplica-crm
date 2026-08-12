# Comprovação remota do Supabase

## Escopo e método

Observação executada em 2026-08-09 com Supabase CLI `2.111.0`, projeto
mascarado como `hnnc…oswb`, região `ca-central-1` e operações estritamente de
leitura. A versão disponível mais recente da CLI durante a validação era
`2.113.0`; a diferença foi registrada, sem atualização de dependência neste
incremento.

Não foram executados `db push`, SQL de mutação, mudanças de Auth, grants,
policies, dados, Storage, n8n ou deploy. Credenciais e tokens não foram
impressos nem versionados.

## Serviço observado

| Serviço    | Versão/estado observado         |
| ---------- | ------------------------------- |
| PostgreSQL | `17.6.1.155`, saudável          |
| Auth       | `2.195.0`, saudável             |
| PostgREST  | `14.15`, saudável               |
| Storage    | `1.67.26`, saudável             |
| Data API   | schemas `public,graphql_public` |

## Inventário canônico

| Objeto                  |                                                                         Total remoto |
| ----------------------- | -----------------------------------------------------------------------------------: |
| Tabelas `public`        |                                                                                   21 |
| Views `public`          |                                                                                    0 |
| Functions `public`      | 26 de aplicação; 27 entradas no inventário incluindo sobrecargas/contexto catalogado |
| Triggers `public`       |                                        8, mais 1 trigger customizado em `auth.users` |
| Policies `public`       |                                                                                   20 |
| Sequences `public`      |                                                                                    4 |
| Usuários Auth           |                                                                                    3 |
| Buckets/objetos Storage |                                                                                0 / 0 |
| Segredos Vault          |                                                                                    0 |

Todas as 21 tabelas `public` tinham RLS habilitada; nenhuma tinha `FORCE ROW
LEVEL SECURITY`. As extensões remotas eram `pgcrypto`, `pg_stat_statements`,
`supabase_vault`, `uuid-ossp` e `plpgsql`.

O inventário detalhado está em [`REMOTE_INVENTORY.json`](./REMOTE_INVENTORY.json),
checksum SHA-256
`8ef6cb8016025f99369b407e2c75cfd76126dfd07ba2e3b1f9284057026e9825`.

## Migrations

Foram encontradas 20 versões na união local/remota: 13 comuns, 4 somente
remotas e 3 somente locais.

Somente remotas:

| Versão           | Nome                                  |
| ---------------- | ------------------------------------- |
| `20260808235856` | `grant_imob_ranking_service_role`     |
| `20260809004414` | `add_atomic_imob_ranking_publish_rpc` |
| `20260809010942` | `restrict_imob_ranking_rpc_roles`     |
| `20260809031936` | `qlik_ranking_developments`           |

Somente locais no SHA-base:

| Versão           | Arquivo                                       |
| ---------------- | --------------------------------------------- |
| `20260807185611` | `secure_qlik_ingestion_contract.sql`          |
| `20260808174817` | `require_sensitive_access_change_reasons.sql` |
| `20260809024000` | `simulator_visual_catalog.sql`                |

Os statements das migrations remotas continuam presentes em
`supabase_migrations.schema_migrations`. Isso permite comparação de checksum,
mas o dump reconstruído não é tratado como o arquivo SQL histórico original.
A reconciliação proposta é uma migration nova e determinística.

## Grants e policies críticos

No instante observado:

- `anon` tinha `SELECT` e policy nas três tabelas
  `crm_imob_ranking_runs`, `crm_imob_ranking_entries` e
  `crm_imob_ranking_developments`;
- `service_role` tinha CRUD direto nas três tabelas;
- `publish_crm_imob_ranking(jsonb,text)` era `SECURITY DEFINER` e executável
  por `anon` e `service_role`;
- a chamada legada como role `anon` estava ativa: 26 execuções catalogadas,
  com atividade recente durante a observação;
- um teste de negação anônima, deliberadamente read-only, confirmou a
  exposição vigente: 28 runs, 8.476 entries e 168 developments visíveis.

Isso é evidência do risco remoto atual, não autorização para revogar. O caller
precisa ser identificado e migrado antes de qualquer alteração remota.

O cadastro público estava habilitado, senha mínima de 6 caracteres. O trigger
remoto criava perfil ativo e papel `user`, que herdava permissões comerciais.
Esse comportamento é classificado P0 e é corrigido apenas na migration local
proposta, com onboarding `pending` e negação por padrão.

Também foi observado default ACL amplo de `supabase_admin` para futuros objetos
criados pelo Studio. Os defaults versionados de `postgres` permaneciam
fail-closed. Advisors reportaram uma função `SECURITY DEFINER` acessível por
`anon`, treze por `authenticated` a revisar e proteção contra senhas vazadas
desabilitada.

## Consumidores

| Origem             | Consumidor no repositório            | Acesso observado/proposto                                 |
| ------------------ | ------------------------------------ | --------------------------------------------------------- |
| Salesforce         | `app/api/ingest/salesforce/route.ts` | Escrita por RPC específica; sem CRUD direto               |
| Dashboard          | `lib/crm/dashboard/data.ts`          | Quatro read models v2 globais, RLS por permissão          |
| Ranking CRM        | `lib/crm/ranking/data.ts`            | Snapshots/participantes/pontos globais, RLS por permissão |
| Metas              | `lib/crm/goals/data.ts`              | RPC auditada e leitura protegida                          |
| Qlik               | Publisher n8n externo confirmado     | Relay local off; owner formal/backup e leitores pendentes |
| Canal de Parcerias | Página protegida, sem consulta Qlik  | Mantém estado indisponível                                |
| QA privilegiado    | Scripts de stack local               | Usuário efêmero local, nunca conta pessoal                |

## DDL sanitizado

[`REMOTE_DDL_SANITIZED.sql`](./REMOTE_DDL_SANITIZED.sql) tem 171.154 bytes e
SHA-256
`81a0c9f60545839856319e1171aed31ebf56e6274511b00a87f72eef89c18a83`.
Um verificador SHA-256 embutido na função Qlik legada foi substituído por
`[REDACTED_SHA256_VERIFIER]`. O arquivo não contém URL de banco, JWT, e-mail,
project ref completo ou dado de usuário.
