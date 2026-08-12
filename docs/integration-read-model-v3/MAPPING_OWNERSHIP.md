# Ownership e ciclo de vida dos mappings

## Objetivo

Este documento define quem responde por mappings entre fontes externas e o
modelo canônico, como decisões são evidenciadas e como itens não resolvidos
circulam pela fila. O modelo executável está em
[`20260809181422_integration_identity_governance.sql`](../../supabase/migrations/20260809181422_integration_identity_governance.sql);
o consumidor fail-closed está em
[`20260809181424_crm_read_model_v3.sql`](../../supabase/migrations/20260809181424_crm_read_model_v3.sql).

Ownership não concede acesso comercial. Ele atribui responsabilidade por uma
decisão de identidade. RLS e grants de reporting continuam sendo a autoridade
de leitura.

## Papéis operacionais

`private.crm_integration_owners` registra owners estáveis:

| `owner_kind` | Identificador obrigatório | Uso esperado                                |
| ------------ | ------------------------- | ------------------------------------------- |
| `user`       | `auth_user_id`            | Pessoa autenticada responsável pela decisão |
| `team`       | `owner_key`               | Equipe formal de data stewardship           |
| `process`    | `process_key`             | Processo automatizado com operação definida |
| `vendor`     | `owner_key`               | Responsável externo contratual identificado |

Todo owner tem `owner_key`, nome apresentacional, status e timestamps. Desativar
o owner faz seus mappings deixarem de resolver para novas ingestões e leituras
temporais que dependam deles. A desativação exige análise de impacto e owner
substituto; não é mecanismo informal de limpeza.

Responsabilidades mínimas:

| Responsável         | Deve fazer                                                                     | Não pode fazer                                                     |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Owner da fonte      | Confirmar sistema oficial, estabilidade do ID, timezone, cobertura e correções | Declarar nome como ID ou usar transporte como autoridade comercial |
| Mapping owner       | Conferir alvo canônico, vigência, evidência e conflitos                        | Autoaprovar mapping ambíguo ou reapontar versão existente          |
| Business steward    | Confirmar organização, equipe, pessoa e vínculos temporais                     | Substituir prova da fonte por semelhança textual                   |
| Reviewer autorizado | Verificar/rejeitar via RPC auditada e request idempotente                      | Escrever diretamente em tabelas ou apagar histórico                |
| Operador do relay   | Entregar payload validado e observar resultados                                | Possuir a identidade de negócio por ser n8n/relay                  |
| Segurança/DB owner  | Manter ACL, RLS, funções e resposta a incidente                                | Distribuir `service_role` ao workflow n8n                          |

No gate atual, `review_crm_source_identity_mapping(jsonb)` é uma primitiva
owner-only sem grant de Data API. O Master com `crm.ingest.manage` opera somente
o contrato de lote preview/apply, sujeito a autoridade vigente e hashes
revisados. Delegação futura requer nova decisão de papel, migration, testes e
auditoria; não deve ser inferida por nível numérico.

## Estados e ciclo de vida

Há dois ciclos relacionados, mas distintos.

### Item da fila

```text
pending -> assigned -> resolved
                    \-> rejected
```

- `pending`: ingestão observou ID sem mapping verificado vigente.
- `assigned`: owner aceitou investigar; a atribuição ainda não libera dados.
- `resolved`: revisão criou uma versão verificada e ligou o item a ela.
- `rejected`: evidência mostrou que o ID não deve mapear para entidade
  canônica.

O banco já modela os quatro estados. A RPC atual resolve ou rejeita; operação de
`assigned`, SLA e reabertura ainda precisam de contrato administrativo próprio.

### Versão de source identity

```text
pending -> verified -> closed
       \-> rejected -> closed
```

- `pending`: linha ainda não é autoridade para ingestão ou leitura.
- `verified`: exige owner ativo, `verified_at`, `verified_by`, evidência e alvo
  canônico ativo. A revisão exige `effectiveFrom`, persistido como `valid_from`;
  ele não pode estar mais de cinco minutos no futuro.
- `rejected`: exige motivo; não autoriza resolução.
- `closed`: `valid_until` definido; a linha inteira torna-se imutável.

Uma linha `pending` só pode ser promovida quando já aponta para o mesmo alvo; a
promoção auditada fixa seu `valid_from` com o `effectiveFrom` revisado. Uma
versão `verified` vigente nunca é reapontada. Para corrigir um vínculo, uma
rejeição auditada fecha a versão atual e uma nova revisão, com novo `requestId`
e `effectiveFrom`, cria a sucessora. Os intervalos são
`[valid_from, valid_until)` e não podem se sobrepor.

## Fila de reconciliação

