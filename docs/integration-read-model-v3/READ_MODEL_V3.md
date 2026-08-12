# Read model CRM v3

## Estado desta entrega

O contrato v3 está **implementado localmente** na migration
`20260809181424_crm_read_model_v3.sql`, nos schemas TypeScript de
`lib/crm/read-model-v3/` e em páginas shadow separadas. Ele não substituiu a
leitura atual/v2 e não representa cutover remoto.

As rotas canônicas `/app`, `/app/etapas/*`, `/app/ranking` e
`/app/canal-de-parcerias` continuam sendo as superfícies de produção e continuam
no catálogo `app_pages`. O catálogo e a navegação não contêm caminhos v3.

As superfícies v3 são exclusivamente shadow:

| Caminho                                 | Dataset        | Permissão exigida                     |
| --------------------------------------- | -------------- | ------------------------------------- |
| `/app/read-model-v3`                    | `funnel`       | `crm.read_model_v3.view`              |
| `/app/read-model-v3/etapas/*`           | `funnel`       | `crm.read_model_v3.view`              |
| `/app/read-model-v3/ranking`            | `ranking`      | `crm.read_model_v3.ranking.view`      |
| `/app/read-model-v3/canal-de-parcerias` | `partnerships` | `crm.read_model_v3.partnerships.view` |

Esses caminhos ficam dentro do layout autenticado, têm metadata `noindex` e
retornam `404` quando a configuração server-only explícita
`CRM_READ_MODEL_V3_SHADOW_ENABLED=true` não está ativa. `1`, `yes`, variável
ausente e outros valores ambíguos mantêm o shadow fechado. Depois do gate de
ambiente, a página exige a permissão exata do dataset; a RPC revalida essa
permissão e o grant de escopo no banco.

**A flag, sozinha, não é cutover de produção.** Ela não troca as rotas normais,
não altera `app_pages`, não publica dados, não ativa produtores e não aplica
migration ou grants remotamente.

Continuam bloqueados:

- aplicação das migrations em produção;
- ativação de produtores Salesforce/Qlik contra o v3;
- entrega de credencial ou mudança de caller externo;
- qualquer liberação herdada das permissões v3;
- inclusão das rotas shadow no catálogo ou na navegação;
- substituição das rotas atuais/v2 pelas superfícies v3;
- uso como fonte oficial antes da reconciliação de identidades e da validação
  dos totais.

A migration cataloga os gates `crm.read_model_v3.view`,
`crm.read_model_v3.ranking.view`, `crm.read_model_v3.partnerships.view` e
`crm.read_model_v3.stock.view`, mas concede zero heranças automáticas de papel.
Os testes criam grants sintéticos apenas dentro da transação local para provar
isolamento por escopo; isso não constitui decisão de autorização para produção.
Sem grant posterior ou sem snapshot publicado, a leitura shadow falha fechada
ou retorna indisponível, respectivamente.

## Datasets reconhecidos

O envelope aceita quatro chaves fechadas:

| `datasetKey`   | Destino pretendido | Estado semântico atual                                                                                          |
| -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `funnel`       | Dashboard e etapas | Contrato factual completo implementado.                                                                         |
| `ranking`      | Ranking comercial  | Aceito e isolado por run, mas ainda usa o mesmo grão de eventos/etapas; não há fórmula oficial de pontos no v3. |
| `partnerships` | Canal de Parcerias | Aceito e isolado por run; falta produtor Qlik v3 reconciliado.                                                  |
| `stock`        | Estoque            | Aceito e isolado por run, mas sem página shadow; contrato oficial da fonte continua pendente.                   |

Há um único ponteiro ativo por `datasetKey`. Portanto, fontes diferentes não
são combinadas: uma publicação nova e válida para o dataset substitui o run
ativo anterior daquele dataset. Qualquer composição multi-fonte exige contrato
posterior; não deve ser inferida no cliente.

## Armazenamento implementado

### `crm_read_model_v3_runs`

Envelope imutável de um snapshot. Guarda versão, IDs de requisição e snapshot,
hash do payload, dataset, fonte, workflow, produtor, datas de referência e
geração, timezone, watermark, cobertura, estado da fonte, qualidade, medidas
disponíveis, resultado de publicação e contagem.

Estados persistidos:

- `publication_status`: `published` ou `rejected`;
- `coverage_status`: `complete`, `partial` ou `unknown`;
- `source_status`: `ready`, `stale`, `unavailable` ou `error`;
- `quality_status`: `verified`, `warning` ou `blocked`.

Runs publicados e rejeitados são evidência imutável. Um run rejeitado contém
zero fatos e não move o ponteiro ativo.

### `crm_read_model_v3_events`

Fato imutável no grão:

```text
run_id + stage_key + source_record_id
```

Cada fato guarda `occurred_at`, `commercial_date`, valor opcional e os IDs
canônicos. `reporting_scope_id` e `organization_id` são obrigatórios. Equipe,
carteira, coordenador, gestor, corretor, origem, empreendimento e local são
opcionais.

Para toda dimensão presente são persistidos tanto o ID canônico quanto a versão
de `crm_source_identities` que o resolveu. Nome nunca é chave de autorização.
Pessoas exigem uma equipe oficial, e as relações organização/equipe/carteira/
pessoa/dimensão são verificadas no instante do evento.

As etapas aceitas são somente `opportunities`, `appointments`, `visits`,
`folders` e `sales`. Esse catálogo estrutural é código versionado; ele não
substitui uma fórmula comercial externa.

### `crm_read_model_v3_scope_coverage`

Manifesto imutável dos escopos que a fonte certificou como integralmente
cobertos pelo run, inclusive quando um escopo tem zero fatos. Cada linha liga o
run ao `reporting_scope_id` canônico e à versão de identidade externa que
fundamentou a declaração. As FKs usam `ON DELETE RESTRICT`; o par
`run + scope` e a identidade usada são únicos.

Um fato deve estar contido em pelo menos um escopo manifestado. Na leitura, a
cobertura é mais estrita: o escopo solicitado precisa aparecer **exatamente** no
manifesto. Um fato de equipe ou organização descendente não certifica sozinho um
escopo global ou organizacional mais amplo.

### `crm_read_model_v3_closed_months`

Lista meses que o produtor declarou completos. Cada linha guarda o primeiro dia
do mês e o watermark da fonte. Meses ausentes não são tratados como zero e não
entram na média de meses fechados.

### `crm_read_model_v3_active_runs`

Ponteiro transacional para o run publicado atual de cada dataset. O ponteiro só
avança depois que envelope, identidades e fatos passam por toda a validação.

## Contrato de ingestão

### Autoridade privada obrigatória

Os campos de procedência no envelope não autorizam uma carga. A RPC exige uma
linha exata em `private.crm_read_model_v3_sources`, cuja chave primária é:

```text
dataset_key + source_key + workflow_key + producer_key
```

A linha precisa estar `is_active = true`, apontar por `owner_id` para um registro
ativo de `private.crm_integration_owners` e conter `approved_at`, `approved_by` e
`evidence_reference`. A constraint impede ativar autoridade sem aprovação e
evidência, e o índice parcial permite no máximo uma fonte ativa por dataset.

`require_complete_coverage` também faz parte da decisão. Se estiver ativo,
payloads legíveis (`sourceStatus = ready` ou `stale`) somente passam com
`coverage.status = complete`. Estados `unavailable` e `error` podem registrar a
indisponibilidade sem inventar cobertura completa.

Essa autorização de fonte é adicional à resolução de cada identidade externa.
Cada mapping usado pelo fato precisa estar `verified`, vigente em `occurredAt`,
evidenciado e ligado a owner de mapping ativo.

### RPC e acesso

`public.ingest_crm_read_model_v3(jsonb)` é `SECURITY DEFINER`, possui
`search_path = ''`, timeout de 30 segundos e `EXECUTE` apenas para
`service_role`. As quatro tabelas não concedem acesso direto nem mesmo a
`service_role`; escrita automatizada ocorre exclusivamente pela RPC.

O payload JSON aceita no máximo 8 MiB, 10.000 registros, 1.000 escopos no
manifesto, 100 códigos de qualidade, duas medidas e 60 meses fechados. Chaves
desconhecidas falham. O
relay HTTP continua responsável por impor seu próprio limite antes do parse e
por não distribuir credencial privilegiada ao produtor externo.

### Envelope v3

Campos obrigatórios:

- `schemaVersion = 3`;
- `requestId` UUID;
- `datasetKey`;
- `sourceKey`, `workflowKey` e `producerKey` em formato slug, com no máximo
  100 caracteres;
