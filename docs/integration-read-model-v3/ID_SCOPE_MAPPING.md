# IDs canônicos e mapeamento de escopo do read model v3

## Objetivo e estado

Este documento define o contrato local entre IDs oficiais das fontes, entidades
canônicas do CRM e escopos de leitura. Ele descreve as migrations
[`20260809181422_integration_identity_governance.sql`](../../supabase/migrations/20260809181422_integration_identity_governance.sql)
e
[`20260809181424_crm_read_model_v3.sql`](../../supabase/migrations/20260809181424_crm_read_model_v3.sql),
além do schema TypeScript em
[`lib/crm/read-model-v3/contracts.ts`](../../lib/crm/read-model-v3/contracts.ts).

O gate é aditivo e local. Ele não identifica nem troca callers remotos, não
publica dados de produção e não transforma os nomes legados do Salesforce em
identidades.

## Invariantes

1. Autorização usa UUID canônico e `reporting_scope_id`, nunca nome, apelido,
   posição em ranking ou chave calculada a partir de nome.
2. Cada ID externo é interpretado dentro de `(source, entity_kind)`. O mesmo
   texto em fontes ou tipos diferentes não representa a mesma entidade.
3. Só uma versão `verified`, vigente no instante do evento, com owner ativo e
   alvo canônico ativo pode resolver uma dimensão.
4. O produtor envia IDs externos. A RPC resolve e persiste tanto o UUID
   canônico quanto o `crm_source_identities.id` exato usado na resolução.
5. Mapping ausente, expirado, pendente, rejeitado ou sem owner ativo não ganha
   fallback global. O lote inteiro é rejeitado e o ID vai para reconciliação.
6. Toda dimensão de um evento deve pertencer à mesma topologia canônica e ao
   escopo declarado para aquele evento.
7. `workflowKey` e `producerKey` identificam transporte/processo; não são IDs
   de pessoa, organização ou escopo. n8n nunca é autoridade de identidade.
8. Cobertura de escopo é manifesto imutável do run. Fato descendente não prova
   cobertura do escopo solicitado e ausência sem manifesto nunca vira zero real.

## Camadas de identidade

| Camada            | Exemplo de campo       | Autoridade                     | Uso                                          |
| ----------------- | ---------------------- | ------------------------------ | -------------------------------------------- |
| Registro da fonte | `sourceRecordId`       | Sistema oficial do dataset     | Grão imutável do evento dentro de `stageKey` |
| ID externo        | `brokerExternalId`     | Fonte indicada por `sourceKey` | Busca versionada em `crm_source_identities`  |
| Versão do mapping | `broker_identity_id`   | Revisão governada do CRM       | Prova histórica de qual mapping foi usado    |
| ID canônico       | `broker_id`            | Cadastro canônico do CRM       | Filtros, joins, agregação e topologia        |
| Escopo canônico   | `reporting_scope_id`   | `crm_reporting_scopes`         | Limite de autorização da leitura             |
| Rótulo            | `display_name`, `name` | Cadastro apresentacional       | Interface; nunca matching ou autorização     |

Os tipos de identidade externa aceitos são:

| `entity_kind`     | Alvo canônico exclusivo   |
| ----------------- | ------------------------- |
| `person`          | `crm_people.id`           |
| `organization`    | `crm_organizations.id`    |
| `team`            | `crm_teams.id`            |
| `portfolio`       | `crm_portfolios.id`       |
| `reporting_scope` | `crm_reporting_scopes.id` |
| `origin`          | `crm_origins.id`          |
| `development`     | `crm_developments.id`     |
| `location`        | `crm_locations.id`        |

Cada linha de `crm_source_identities` aponta para exatamente um desses alvos.
Correções não reapontam a linha existente: encerram a versão com
`valid_until` e criam outra linha.

## Contrato canônico de ingestão

O envelope v3 usa `schemaVersion: 3` e exige:

- `requestId` UUID para idempotência semântica;
- `datasetKey`: `funnel`, `ranking`, `partnerships` ou `stock`;
- `sourceKey`, `workflowKey` e `producerKey` com chaves estáveis de até 100
  caracteres;
- `sourceSnapshotId` único por dataset e fonte;
- `referenceDate`, timezone IANA e timestamps com offset;
- cobertura `complete`, `partial` ou `unknown` com limites coerentes;
- estado da fonte, qualidade, medidas disponíveis e meses explicitamente
  fechados;
- `coveredReportingScopeExternalIds`, com 1 a 1.000 escopos únicos quando um
  run `ready` ou `stale` publica cobertura consultável;
- no máximo 10.000 registros e 8 MiB por chamada.

O grão de evento é `(run_id, stage_key, source_record_id)`. No payload, a
combinação `(stageKey, sourceRecordId)` não pode repetir. `occurredAt` define
qual versão temporal do mapping é válida; `commercialDate` deve corresponder ao
timezone declarado.

As dimensões mínimas de cada registro são:

- `reportingScopeExternalId`;
- `organizationExternalId`.

São opcionais `teamExternalId`, `portfolioExternalId`, IDs de coordenador,
gerente e corretor, origem, empreendimento e local. Qualquer pessoa exige uma
equipe oficial. A RPC ainda confirma, no instante do evento:

- equipe, origem, empreendimento e local pertencem à organização;
- carteira contém a organização;
- coordenador, gerente e corretor têm membership vigente na equipe e papel
  compatível;
- o escopo resolvido corresponde à organização, equipe, carteira ou pessoa do
  evento.

Exemplo sanitizado e fictício:

```json
{
  "schemaVersion": 3,
  "requestId": "10000000-0000-4000-8000-000000000001",
  "datasetKey": "funnel",
  "sourceKey": "salesforce",
  "workflowKey": "crm-funnel-export-v3",
  "producerKey": "crm-integration-relay",
  "sourceSnapshotId": "snapshot-demo-2026-08-09t1200z",
  "referenceDate": "2026-08-09",
  "timezone": "America/Sao_Paulo",
  "generatedAt": "2026-08-09T15:00:00Z",
  "sourceUpdatedAt": "2026-08-09T14:55:00Z",
  "coverage": {
    "start": "2026-07-01",
    "end": "2026-08-09",
    "status": "complete"
  },
  "sourceStatus": "ready",
  "statusReason": null,
  "qualityStatus": "verified",
  "qualityIssues": [],
  "availableMeasures": ["counts", "sales_amount"],
  "coveredReportingScopeExternalIds": ["scope-team-demo-01"],
  "closedMonths": ["2026-07-01"],
  "records": [
    {
      "sourceRecordId": "006000000000001AAA",
      "stageKey": "sales",
      "occurredAt": "2026-08-08T18:30:00Z",
      "commercialDate": "2026-08-08",
      "amount": "125000.00",
      "dimensions": {
        "reportingScopeExternalId": "scope-team-demo-01",
        "organizationExternalId": "001000000000001AAA",
        "teamExternalId": "team-demo-01",
        "brokerExternalId": "003000000000001AAA",
        "developmentExternalId": "development-demo-01"
      }
    }
  ]
}
```

Os valores acima não existem em produção e não devem ser usados como seed.
Nenhum `*Name` participa da resolução.

## Resolução, publicação e fila

Para cada dimensão, a ingestão procura exatamente:

```text
source = sourceKey
entity_kind = tipo esperado
external_id = valor recebido
mapping_status = verified
valid_from <= occurredAt < valid_until, quando houver fim
mapping_owner ativo
```

O manifesto usa o mesmo resolvedor estrito. Cada fato precisa estar contido em
pelo menos um escopo manifestado. Na leitura, somente presença exata do escopo
solicitado certifica cobertura; descendentes não certificam o pai.

Se qualquer dimensão obrigatória, informada ou manifestada não resolver, a RPC:

1. cria ou atualiza `private.crm_identity_reconciliation_items` com
   `reason_code = verified_mapping_missing`;
