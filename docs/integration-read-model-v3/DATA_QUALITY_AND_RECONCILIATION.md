# Qualidade de dados e reconciliação

## Estados independentes

O run registra três eixos. Eles não são convertidos em um único booleano:

| Eixo       | Valores                                  | Significado                                          |
| ---------- | ---------------------------------------- | ---------------------------------------------------- |
| Fonte      | `ready`, `stale`, `unavailable`, `error` | condição operacional declarada pelo produtor oficial |
| Qualidade  | `verified`, `warning`, `blocked`         | confiabilidade do payload                            |
| Publicação | `published`, `rejected`                  | se o run pode mover o ponteiro ativo                 |

`ready` não aceita motivo. Todo estado diferente de `ready` exige `statusReason`. `verified` não aceita issues; `warning` e `blocked` exigem códigos. `unavailable` e `error` não aceitam fatos.

## Zero real versus indisponível

- Fonte publicada `ready` com medida `counts`, intervalo integralmente dentro
  da cobertura e escopo solicitado presente no manifesto do run: ausência
  depois da combinação de filtros é zero real.
- Cobertura parcial/desconhecida, período fora dos bounds ou escopo ausente do
  manifesto: resultado fica explicitamente indisponível/atrasado; ausência não
  vira zero.
- Medida não declarada em `availableMeasures`: valor é `null`/“Indisponível”.
- Fonte `unavailable` ou `error`: `metrics` é `null`; nenhum zero comercial é fabricado.
- `sales_amount` disponível: todo fato de venda exige amount, inclusive zero real.
- `sales_amount` indisponível: nenhum fato pode transportar amount.
- Metas e planejamento: sempre indisponíveis nesta etapa.

## Reconciliação de IDs

O produtor envia IDs externos oficiais, nunca nomes para matching. Cada ID é resolvido por:

`source + entity_kind + external_id + occurred_at`

Somente mappings com `mapping_status = verified`, owner ativo, alvo canônico
ativo, evidência, verificador e janela vigente são aceitos. O fato persiste
tanto o UUID canônico quanto o `source_identity_id` usado; mudar um mapping
futuro não reaponta fatos históricos.

Se qualquer ID obrigatório ou fornecido estiver ausente, pendente, expirado ou sem owner:

1. o identificador entra em `private.crm_identity_reconciliation_items`;
2. ocorrências repetidas incrementam contador idempotente;
3. o run é registrado como `rejected:unresolved_mappings`;
4. zero fatos é persistido para o run;
5. o ponteiro ativo não muda.

Se uma ocorrência reaparece depois de resolução ou rejeição, o item volta a
`pending`, perde vínculos de resolução antigos e exige nova decisão. Um Master
com `crm.ingest.manage` pode verificar ou rejeitar pela RPC auditada
`review_crm_source_identity_mapping`. Verificação exige owner ativo, alvo
canônico, evidência e `effectiveFrom`; a data efetiva permite reconciliar fatos
históricos sem reescrever uma versão já fechada. Rejeição encerra a versão
vigente em vez de deixá-la autorizando cargas futuras.

Não há fallback por aproximação textual, lower-case de nome, hash de nome ou primeira ocorrência.

## Meses fechados

`crm_read_model_v3_closed_months` recebe apenas meses explicitamente certificados pelo produtor quando a cobertura é `complete`. O mês precisa:

- começar no dia 1;
- estar integralmente dentro da cobertura;
- ser anterior ao mês da data de referência;
- possuir watermark oficial.

Médias usam somente essa lista. Mês ausente nunca é presumido como zero. Se nenhuma competência foi certificada, média e histórico ficam indisponíveis.

## Integridade e replay

- hash SHA-256 do JSONB canônico; arrays sem ordem comercial (`qualityIssues`,
  `availableMeasures`, `closedMonths` e `records`) são ordenados antes do hash;
- `request_id` único;
- mesmo request/hash retorna noop;
- mesmo request/hash diferente retorna conflito;
- `dataset + source + source_snapshot_id` único;
- grão único `run + stage + source_record_id`;
- snapshot mais antigo ou igual não substitui o ativo;
- runs, fatos e competências publicadas são imutáveis;
- publicação e troca do ponteiro ativo acontecem na mesma transação.

Antes dessas validações, o dataset precisa apontar para uma única autoridade
ativa em `private.crm_read_model_v3_sources`. Tupla, owner, aprovação,
evidência e política de cobertura são verificadas antes de qualquer mapping ou
fato. Nenhuma autoridade real é criada automaticamente.

O manifesto `coveredReportingScopeExternalIds` também participa do hash e da
publicação atômica. Cada ID precisa resolver para mapping de escopo verificado,
owned e ativo; duplicata ou ID desconhecido falha/reconcilia. Todo fato deve
caber em um escopo declarado, e a leitura somente certifica o escopo exato
presente no manifesto. Isso permite declarar com segurança um escopo vazio sem
inferir cobertura a partir de outro descendente.

## Pendências que continuam bloqueadas

- IDs oficiais de gestor, unidade, empreendimento e demais dimensões ainda não existem no extrato Salesforce atual;
- vínculo confiável Salesforce ↔ Qlik não existe;
- estoque não possui contrato oficial;
- regra oficial de média/meta esperada não foi confirmada além da estrutura de meses certificados;
- ownership nominal do caller Qlik não foi localizado.

Enquanto esses itens não forem resolvidos, o comportamento correto é fila/rejeição/indisponível, não inferência.