- `sourceSnapshotId` estável da fonte;
- `referenceDate`;
- timezone IANA explícito;
- `generatedAt` e `sourceUpdatedAt` quando a fonte é legível;
- `coverage` com início, fim e estado;
- estado/motivo da fonte;
- estado/códigos de qualidade;
- medidas disponíveis;
- `coveredReportingScopeExternalIds`, lista única e explícita dos escopos
  certificados pelo snapshot;
- meses fechados;
- fatos em `records`.

`sourceKey`, `workflowKey` e `producerKey` identificam procedência; não concedem
autorização. `sourceSnapshotId` é único por dataset e fonte.

### Registro factual

Cada registro aceita:

- `sourceRecordId`;
- `stageKey`;
- `occurredAt` com offset;
- `commercialDate`;
- `amount` como string decimal exata ou nulo quando a medida não existe;
- `dimensions` com IDs externos oficiais.

`amount` nunca é número JSON. A string aceita valor não negativo com até 16
dígitos inteiros e até duas casas decimais, limite compatível com
`numeric(18,2)`. O contrato rejeita precisão excedente e não arredonda nem passa
o valor por ponto flutuante JavaScript.

`reportingScopeExternalId` e `organizationExternalId` são obrigatórios. Os IDs
externos opcionais são equipe, carteira, coordenador, gestor, corretor, origem,
empreendimento e local. Um ID externo resolve somente contra um mapeamento
`verified`, vigente no instante do evento, pertencente a owner ativo e apontando
para alvo canônico ativo. Desativar pessoa, organização, equipe, carteira,
escopo, origem, empreendimento ou local impede novas publicações dependentes.

## Reconciliação e publicação atômica

A ingestão faz uma primeira passagem para resolver todas as identidades. ID
obrigatório ausente ou ID informado sem mapeamento verificado cria/atualiza um
item privado de reconciliação com o motivo `verified_mapping_missing`.

Se qualquer fato estiver sem reconciliação, o lote inteiro é persistido como
`rejected`, com `quality_status = blocked`, motivo
`unresolved_mappings`, zero fatos e sem troca do ponteiro ativo. Não existe
publicação parcial nem fallback por nome.

Depois da resolução, uma segunda passagem valida:

- organização da equipe, origem, empreendimento e local;
- vigência da organização dentro da carteira;
- vínculo e papel de coordenador, gestor e corretor na equipe;
- coerência entre o escopo declarado e as dimensões canônicas.

Somente então os fatos são inseridos e o ponteiro é avançado na mesma
transação.

## Idempotência e concorrência

- O hash é calculado sobre um payload JSONB canônico. Além da ordenação canônica
  das chaves de objeto pelo JSONB, a RPC ordena `qualityIssues`,
  `availableMeasures`, `coveredReportingScopeExternalIds`, `closedMonths` e
  `records`; os registros usam
  `stageKey`, `sourceRecordId` e o próprio JSONB como desempate.
- O texto UTF-8 desse payload canônico recebe SHA-256, e o resultado fica no run.
  Reordenar os arrays semanticamente não ordenados produz o mesmo hash e o pgTAP
  prova esse replay como `noop`.
- Strings decimais continuam strings no conteúdo canônico. Não há coerção por
  ponto flutuante; representações textuais diferentes continuam sendo conteúdo
  diferente para auditoria.
- Repetir o mesmo `requestId` com o mesmo hash retorna `noop = true`.
- Reutilizar `requestId` com conteúdo diferente falha com conflito.
- Reutilizar `sourceSnapshotId` para o mesmo dataset/fonte falha.
- O grão `stageKey + sourceRecordId` não pode repetir no lote.
- Locks transacionais serializam `requestId`, publicação por dataset e resolução
  por fonte; o replay é consultado novamente depois do lock.
- `generatedAt` precisa ser estritamente posterior ao run ativo; timestamp igual
  ou anterior não substitui o snapshot.
- Um run rejeitado nunca altera `crm_read_model_v3_active_runs`.

## Estados da fonte, qualidade e medidas

