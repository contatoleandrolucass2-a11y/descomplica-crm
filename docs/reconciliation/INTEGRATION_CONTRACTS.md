# Contratos de integração: Salesforce, n8n, Qlik e estoque

> Supersessão aditiva: o contrato canônico de publicação e leitura dimensional
> está em `docs/integration-read-model-v3/READ_MODEL_V3.md` e
> `lib/crm/read-model-v3/contracts.ts`. Os contratos v1/v2 abaixo permanecem
> documentados para reconciliação e rollback; não autorizam associação por nome
> nem abertura de leitura global.

## Resultado da busca

Foram esgotados código, workflows exportados, migrations, schemas, read models,
fixtures, testes, documentação, refs Git, PRs e configurações locais acessíveis.
Não foram alterados workflows nem sistemas remotos.

Há contratos comprováveis para os sete relatórios Salesforce, o snapshot
agregado v2 e o ranking Qlik v1 de imobiliárias. Não foi localizada fonte
oficial tipada para estoque, perdas por SLA, empresas, gerentes, unidades ou
empreendimentos como cadastros independentes. Esses domínios permanecem
indisponíveis; nomes encontrados nas atividades não são identidade segura.

Os schemas executáveis deste gate estão em
[`lib/crm/integrations/contracts.ts`](../../lib/crm/integrations/contracts.ts).
Eles validam as projeções conhecidas e rejeitam campos extras. Não ativam
integração nem autorizam escrita.

## Mapa ponta a ponta

| Fluxo               | Fonte/workflow                                                                          | Frequência                                                               | Destino interno                                              | Contrato e estado                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Salesforce bruto    | Analytics Reports API `v61.0`; sete report IDs versionados                              | Legado comprovado a cada 30 min; candidata sem agenda ativa              | Exportador local autorizado                                  | Projeção tipada por relatório; sessão Chrome/MFA; candidata não ativa                             |
| Salesforce agregado | `salesforce_n8n_v1`                                                                     | Somente após coleta completa                                             | `POST /api/ingest/salesforce`                                | JSON v2, Bearer M2M, 1 MB, Zod estrito, RPC transacional; remoto contém última base válida        |
| Refresh Salesforce  | Route Handler → webhook configurado                                                     | Manual, com lock/cooldown                                                | `POST /api/refresh/salesforce`                               | Sessão + permissão + mesma origem; capacidade desativada por padrão                               |
| n8n candidato       | `Descomplica CRM - Salesforce Ingest Candidate (inactive)`                              | Nenhuma agenda                                                           | Webhook candidato local do n8n                               | Aceita envelope direto ou `body`; valida forma/PII e responde 202; sem credencial ou node externo |
| Qlik imobiliárias   | origem `qlik:23.1-painel-comercial-vendas`; caller atual não identificado com segurança | 9 runs observados em 4h14, média 31,7 min; runbook legado fala em 60 min | Contrato local pretendido `ingest_crm_imob_ranking_snapshot` | v1, máximo 5.000 entries, idempotente; RPC segura ausente no remoto e RPC legada exposta          |
| Estoque             | Alteração externa no workflow antigo `Funil de Vendas`                                  | Não comprovada                                                           | Projeto Supabase antigo, fora deste CRM                      | Sem export, schema, ID, endpoint ou baseline seguros; bloqueado                                   |

As frequências Qlik de 31,7 e 60 minutos são evidências divergentes, não uma
política. O workflow/caller que produziu os runs remotos deve ser identificado e
rotacionado antes de qualquer troca.

## Fonte Salesforce

### Execução e paginação

O exportador usa uma sessão `sid` já autenticada por Chrome/MFA; ele não renova
nem contorna MFA. Para cada relatório, faz `describe`, inicia uma instância da
Analytics API, consulta a cada 1,5 s e falha após 180 s. Se `allData=false`,
divide recursivamente o intervalo de datas ao meio; limite atingido em um único
dia falha fechado. Relatórios datados cobrem de 1º de janeiro até a data de
referência. Corretores e contas Canal Imob não usam recorte de data.

O resultado candidato é escrito atomicamente, com arquivo temporário e modo
`0600`. Cookie, IDs brutos e PII não entram no payload agregado.