`private.crm_identity_reconciliation_items` consolida por
`(source, entity_kind, external_id)`. Cada observação mantém:

- rótulo observado somente para investigação, nunca para matching;
- `source_record_id` que encontrou o problema;
- `reason_code` e run de reconciliação;
- primeira/última ocorrência e contador;
- owner, mapping resultante, resolvedor e timestamp quando concluído.

Prioridade operacional recomendada:

1. IDs de `reporting_scope` e `organization`, pois são obrigatórios e bloqueiam
   qualquer publicação;
2. conflitos que aparecem em vários registros ou datasets;
3. pessoas e equipes, pois podem afetar isolamento horizontal;
4. carteira, origem, empreendimento e local;
5. rejeições recorrentes, que podem indicar contrato de fonte quebrado.

Checklist do analista:

1. confirmar `source` e `entity_kind` sem usar o rótulo como prova;
2. abrir evidência oficial pelo `source_record_id` ou snapshot;
3. localizar o alvo pelo ID oficial/cadastro governado;
4. validar organização, equipe, membership e vigência na data do evento;
5. registrar owner, evidência, motivo e o instante oficial de início da vigência;
6. verificar com `requestId` novo e `effectiveFrom` explícito, ou rejeitar;
7. solicitar novo snapshot ao produtor e reconciliar contagens;
8. encerrar incidente apenas após o novo run publicar sem ampliar escopo.

## Revisão idempotente

Exemplo sanitizado e fictício:

```json
{
  "requestId": "30000000-0000-4000-8000-000000000001",
  "source": "salesforce",
  "entityKind": "person",
  "externalId": "003000000000001AAA",
  "ownerKey": "crm-data-stewards",
  "targetId": "40000000-0000-4000-8000-000000000001",
  "decision": "verify",
  "effectiveFrom": "2026-08-01T00:00:00Z",
  "evidenceReference": "ticket:DATA-DEMO-001",
  "reason": "official_contact_id_confirmed"
}
```

Em `verify`, `effectiveFrom` é obrigatório, finito e deve usar ISO 8601 com
offset explícito (`Z` ou `±HH:MM`) e no máximo seis casas fracionárias. Literais
PostgreSQL como `infinity`, `today` e timestamps sem offset são rejeitados. O
instante representa o começo de vigência comprovado pela evidência, não o
horário em que o analista clicou. Para rejeição, `decision` é `reject`,
`reason` continua obrigatório e não há alvo. Os exemplos não contêm IDs reais.

`private.crm_mapping_commands` guarda `request_id`, ator e SHA-256 do payload.
Mesmo request e mesmo conteúdo retornam noop; mesmo request com conteúdo
diferente — inclusive outro `effectiveFrom` — falha com `23505`. O instante é
persistido como `valid_from` e entra no before/after completo do histórico da
identidade; o command hash vincula a decisão ao payload revisado. Locks advisory
serializam revisões da mesma fonte e do mesmo ID externo.

## Evidência e histórico

Uma verificação só é válida com:

- owner ativo;
- alvo canônico ativo do tipo correto;
- referência de evidência não vazia;
- ator e timestamp de verificação;
- reason code operacional;
- request ID único e payload hash;
- `effectiveFrom` explícito e coerente com a evidência da fonte.

`private.crm_source_identity_history` guarda before/after completo e evento
`created`, `updated` ou `closed`. Na instalação, identidades preexistentes
recebem um evento inicial sanitizado de `created`; assim nenhuma linha herdada
começa sem trilha. `audit_logs` também recebe
`integration.mapping_verify` ou `integration.mapping_reject`, com IDs internos
e motivo. Tokens, credenciais, payloads brutos e PII não devem entrar em
`evidence_reference`, `reason`, logs ou documentação.

Retenção deve preservar pelo menos toda a vida dos fatos que referenciam a
versão. As FKs da identidade para pessoa e organização, e dos eventos v3 para
`crm_source_identities`, usam `ON DELETE RESTRICT`; exclusão não é rotina de
manutenção e não pode apagar o histórico em cascata.

## Ownership do escopo de autorização

Mappings de identidade não substituem grants. Cada grant de reporting tem
lineage privada com:

- grant pai, raiz e profundidade máxima oito;
- papel beneficiário observado;
- origem `bootstrap`, `migration`, `delegated` ou `historical_backfill`;
- propósito, consumidor e `owner_user_id`;
- ação de manutenção e rollback;
- flag `requires_reconciliation`.

Somente o self-grant global do Master, concedido pelo próprio beneficiário e com
motivo exato `Master bootstrap global scope`, é reconhecido como raiz bootstrap.
Qualquer grant histórico sem essa evidência permanece para reconciliação. Grant delegado deve encontrar
parent vigente do ator cujo escopo contenha o escopo filho e cuja janela cubra
a janela do filho. Backfills históricos não-Master ficam
`requires_reconciliation = true` e falham fechados na leitura v3 até revisão.