| Estado        | Contrato implementado                                                        | Resultado de leitura                                                     |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ready`       | Sem `statusReason`; exige watermark e medida `counts`.                       | `ready` com fatos ou `empty` quando o recorte autorizado tem zero fatos. |
| `stale`       | Exige `statusReason`, watermark e `counts`; fatos podem permanecer legíveis. | `stale`; métricas continuam presentes para sinalização explícita na UI.  |
| `unavailable` | Exige motivo e zero registros.                                               | Métricas nulas, nunca zero sintético.                                    |
| `error`       | Exige motivo e zero registros.                                               | Métricas nulas, nunca reaproveitamento silencioso.                       |

Qualidade `verified` não aceita issues. `warning` e `blocked` exigem ao menos um
código; `blocked` rejeita o run. O estado de cobertura é retornado separadamente
e não é convertido em uma fórmula de completude na interface.

As únicas medidas declaradas são:

- `counts`: habilita contagens de fatos por etapa;
- `sales_amount`: habilita valor informado pela fonte para fatos `sales`.

Quando `sales_amount` não está disponível, todos os valores precisam ser nulos.
Quando disponível, fatos de venda precisam trazer valor. Metas e planejamento
permanecem explicitamente indisponíveis: `goalsAvailable = false`, `goal = null`
e `planningAvailable = false`.
Valores monetários são strings decimais exatas. A ingestão aceita no máximo 16
dígitos inteiros e duas casas por fato. A resposta serializa `salesAmount` como
string, com até 20 dígitos inteiros e duas casas para comportar a soma máxima dos
10.000 fatos; ela não converte dinheiro para `number` nem arredonda
silenciosamente a informação da fonte.

## Tempo, cobertura e competência

- O timezone deve existir em `pg_timezone_names` e pertencer à allowlist de
  famílias IANA aceitas por `Intl.DateTimeFormat`; aliases PostgreSQL-only como
  `Factory` são rejeitados.
- Datas e timestamps precisam usar representação ISO canônica, timestamps
  exigem offset explícito e todos os valores temporais devem ser finitos.
- `commercialDate` deve ser exatamente a data de `occurredAt` no timezone do
  envelope.
- `generatedAt` e `sourceUpdatedAt` não podem ficar mais de cinco minutos no
  futuro; o watermark não pode superar a geração.
- Cobertura `unknown` não aceita limites. Cobertura `partial` ou `complete`
  exige ambos os limites e inclui `referenceDate`.
- Mês fechado precisa começar no dia 1, anteceder o mês da referência e caber
  integralmente em cobertura `complete`; qualquer mês certificado exige
  `sourceUpdatedAt` para persistir o watermark.
- Períodos predefinidos terminam no dia seguinte à `referenceDate`; semana usa
  a semana ISO/PostgreSQL iniciada na segunda-feira. Todo intervalo resolvido,
  inclusive `month`, `week` e `today`, precisa caber nos bounds certificados;
  caso contrário, a leitura fica indisponível, nunca parcialmente `ready`.
- Período customizado usa início inclusivo e fim exclusivo, exige os dois
  limites, aceita no máximo cinco anos e deve caber integralmente em cobertura
  declarada como `complete`.

O cliente usa o timezone retornado para apresentar o watermark. Datas mensais,
que são competências sem horário, são formatadas em UTC para evitar deslocar o
primeiro dia do mês.

## Contrato de leitura

### `list_crm_read_model_v3_scopes()`

Retorna somente grants diretos, vigentes e efetivos do usuário autenticado. A
lista contém UUID, chave, tipo e rótulo do escopo. Não há união implícita. Se o
usuário possui mais de um escopo, o cliente exige uma escolha explícita.

### `get_crm_read_model_v3(dataset, scope, filters)`

A RPC é `SECURITY DEFINER`, tem timeout de 10 segundos e exige:

- papel/escopo válido;
- permissão correspondente ao dataset: `crm.read_model_v3.view` para `funnel`,
  `crm.read_model_v3.ranking.view` para `ranking`,
  `crm.read_model_v3.partnerships.view` para `partnerships` ou
  `crm.read_model_v3.stock.view` para `stock`;
- grant direto exatamente para o escopo solicitado;
- cadeia de linhagem efetiva.

Filtros aceitos:

- período `month`, `week`, `today` ou `custom`;
- organização, equipe, carteira, coordenador, gestor, corretor, origem,
  empreendimento e local;
- no JSON da RPC, arrays de 1 a 100 UUIDs únicos por dimensão.

Chave desconhecida, UUID inválido, array vazio, duplicata ou valor ausente do
mesmo escopo/período falha com `22023`. A consulta não remove o filtro para
ampliar resultado. Dimensões diferentes são combinadas por interseção. As
opções retornadas vêm dos fatos visíveis no escopo e período antes da aplicação
dos filtros dimensionais atuais. Cada lista é ordenada deterministicamente e
limitada a 100 itens. `truncatedOptions` enumera, em ordem, as dimensões cujo
catálogo visível excedeu esse limite; a interface avisa que a lista é parcial.

O shadow usa uma superfície deliberadamente menor: o formulário e o parser de
URL aceitam zero ou um UUID por dimensão. Parâmetros repetidos, listas separadas
por vírgula, chaves desconhecidas, UUIDs malformados e datas conflitantes falham
fechados antes da chamada. O parser converte os nomes de URL `organizations`,
`teams`, `portfolios`, `coordinators`, `managers`, `brokers`, `origins`,
`developments` e `locations` nos arrays `*Ids` da RPC.

Sem run oficial, a RPC retorna `dataStatus = unavailable`, motivo
`official_source_not_published`, opções vazias e métricas nulas. Run sem o
escopo exato no manifesto retorna `scope_coverage_not_proven`; intervalo fora
dos bounds retorna `period_coverage_not_proven`. Em ambos, métricas e breakdowns
são nulos e a qualidade recebe warning explícito.

O TypeScript replica o contrato com Zod, rejeita parâmetros repetidos ou
malformados e valida novamente a resposta da RPC. Quando existe exatamente um
escopo, o loader pode selecioná-lo; com zero ou vários, não escolhe um escopo
mais amplo automaticamente.

## Fatos e cálculos realmente implementados

Não há fórmula de negócio presumida para pontos, metas, projeção, estoque ou
ranking oficial. O read model calcula apenas:

- total por etapa: contagem dos fatos filtrados daquela etapa;
- conversão: total da etapa dividido pelo total da etapa imediatamente
  anterior; nula para a primeira etapa ou quando o denominador é zero;
- valor vendido: soma de `amount` somente nos fatos `sales`, quando
  `sales_amount` foi declarado disponível;
- média fechada: média das contagens mensais somente para meses explicitamente
  certificados em `closedMonths`;
- série mensal: contagens por etapa apenas nesses meses certificados;
- breakdowns: contagens por ID canônico para organização, corretor, gestor e
  empreendimento, limitadas a 100 linhas cada.

Um zero em fonte `ready` significa ausência real de fatos somente quando o
período está integralmente certificado e o escopo solicitado aparece no
manifesto do run. Métrica nula significa medida, período, escopo ou fonte
indisponível. O cliente não deve converter um no outro.

## Índices e limites operacionais

Índices implementados:

- runs publicados por dataset/data e runs por fonte/geração;
- eventos por escopo/data/etapa e por run/data/etapa;
- eventos por run com organização/equipe, carteira, pessoas e dimensões
  comerciais;
- manifesto por escopo/run;
- meses fechados por run/mês;
- ponteiro ativo com PK em dataset e unicidade de run;
- identidades externas verificadas por fonte/tipo/ID/vigência;
- linhagem por pai e por raiz/profundidade.

Os limites de 30 segundos na ingestão, 10 segundos na leitura, 10.000 fatos por
run, 100 UUIDs por filtro da RPC e 100 linhas por breakdown são parte do contrato
atual. O pgTAP constrói e ingere exatamente 10.000 fatos dentro do timeout da RPC,
confirma `record_count = 10000`, executa a leitura autenticada e escopada dentro
do timeout de leitura e prova que os totais retornam os 10.000 fatos uma única
vez. Essa é uma prova local no limite contratado, não um SLA nem evidência de
produção. As opções usam `SELECT DISTINCT` sobre os fatos visíveis, ordem
determinística, cap de 100 por dimensão e sinal de truncamento. Volume futuro
acima do contrato ainda exige
`EXPLAIN (ANALYZE, BUFFERS)` e pode exigir uma ponte de dimensões em migration
posterior. Não se deve contornar timeout ampliando grants ou movendo a filtragem
para o navegador.

## Segurança implementada

- RLS habilitada e forçada em todas as tabelas v3, inclusive o manifesto de
  cobertura.
- Nenhuma policy de leitura direta; ACL de tabela revogada de `PUBLIC`, `anon`,
  `authenticated` e `service_role`.
- `service_role` executa somente a RPC de ingestão.
- `authenticated` executa somente as RPCs de leitura/listagem.
- `anon` não executa nenhuma RPC v3.
- O filtro de escopo é revalidado no banco; autorização da UI não é fronteira
  de segurança.
- O read model não concede acesso direto às tabelas Qlik protegidas. A RPC Qlik
  legada permanece apenas para compatibilidade e também exige mapeamento
  verificado, vigente e com owner ativo.

## Limitações conhecidas

- `ranking`, `partnerships` e `stock` ainda compartilham o grão e a resposta de
  funil; seus contratos oficiais específicos não foram inventados.
- Existe um único run ativo por dataset, não um ponteiro por fonte ou escopo.
- A unicidade de `sourceSnapshotId` inclui runs rejeitados; um payload corrigido
  precisa de nova identidade de snapshot e nova requisição no contrato atual.
- Um run publicado como `unavailable` ou `error` também substitui o ponteiro
  ativo; o banco não reutiliza silenciosamente o último run `ready`.
- Não há produtor v3 ativo nem backfill oficial reconciliado.
- As rotas atuais/v2 e o catálogo continuam inalterados. As rotas v3 são shadow,
  fora da navegação, e exigem flag server-only mais permissão por dataset.
- Nenhum papel herda inicialmente os quatro gates v3. Qualquer liberação,
  inclusive para `master`, depende de migration e decisão separadas.
- Cobertura `partial` e `unknown` é informativa; a RPC não corta ou estima
  métricas com base nela.
- O período customizado falha fechado quando extrapola os bounds de cobertura
  completa.
- `closedMonths` exige `sourceUpdatedAt`, cobertura completa, mês anterior à
  referência e contenção integral nos bounds informados.
- Opções dimensionais refletem escopo/período, mas não são recalculadas pela
  interseção dos demais filtros selecionados. Cada lista tem cap de 100 e
  truncamento sinalizado por `truncatedOptions`.
- A contenção histórica depende de escopos canônicos ainda ativos e de vínculos
  vigentes no instante do fato.
- A ingestão aceita até 8 MiB e 10.000 fatos em uma transação; volume maior
  exige particionamento contratual, não aumento informal do limite.
- A leitura Qlik compatível ainda usa paginação por offset e ranks da fonte; ela
  não equivale ao dataset `partnerships` v3.

## Cutover e rollback

Antes do cutover:

1. tratar a flag shadow apenas como ferramenta de validação, nunca como cutover;
2. identificar e aprovar owner, caller e credencial M2M de cada produtor;
3. cadastrar e aprovar a tupla privada exata da fonte com evidência e política de
   cobertura;
4. reconciliar IDs externos com owner e evidência, inclusive escopos e
   organizações obrigatórios;
5. produzir snapshots v3 em ambiente local/controlado;
6. reconciliar totais factuais por dataset e escopo sem criar fórmulas novas;
7. provar isolamento horizontal, estados da fonte, timezone, idempotência e
   planos de execução;
8. executar `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`;
9. aprovar separadamente a troca de rotas e catálogo;
10. obter autorização explícita para migrations, dados e callers remotos.

Rollback conservador após eventual ativação:

1. interromper o produtor/relay v3 sem restaurar escrita direta;
2. remover `EXECUTE` do caller por migration, se necessário;
3. reverter páginas e gates para o caminho anterior por código e migration
   próprios, somente se esse caminho ainda estiver aprovado e seguro;
4. manter runs, fatos rejeitados, reconciliações e hashes como evidência;
5. não apagar tabelas nem restaurar grants diretos Qlik;
6. tratar qualquer exclusão como operação destrutiva separadamente autorizada.

Sem chamadas de ingestão, as tabelas e RPCs locais podem permanecer inertes.
Rollback não deve alterar DNS, produção, credenciais, cobranças ou dados remotos
sem autorização explícita.

## Fontes locais do contrato

- `supabase/migrations/20260809181422_integration_identity_governance.sql`
- `supabase/migrations/20260809181424_crm_read_model_v3.sql`
- `supabase/tests/read_model_v3.test.sql`
- `lib/crm/read-model-v3/config.ts`
- `lib/crm/read-model-v3/contracts.ts`
- `lib/crm/read-model-v3/filters.ts`
- `lib/crm/read-model-v3/data.ts`
- `app/(protected)/app/read-model-v3/`
- `lib/crm/integrations/contracts.ts`