### Relatórios e identidades

| Domínio                 | Report ID            | Campos projetados e tipos                                                                                                 | ID/deduplicação                                                | Inclusão, exclusão e lacunas                                                                                                |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Oportunidades           | `00OU600000DrfDeMAJ` | `recordId`, `name`, `createdAt`, `brokerName`, `managerName`, `realEstateName`, `businessUnit`, `development`: texto/data | ID Salesforce 006; fallback atual por nome                     | Linhas sem ambos ID/nome não contam; recorte por criação; nenhum status/fase é projetado                                    |
| Agendamentos            | `00OU600000ELaA6MAL` | `appointmentCode`, `createdAt`, corretor, gerente, imobiliária, empreendimento, `accountSource`, campanha                 | Código de agendamento                                          | Código vazio é excluído pela deduplicação; data usa `Activity.CreatedDate`                                                  |
| Visitas                 | `00OU600000EboNZMAZ` | `appointmentCode`, `attendedAt` e mesmas dimensões da atividade                                                           | Código de agendamento                                          | Não exige agendamento correspondente; divergência vira diagnóstico, não descarte                                            |
| Pastas                  | `00OU600000EjufWMAR` | ID da avaliação, oportunidade ID/nome, crédito, criação, corretor, gerente, imobiliária, unidade, empreendimento, status  | ID a1V; fallback por `creditName`                              | Todas as pastas únicas entram no dashboard; ranking conta status normalizado `Análise aprovada`                             |
| Vendas                  | `00OU600000EjFyyMAF` | oportunidade ID/nome, `saleDate`, dimensões e `amount`                                                                    | ID da oportunidade; fallback por nome                          | Vendas sem oportunidade no recorte permanecem e viram diagnóstico; valor negativo é normalizado para zero no agregado atual |
| Corretores              | `00OTT000009j0l32AA` | `contactId`, `name`, `status`                                                                                             | ID Contact 003; `brokerKey` persistido é hash SHA-256 truncado | Ranking inclui status normalizado `Ativo` ou `Reativado`; demais ficam fora                                                 |
| Imobiliárias Canal Imob | `00OU6000006RqzxMAC` | `accountId`, `name`                                                                                                       | ID Account 001; exportador elimina pares repetidos             | Conta precisa ter ID e nome; conjunto por nome normalizado define a visão Canal Imob                                        |

Risco de mapeamento: `opportunityRecordId` de pastas lê o `recordId` da coluna
`Avaliacao_credito__c.Oportunidade__c.Gerente_regional__c`. O resultado de
baseline foi conciliado por ID e nome, mas o caminho da coluna parece
incompatível com a semântica declarada. Deve ser confirmado no describe
oficial; este gate não o corrige nem o promove a regra.

### Domínios sem cadastro próprio

| Domínio pedido  | Evidência atual                                                                             | Estado seguro                                                                    |
| --------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Gerentes        | Apenas `managerName` nas cinco atividades; “último nome observado” é escolhido por corretor | Incompleto; sem ID, vigência ou vínculo oficial                                  |
| Empresas        | `realEstateName`, `businessUnit` e company fixo no Qlik não formam cadastro                 | Ausente                                                                          |
| Imobiliárias    | Quatro contas Canal Imob com ID; Qlik possui `imobKey`; vínculo cruzado não existe          | Parcial e não reconciliado                                                       |
| Empreendimentos | Nome nas atividades e chave/nome no Qlik developments remoto                                | Parcial; sem ID Salesforce comum nem contrato seguro de developments             |
| Unidades        | Texto `businessUnit`; Qlik tem unidade na tabela remota de developments                     | Parcial; sem catálogo/ID oficial                                                 |
| Estoque         | Workflow antigo sofreu alteração externa, mas export/schema não estão disponíveis           | Bloqueado e fail-closed                                                          |
| VGV             | Salesforce usa `amount` das vendas; Qlik usa `vgv` por imobiliária                          | Duas métricas com grão distinto; não somar nem reconciliar sem definição oficial |
| Perdas por SLA  | Nenhum campo, relatório, fórmula ou baseline localizado                                     | Ausente                                                                          |

