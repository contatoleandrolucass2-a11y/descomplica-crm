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

## Recorrência após a migration e causa confirmada

A migration acima foi aplicada às `00:34:27Z` de 7 de agosto de 2026. Os logs
mostram tentativas de leitura anônima bloqueadas entre `01:41Z` e `03:58Z`. Às
`04:00:30Z`, uma sessão interativa executou exatamente:

- `GRANT SELECT` para `anon` e `authenticated` nas duas tabelas;
- `ALTER POLICY` para incluir `anon` nas duas policies.

O registro identifica `source: POST /mcp` e a identidade OAuth usada pelo
conector Supabase/Codex. Uma consulta somente leitura posterior do mesmo
ambiente usa a mesma identidade. Portanto o executor não foi inferido pelo
owner `postgres`: foi o conector interativo, provavelmente como contorno às
leituras anônimas negadas.

A auditoria da origem excluiu recorrência automática:

- `qlik-ranking-api.service` apenas autentica a requisição e executa o
  exportador local;
- `qlik-ranking-export.cjs` acessa Qlik via Chrome e produz JSON, sem cliente
  PostgreSQL/Supabase ou DDL;
- não existe cron, timer, função, trigger ou job de banco que aplique grants;
- o workflow n8n `ranking imobs` não contém DDL, não possui execução registrada
  e sua credencial `supabaseApi` aponta ao projeto antigo;
- nenhum credential `supabaseApi` do n8n auditado aponta ao projeto novo.

## Correção da recorrência

`20260807185611_secure_qlik_ingestion_contract.sql` torna o caminho esperado
explícito e idempotente:

1. revoga `PUBLIC`, `anon`, `authenticated` e `service_role` das duas tabelas;
2. mantém RLS e restringe ambas as policies a `authenticated`, sem grant de
   tabela que as torne alcançáveis;
3. mantém default privileges de `postgres` fail-closed;
4. cria `ingest_crm_imob_ranking_snapshot(jsonb)`, RPC transacional com
   validação, lock por request, replay idempotente e conflito fail-closed;
5. concede somente `EXECUTE` dessa RPC a `service_role`.

O workflow novo deve usar essa RPC por credencial dedicada e nunca nodes de
escrita direta. `AGENTS.md`, pgTAP e o runbook operacional proíbem o contorno
por grants avulsos.

## Atualização de 9 de agosto de 2026

Uma nova captura somente leitura supersede o estado operacional descrito acima,
sem apagar a cronologia:

- o histórico remoto ganhou quatro versões ausentes do Git;
- o Git ganhou três versões ainda ausentes do remoto;
- o remoto criou `crm_imob_ranking_developments`, reabriu leitura para `anon`,
  concedeu CRUD direto a `service_role` e mantém uma RPC `SECURITY DEFINER`
  legada executável por `anon`;
- `ingest_crm_imob_ranking_snapshot` e o trigger local de motivo sensível
  continuam ausentes no remoto;
- nove runs Qlik atuais provaram caller ativo, sem tornar sua identidade,
  verifier ou frequência uma autoridade segura.

O SQL histórico exato das quatro versões foi localizado em
`supabase_migrations.schema_migrations.statements`. Ele não foi copiado porque
contém verifier e grants incompatíveis com a política atual. A reconciliação
completa, hashes e dump sem secrets estão em
[`docs/reconciliation/README.md`](reconciliation/README.md). Nenhuma escrita,
migration ou correção remota foi feita nessa atualização.

## Atualização de 10 de agosto de 2026

Inspeções adicionais exclusivamente de leitura identificaram o publisher como
o workflow n8n `r4DyPyOTDtoROXq0` (`ranking imobs`), ativo em agenda de 30
minutos. Vinte e sete execuções bem-sucedidas correlacionaram 1:1 com runs
`succeeded`; a execução retida com erro não criou run. O owner técnico observado
é Leandro Lucas (`global:owner`), sem backup encontrado. Leituras `GET` diretas
continuam sem atribuição.

A migration local `20260809144143` foi ajustada antes de qualquer aplicação
remota para preservar a RPC legada. A nova fundação
`20260810165927_qlik_relay_mapping_cutover` adiciona relay/gates/mappings vazios
e desligados por padrão. Nenhuma das duas foi aplicada remotamente; n8n,
Supabase, Qlik, VPS, DNS e Nginx permaneceram inalterados.