Suspensão, expiração ou revogação em qualquer ancestral torna o lineage
inefetivo. Revogação de ancestor deve preservar os registros e tratar
descendentes antes de remover capacidade; nunca apagar a cadeia.

## RLS e fronteiras de acesso

Os objetos de owners, fila, histórico, commands e lineage ficam no schema
`private`. `PUBLIC`, `anon`, `authenticated` e `service_role` não recebem acesso
direto a eles.

`crm_source_identities`, catálogos canônicos e tabelas v3 também não são uma API
de escrita para o navegador. As fronteiras permitidas são:

| Operação            | Fronteira                                   | Papel permitido                                                    |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Revisar mapping     | lote preview/apply                          | `authenticated`, Master + `crm.ingest.manage`, autoridade e hashes |
| Mutação elementar   | `review_crm_source_identity_mapping(jsonb)` | somente owner SQL, chamada internamente pelo lote                  |
| Ingerir v3          | `ingest_crm_read_model_v3(jsonb)`           | somente `service_role` via relay controlado                        |
| Listar escopos      | `list_crm_read_model_v3_scopes()`           | `authenticated`, filtrado por grant efetivo                        |
| Ler métricas        | `get_crm_read_model_v3(...)`                | `authenticated`, permissão do dataset + escopo e lineage efetivos  |
| Ler Qlik compatível | `list_scoped_crm_imob_ranking_entries(...)` | `authenticated`, permissão e organização verificadas               |

Todas as funções de fronteira são `SECURITY DEFINER`, têm `search_path = ''`,
timeout e grants exatos. A presença de `service_role` na ingestão não autoriza
acesso direto às tabelas Qlik ou v3 e não autoriza entregar essa credencial ao
n8n.

Na leitura v3, a permissão é selecionada pelo dataset: `funnel` usa
`crm.read_model_v3.view`; `ranking`, `partnerships` e `stock` usam,
respectivamente, `crm.read_model_v3.ranking.view`,
`crm.read_model_v3.partnerships.view` e `crm.read_model_v3.stock.view`. Chave
desconhecida, permissão ausente, escopo nulo, grant fora da vigência ou qualquer
ancestral inelegível falham fechados; listar um escopo por possuir alguma
permissão v3 não autoriza os demais datasets.

## Operação e alertas

Alertar pelo menos quando:

- um ID obrigatório entra na fila;
- `occurrence_count` cresce após atribuição;
- owner de mapping vigente é desativado;
- mesma chave externa aparece em alvos concorrentes ou intervalos sobrepostos;
- request ID é reutilizado com hash diferente;
- run é rejeitado por `unresolved_mappings` ou `quality_blocked`;
- source snapshot chega mais antigo que o run ativo;
- lineage histórico permanece `requires_reconciliation`.

Nenhum alerta autoriza publicação parcial. O run anterior continua ativo até um
snapshot posterior passar por todas as validações.

## Decisões pendentes

1. Owners nominais e backups para Salesforce, Qlik e cada dataset futuro.
2. SLA da fila, regras de assignment, reabertura e escalonamento.
3. Política para delegar, além de Master, a sequência auditada de fechamento e
   criação de versão sucessora.
4. Retenção de history, commands, queue e audit logs.
5. Allowlist de fontes e matriz `source x entity_kind`.
6. Política para owner `process` ou `vendor`: responsável humano/equipe de
   escalonamento continua necessário.
7. Procedimento aprovado para corrigir datas históricas; a proteção estrutural
   contra intervalos sobrepostos já falha fechada.
8. Owner e credencial do caller Qlik; sem resposta, não há cutover remoto.
9. Reconciliação e cascata operacional dos grants históricos não-Master.
10. Canal seguro para evidências sem inserir PII ou segredos no banco.

## Rollback e resposta a incidente

1. Revogar EXECUTE da RPC afetada e desativar o owner comprometido.
2. Não apagar mapping, command, histórico, fila, lineage, run ou fatos.
3. Fechar a versão comprometida e criar sucessora somente após evidência; fatos
   antigos continuam apontando para a versão usada.
4. Marcar usuários/grants afetados para reconciliação ou `legacy_review`.
5. Manter v2 Master-only enquanto v3 estiver pausado.
6. Nunca restaurar matching por nome, acesso Qlik por `anon`, grants diretos de
   tabela a `service_role` ou verifier/token em argumento público.
7. Aplicar rollback estrutural apenas por migration posterior, com pgTAP e
   ensaio em homologação autorizada.