2. incrementa `occurrence_count` e atualiza `last_seen_at` nas recorrências;
3. grava o run como `rejected`, qualidade `blocked`, zero registros publicados
   e razão `unresolved_mappings`;
4. não altera o run ativo do dataset.

Depois da correção, o produtor deve gerar novo `requestId` e novo
`sourceSnapshotId`. Runs rejeitados são imutáveis; repetir o mesmo request e
payload devolve noop, e reutilizar o request com conteúdo diferente falha com
`23505`.

## Histórico e versionamento

Campos de identidade, alvo e `valid_from` são imutáveis. O histórico privado
registra `created`, `updated` e `closed`, com registros anterior/novo, ator Auth
quando presente, processo da sessão e timestamp.

O procedimento de substituição é:

1. bloquear a chave `(source, entity_kind, external_id)`;
2. encerrar a versão atual definindo `valid_until`;
3. registrar evidência e owner para a nova decisão;
4. criar uma nova linha verificada com novo `id` e intervalo sem sobreposição;
5. reexecutar reconciliação e validar fatos nos dois lados da fronteira.

Eventos v3 antigos permanecem presos ao UUID canônico e ao ID da versão de
mapping gravados no fato. A leitura Qlik de compatibilidade resolve a versão
vigente em `run.generated_at`; por isso as versões antigas não podem ser
apagadas nem ter seus intervalos sobrepostos.

## Escopo e RLS

As tabelas de runs, eventos, manifesto de cobertura por escopo, meses fechados
e ponteiro de run ativo têm RLS e `FORCE ROW LEVEL SECURITY`, mas não concedem
acesso direto a `anon`, `authenticated` ou `service_role`.

- Escrita: somente `ingest_crm_read_model_v3(jsonb)`, concedida exatamente a
  `service_role`; a função valida e publica atomicamente.
- Descoberta: `list_crm_read_model_v3_scopes()`, somente `authenticated`.
- Leitura: `get_crm_read_model_v3(dataset, scope, filters)`, somente
  `authenticated`.
- Autorização: perfil e role/scope válidos, permissão específica do dataset
  (`.view` do funil, ranking, parcerias ou estoque), grant vigente e lineage
  efetivo.
- Filtros: UUIDs canônicos disponíveis no escopo selecionado; valor ausente no
  escopo falha, em vez de ampliar ou consultar outro tenant.

Os antigos `crm.dashboard.view` e `crm.ranking.view` não são substitutos das
permissões v3. O v2 permanece global, nas rotas de produção, e não pode ser
reaberto a papéis não-Master.

## Decisões pendentes

1. IDs oficiais de gerente, equipe/unidade, origem e empreendimento no
   Salesforce; nomes atuais não atendem ao contrato.
2. Ligação oficial entre Account Salesforce, `imobKey` Qlik e organização
   canônica.
3. Allowlist de `sourceKey` e autoridade que pode criar cada tipo de mapping.
4. Política operacional de correção de uma janela temporal já publicada; o
   banco já rejeita sobreposição por chave externa.
5. Política de correção retroativa: novo snapshot, janela afetada e
   reconciliação de totais.
6. Contrato oficial dos datasets `ranking`, `partnerships` e `stock`; a enum
   existe, mas isso não prova fonte pronta.
7. Identidade e credencial do caller Qlik antes de qualquer cutover remoto.
8. Critério de promoção de permissões v3 para papéis não-Master.

## Rollback seguro

Rollback desativa o uso, não apaga evidência:

1. revogar EXECUTE das RPCs v3 e remover a permissão v3 dos papéis afetados;
2. manter runs, eventos, versões de mapping, fila e histórico intactos;
3. retornar contas não reconciliadas a `legacy_review`;
4. manter read models v2 somente para Master durante investigação;
5. nunca restaurar acesso direto às tabelas Qlik, RPC `anon` ou matching por
   nome;
6. fazer qualquer reversão estrutural somente por nova migration revisada.