### Datas, fuso e moeda

- Instantes finais usam ISO 8601 com offset; recortes comerciais usam
  `America/Sao_Paulo`.
- A transformação aceita data ISO, `YYYY-MM-DD` e formato local observado; data
  inválida não entra no período e deve aparecer em diagnóstico futuro.
- Mês, semana e hoje são calculados no fuso oficial, não no navegador.
- A projeção Salesforce pode receber valor de venda numérico ou texto bruto. A
  transformação atual usa `Number`; o contrato agregado exige número finito,
  não negativo, até `10^15`.
- O PostgreSQL usa `numeric(18,2)` para persistir VGV Qlik. O contrato
  TypeScript de novos produtores exige decimal textual exato; a RPC legada
  mantém aceitação SQL compatível de número JSON, sem passar por aritmética
  binária. A leitura escopada serializa `vgv` como texto. Nenhum navegador ou
  motor deve usar `number` binário como autoridade financeira.

### Transformação e contagem

As chaves atuais de deduplicação são: oportunidade ID/nome, código de
agendamento, código de visita, pasta ID/nome e venda oportunidade ID/nome. A
primeira ocorrência vence; duplicidades são contadas no diagnóstico. Isso é
implementação localizada, não política oficial de registros atrasados ou
remoção lógica.

O agregado contém exatamente três visões (`all`, `with_canal_imob`,
`without_canal_imob`), cinco etapas e quatro períodos de ranking. Visitas,
pastas e vendas órfãs não são descartadas. Top empreendimentos conta
oportunidades únicas. Metas e roleta indisponíveis usam zero apenas como
armazenamento técnico, acompanhado por flag `false`; a interface deve mostrar
indisponibilidade.

## Contrato Salesforce → CRM

O endpoint recebe diretamente `schemaVersion: 2`, `requestId` UUID, workflow,
dashboard e ranking opcional. O envelope `{body: payload}` pertence somente ao
webhook candidato do n8n e não é aceito por `/api/ingest/salesforce`.

Controles existentes:

- flag server-side, Bearer dedicado com comparação segura e body máximo 1 MB;
- Zod estrito e erro genérico, sem ecoar payload;
- RPC `ingest_crm_salesforce_snapshot`, única transação e lock;
- até 20 novos snapshots/minuto;
- `requestId` único: qualquer reutilização retorna o status anterior como
  idempotente sem comparar o conteúdo; o produtor precisa garantir unicidade e
  um contrato futuro deve persistir hash para rejeitar conflito; snapshot novo
  mais antigo é rejeitado sem substituir a última base válida;
- run registra status e erro sanitizado, sem payload comercial;
- resposta `201` nova, `200` replay, `400/401/413/422/429/503` conforme falha.

O workflow n8n versionado permanece inativo e valida somente uma parte do
contrato. Antes de ativação, ele deve reutilizar o schema v2 completo, receber
credenciais dedicadas pelo cofre e ter um único node externo para a API interna.

## Contrato Qlik v1

O contrato local seguro contém:

```text
schemaVersion: 1
requestId: UUID
referenceYear: inteiro 2020..2100
generatedAt/sourceUpdatedAt: ISO 8601 com offset
entries[1..5000]: periodMonth, imobKey, imobName, vgv, contracts,
                  sourceRankVgv?, sourceRankContracts?
```

`periodMonth` deve ser o primeiro dia de mês e pertencer a `referenceYear`;
chave usa `[a-z0-9._-]`; nome não pode ser vazio; VGV/contratos não podem ser
negativos; no contrato TypeScript, `vgv` é string decimal exata com até 16
dígitos inteiros e duas casas; ranks, quando presentes, começam em 1. O request UUID é também o run
ID. `generatedAt` e `sourceUpdatedAt` não podem exceder o relógio do banco em
mais de cinco minutos; o schema tipado replica esse limite com relógio injetável
nos testes. Replay semanticamente equivalente é idempotente; reutilização
conflitante falha com `23505`.

