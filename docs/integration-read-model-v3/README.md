# Integrações e read model v3

## Estado real do rollout

Esta branch implementa uma fundação v3 aditiva e local. As rotas canônicas de
produção e o catálogo `app_pages` continuam apontando para a leitura atual/v2:
`/app`, `/app/etapas/*`, `/app/ranking` e `/app/canal-de-parcerias`. Nenhuma
dessas rotas foi substituída, e nenhuma rota v3 foi adicionada à navegação.

O v3 está disponível somente como shadow autenticado em URLs separadas:

| Superfície shadow                       | Dataset        | Gate de permissão                     |
| --------------------------------------- | -------------- | ------------------------------------- |
| `/app/read-model-v3`                    | `funnel`       | `crm.read_model_v3.view`              |
| `/app/read-model-v3/etapas/*`           | `funnel`       | `crm.read_model_v3.view`              |
| `/app/read-model-v3/ranking`            | `ranking`      | `crm.read_model_v3.ranking.view`      |
| `/app/read-model-v3/canal-de-parcerias` | `partnerships` | `crm.read_model_v3.partnerships.view` |

Não existe página shadow de estoque. As páginas acima ficam ocultas com `404`
a menos que a configuração server-only explícita seja
`CRM_READ_MODEL_V3_SHADOW_ENABLED=true`. Valores genéricos como `1` ou `yes` não
ativam o gate. Mesmo com a flag, o usuário precisa estar autenticado, possuir a
permissão exata do dataset e escolher ou receber um escopo efetivo validado pela
RPC.

**A flag, sozinha, não é cutover de produção.** Ela não altera `app_pages`, a
navegação, as rotas v2, producers, grants remotos, ponteiros de dataset ou dados.
Nada desta etapa foi aplicado a produção, Supabase remoto, n8n, Salesforce,
Qlik, VPS, DNS ou Nginx.

## Fundação implementada

- identidades externas versionadas, com status, owner, evidência e vigência;
- dimensões canônicas de origem, empreendimento e localização;
- fila privada de reconciliação, sem associação por nome;
- lineage pai/raiz dos grants de escopo;
- snapshots e fatos v3 imutáveis;
- manifesto imutável de cobertura por run e escopo, inclusive para escopos
  certificados sem fatos;
- ingestão idempotente por RPC exclusiva de `service_role`;
- leitura por RPC exclusiva de `authenticated`, com permissão por dataset e
  escopo explícito;
- filtros de período, organização/House, equipe, carteira, coordenador, gestor,
  corretor, origem, empreendimento e região/stand;
- estados separados de pronto, vazio real, atrasado, indisponível e erro; zero
  real exige cobertura temporal e manifesto exato do escopo;
- valores monetários transportados como strings decimais exatas, sem conversão
  para `number` no contrato;
- hash semântico canônico para replay idempotente;
- prova pgTAP de ingestão e leitura escopada no limite de 10.000 fatos.

## Autoridade obrigatória da fonte

Uma carga não se autoriza pelos campos do próprio payload. Antes da ingestão, a
tupla exata privada
`dataset_key + source_key + workflow_key + producer_key` precisa existir em
`private.crm_read_model_v3_sources`, estar ativa e apontar para um owner ativo.
Uma autoridade ativa exige `approved_at`, `approved_by` e
`evidence_reference`. Quando `require_complete_coverage = true`, cargas
legíveis (`ready` ou `stale`) também exigem cobertura `complete`. Há no máximo
uma autoridade ativa por dataset.

Cada ID externo informado continua sujeito a uma versão de
`crm_source_identities` verificada, vigente, evidenciada e pertencente a owner
ativo. Nomes externos são apenas rótulos; autorização e agregação usam UUIDs
canônicos.

## Decisão de segurança

O caller Qlik ativo foi caracterizado tecnicamente, mas seu processo e
proprietário nominal não foram identificados. Ele ainda usa o endpoint legado
com papel `anon` e verificador no argumento. Aplicar o hardening antes de criar
e validar um relay quebraria a carga. Por isso:

1. não há cutover Qlik nesta branch;
2. não há migration nem grant remoto;
3. o dataset v3 de parcerias permanece indisponível até publicação oficial;
4. a leitura Qlik legada local aceita somente mappings verificados, owned e
   vigentes.

## Permissões de rollout

Os quatro gates v3 são catalogados, mas esta migration concede **zero heranças
automáticas de papel**, inclusive para `master`:
`crm.read_model_v3.view`, `crm.read_model_v3.ranking.view`,
`crm.read_model_v3.partnerships.view` e `crm.read_model_v3.stock.view`. As provas
criam grants sintéticos somente dentro da transação pgTAP. Ativação real exige
migration posterior, depois de a aplicação reconhecer as chaves e de o rollback
para a imagem anterior estar protegido.

## Fontes de autoridade

| Assunto                                               | Autoridade versionada                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Identidades, ownership, reconciliação e lineage       | `supabase/migrations/20260809181422_integration_identity_governance.sql`                                             |
| Runs, fontes privadas, ingestão, filtros e leitura v3 | `supabase/migrations/20260809181424_crm_read_model_v3.sql`                                                           |
| Contrato TypeScript v3                                | `lib/crm/read-model-v3/contracts.ts`                                                                                 |
| Gate server-only do shadow                            | `lib/crm/read-model-v3/config.ts`                                                                                    |
| Parser determinístico de URL                          | `lib/crm/read-model-v3/filters.ts`                                                                                   |
| Loader server-only                                    | `lib/crm/read-model-v3/data.ts`                                                                                      |
| Provas pgTAP                                          | `supabase/tests/read_model_v3.test.sql`                                                                              |
| Provas TypeScript                                     | `tests/read-model-v3-config.test.ts`, `tests/read-model-v3-contracts.test.ts`, `tests/read-model-v3-filters.test.ts` |

## Pacote documental

- [Inventário do caller Qlik](QLIK_CALLER_INVENTORY.md)
- [Consumidores de service role](SERVICE_ROLE_CONSUMERS.md)
- [IDs e escopos](ID_SCOPE_MAPPING.md)
- [Ownership dos mappings](MAPPING_OWNERSHIP.md)
- [Lineage de grants](GRANT_LINEAGE.md)
- [Read model v3](READ_MODEL_V3.md)
- [Matriz de filtros e escopos](FILTER_SCOPE_MATRIX.md)
- [Qualidade e reconciliação](DATA_QUALITY_AND_RECONCILIATION.md)
- [Cutover e rollback](CUTOVER_AND_ROLLBACK.md)
- [Relatório de validação](VALIDATION_REPORT.md)
- [Decisões restantes](REMAINING_DECISIONS.md)

## Limites mantidos

Não foram implementados motores de simuladores, ranking avançado, pesos, bônus,
roleta, prêmios, campanhas, estoque, metas presumidas ou qualquer fórmula
comercial sem autoridade oficial. O v3 entrega fatos, contagens, somas declaradas
disponíveis e conversão estrutural entre volumes adjacentes. Metas e planejamento
permanecem `indisponível`.
