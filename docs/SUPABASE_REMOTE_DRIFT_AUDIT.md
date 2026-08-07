# Auditoria do drift remoto do Supabase

## Escopo e referência

- Data: 7 de agosto de 2026.
- Projeto: `descomplica-crm-production`.
- Project ref: `hnncxuerlcsaahdxoswb`.
- Commit auditado: `ff1b64f60fbecb334a542aa2115c35199378aff0`.
- Método: consultas somente leitura no remoto e reset local sem seed com as doze migrations versionadas.

Nenhuma tabela, policy, página, linha ou configuração remota foi alterada durante a auditoria.

## Objetos encontrados somente no remoto

### `crm_imob_ranking_runs`

- Proprietário: `postgres`.
- RLS: habilitada, sem `FORCE ROW LEVEL SECURITY`.
- Registros: 2.
- Finalidade observada: metadados de execução de importações anuais de ranking de imobiliárias.
- Colunas: UUID do run; status; ano; timestamps de geração, fonte, início e conclusão; origem; regional; empresa; quantidade de linhas; erro sanitizado; criação.
- Constraints: chave primária UUID; status limitado a `running`, `succeeded` ou `failed`; ano entre 2020 e 2100; quantidade não negativa; run concluído exige `completed_at`.
- Índice: runs concluídos por `generated_at desc`.
- Policy: `crm_imob_ranking_runs_select_completed`, originalmente para `anon` e `authenticated`, limitada a runs concluídos.

### `crm_imob_ranking_entries`

- Proprietário: `postgres`.
- RLS: habilitada, sem `FORCE ROW LEVEL SECURITY`.
- Registros: 339, ligados aos 2 runs.
- Finalidade observada: valores mensais de VGV, contratos e posições de ranking por imobiliária.
- Colunas: run, mês, chave e nome da imobiliária, VGV, contratos, posições de origem e criação.
- Constraints: chave primária composta; foreign key com `ON DELETE CASCADE`; mês normalizado; chaves/nome válidos; VGV e contratos não negativos; posições positivas quando preenchidas.
- Índices: ranking por VGV e contratos dentro de run/mês.
- Policy: `crm_imob_ranking_entries_select_completed`, originalmente para `anon` e `authenticated`, condicionada a run concluído.

Nenhum trigger, view ou função remota referencia essas tabelas.

## Grants remotos divergentes

`PUBLIC` não possuía grant nas duas tabelas. Grants extras encontrados:

- `anon`: `SELECT` em ambas;
- `authenticated`: `SELECT` em ambas;
- `service_role`: `SELECT`, `INSERT`, `UPDATE` e `DELETE` em ambas.

O repositório não consulta nem grava essas tabelas. Portanto nenhum grant possui caller comprovado. A allowlist correta continua com `authenticated` apenas nas 14 tabelas já usadas pelo SDK SSR e `service_role` apenas com `EXECUTE` em `ingest_crm_salesforce_snapshot(jsonb)`.

## Décima quinta página

- Chave: `crm.partnerships`.
- Caminho: `/app/canal-de-parcerias`.
- Nome: `Canal de Parcerias`.
- Descrição: `Ranking das imobiliárias parceiras`.
- Seção: `crm`.
- Permissão: `crm.ranking.view`.
- Ordem: 65.
- Navegação/estado: ativa.
- Criada no remoto em 5 de agosto de 2026.

O código atual não implementa esse caminho. A migration versiona a identidade sem inventar implementação nem conceder acesso às tabelas Qlik.

## Origem provável

Os dois runs foram concluídos em 6 de agosto de 2026. As origens registradas são `qlik` e `qlik-cloud-history-export`; o DDL conserva como default a identificação do painel comercial Qlik. O primeiro run contém 32 entradas e o segundo 307. O conjunto cobre janeiro a agosto de 2026.

Conclusão provável: objetos foram provisionados por SQL externo para uma integração Qlik de ranking do Canal de Parcerias, imediatamente antes das primeiras cargas. Não há migration, commit, PR, função, trigger ou caller no repositório que prove o executor exato; a atribuição permanece inferência baseada nos metadados persistidos.

## Diferença completa de schema

- Histórico remoto: as mesmas 12 versions/names presentes localmente; nenhuma migration faltante naquele momento.
- Tabelas comuns: 18/18 com hashes idênticos de colunas, defaults, constraints, índices, owner, grants, policies, triggers e comentários.
- Funções `public`/`private`, sequências, schemas e default ACLs comuns: nomes e hashes idênticos.
- Seeds estruturais comuns: 8 papéis, 17 permissões e 58 associações papel/permissão idênticas.
- Dados estruturais divergentes: somente `crm.partnerships`, elevando `app_pages` de 14 para 15.
- Objetos de aplicação apenas remotos: duas tabelas, três índices secundários, duas policies e seus grants descritos acima.
- Objetos opcionais da plataforma apenas remotos: função `rls_auto_enable()` e event trigger `ensure_rls`, ambos já testados como seguros; Data API roles não possuem `EXECUTE`. Eles não são copiados para migrations da aplicação.

## Correção proposta

`20260807001159_reconcile_remote_imob_schema_and_grants.sql`:

1. cria os dois objetos somente quando ausentes e nunca insere dados comerciais;
2. preserva linhas existentes e RLS;
3. mantém as policies nomeadas, remove `anon` do escopo e não concede leitura direta;
4. versiona `crm.partnerships` com `ON CONFLICT DO NOTHING`;
5. revoga grants diretos de todos os Data API roles e recompõe a allowlist comprovada;
6. mantém objetos futuros criados por `postgres` sem grants automáticos;
7. deixa qualquer futura integração Qlik bloqueada até existir RPC/caller auditado.

A migration permanece local até PR e CI completos. Sua aplicação remota exige novo dry-run, backup e execução isolada.