A RPC fixa fonte, regional e empresa no código local. Esses literais são
metadados observados, não uma política multiempresa. O contrato TypeScript
local cobre o array opcional `developments` e é um subconjunto deliberadamente
mais estrito para moeda do RPC SQL compatível. A RPC escopada
`list_scoped_crm_imob_ranking_entries` devolve `vgv` textual para preservar
centavos acima de `Number.MAX_SAFE_INTEGER`. Isso ainda não cria o mapping
canônico de organização exigido pelo v3.
O remoto atual possui uma RPC legada diferente, verifier embutido
e grants proibidos; não deve ser chamado nem copiado.

## Estoque e perdas por SLA

Foram encontrados dois escritores históricos concorrentes da tabela antiga
`estoque_spc`; isso prova implementação, não uma fonte homologada:

| Escritor legado                                       | Frequência/contrato observado                           | Semântica e risco                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drive `ESTOQUE SPC.xlsx`, workflow `RLwCgilt996q2C3P` | 11h e 18h; lotes de 500; chave `identificador`          | Primeiro duplicado vence; upsert não remove ausentes; calcula preço a partir de valor, bônus e folga com float; campos/datas sem contrato versionado |
| Salesforce report `00OU6000007yRpKMAU`                | Download pela UI; frequência não confiável após timeout | Upsert e exclusão por `sync_id`, não transacionais; escreve a mesma tabela sem precedência sobre Drive                                               |

O cache histórico rodava às 11h15/18h15, durava 24 horas e escolhia a última
linha para identificadores repetidos, diferente do primeiro escritor. A tabela
antiga não possuía o modelo mínimo de RLS/grants do CRM novo, precisão monetária
ou snapshot atômico. A alteração externa que introduziu esse fluxo não deve ser
copiada.

Também foram encontrados campos históricos de SLA, como “Fora do SLA”, “Criada
Pelo SLA”, fase, última fase e motivo. O workflow não deduplicava oportunidade e
chamava de “perdida por automação” toda oportunidade mensal marcada como criada
pelo SLA, sem exigir estado perdido/fechado. O exportador candidato omite esses
campos. A semântica é divergente e não pode alimentar métrica real.

O único contrato seguro é um estado indisponível explícito:

```json
{ "availability": "unavailable", "reason": "official_contract_missing" }
```

Ele não aceita unidades, produtos, preços, status ou perdas. Para liberar esses
dados, ainda são necessários: sistema oficial, proprietário, endpoint/workflow,
IDs naturais, schema e precisão monetária, estados/vigência, paginação,
remoção lógica, periodicidade, baseline, regra de SLA e reconciliação. Nenhum
valor visto na interface antiga será usado como dado.

## Última base válida

| Fonte       | Referência/geração                                         | Contagens sanitizadas                                                                                                            | Disponibilidade                        |
| ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Salesforce  | referência `2026-08-07`; gerada `2026-08-07T18:03:36.329Z` | 26 corretores, 4 contas Imob, 12.299 oportunidades, 816 agendamentos, 352 visitas, 465 pastas, 595 vendas, 104 linhas de ranking | Metas e roleta indisponíveis           |
| Qlik        | ano 2026; gerada `2026-08-09T05:07:36.463Z`                | 384 entries; 0 developments                                                                                                      | Caller ativo, contrato remoto inseguro |
| Estoque/SLA | —                                                          | —                                                                                                                                | Sem fonte segura                       |

Diagnósticos Salesforce: 63 visitas sem agendamento; 19 pastas e 18 vendas fora
do recorte de oportunidades; 122 pastas aprovadas; quatro corretores ativos sem
gerente; 195 nomes de atividade fora da base ativa. São contagens auditadas,
não dados fictícios nem regras de exclusão.

## Gates para evolução

1. confirmar o mapeamento de oportunidade das pastas pelo describe oficial;
2. obter IDs oficiais de gerente, organização, unidade e empreendimento;
3. definir atraso, remoção lógica e correção retroativa por fonte;
4. reconciliar totais/IDs antes de publicar agregados escopados;
5. identificar o caller Qlik e migrá-lo para credencial/RPC dedicadas;
6. obter contrato oficial de estoque e SLA;
7. manter workflows remotos inalterados até backup restaurado, migrations
   conciliadas e autorização explícita.
