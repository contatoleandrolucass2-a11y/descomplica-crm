# Filtros dimensionais do DashboardReport

## Implementacao de 15/10/2026

Esta secao substitui a proposta historica abaixo para a raiz `/app`.
Branch `codex/dashboard-filtros-metas`, base a7fdf92. Estado: implementacao local
em validacao; nao representa migration aplicada ou coletor publicado.
Usuario confirmou o significado das colunas e autorizou explicitamente a
atualizacao aditiva do banco e coletor, preservando dados e permissoes.

### Fonte e contrato

- Canal: `Imobiliaria` (`realEstateName`), correspondencia por conteudo sem
  diferenciar caixa, exclusivamente SPC - CANAL IMOB PJ / DIRECIONAL VENDAS SPC.
  Correspondencia com ambos rejeita a carga, sem escolher arbitrariamente.
- Gerente: `Gerente(s) de vendas` (`managerName`); responsavel:
  `Contato Corretor Proprietario`/corretor da atividade (`brokerName`).
- Empresa: `Unidade de Negocio` (`businessUnit`), nunca Imobiliaria. Metadados
  Salesforce GET describe confirmaram `Activity.Unidade_de_negocio__c` nas duas
  atividades. Campos existentes de oportunidade/pasta/venda foram preservados.
- Nomes unicos sao valores de filtro, nao IDs oficiais nem joins de identidade.
  A deduplicacao de eventos continua por ID de origem antes da agregacao.
- `dashboard.analysis` e opcional no envelope v2. Dicionarios por visao + tuplas
  diarias contêm etapa, data, indices dimensionais, quantidade, valor e contagem
  de pastas aprovadas. Nenhum cliente, CPF, telefone ou detalhe de proposta.
- Nova `crm_dashboard_analysis` acompanha o mesmo snapshot por PK/FK. RPC
  existente envolve a implementacao v2 privada, preserva replay/stale/lock e
  atomiza a substituicao. Nova carga legada remove analise antiga para nao misturar
  geracoes. Rollback do coletor nao preserva filtros antigos como se fossem novos.
- UI usa cliente autenticado, permissao de dashboard e visao. Opcoes e totais
  nunca atravessam visoes nao autorizadas. `service_role` nao tem acesso direto
  a nova tabela; escreve exclusivamente pela RPC. Nenhuma ACL Qlik alterada.
- Leitura exclusivamente pela RPC `read_crm_dashboard_analysis`; sem acesso
  direto de authenticated a tabela. Sem `crm.ranking.view`, remove a dimensao
  empreendimento e reagrupa os fatos antes de devolve-los, preservando os totais
  sem permitir reconstruir o ranking protegido.
- Transporte Salesforce limitado a 8 MiB de UTF-8 na publicacao, stream da API
  e location exata do Nginx. Demais endpoints conservam 1 MB/1m. Excesso rejeita
  a carga integral, sem truncar dados ou substituir o snapshot valido no banco.

### Regras confirmadas

Filtros multisselecao: OR dentro de uma dimensao, AND entre as quatro. Opcoes
unicas consideram os outros filtros, ignorando apenas a propria selecao.
Responsaveis de registros sem nome nao sao inventados. Metas contam nomes
unicos identificados no recorte de relatorios, incluindo todas as etapas e a
cobertura coletada; nao o cadastro de ativos. Nenhum responsavel identificado
em recorte com fatos torna a meta indisponivel; recorte vazio tem meta zero.

Por responsavel: agendamentos 1 segunda-sexta e 2 quinta, visitas8, pastas4,
vendas1 por mes. Nenhum calendario adicional de feriados foi fornecido.
Esperado = meta mensal x dia civil atual / dias do mes, sem arredondamento no
calculo. Oportunidades e pastas aprovadas continuam sem meta definida.
Data civil America/Sao_Paulo; o ultimo dia recebe a meta integral.

Media do ano considera meses completos no ano; media de3 usa os ultimos3
completos, inclusive ano anterior quando necessario. Mes atual nunca entra,
mesmo no ultimo dia. Mes anterior e integral. Cobertura inicia no menor entre
1 de janeiro e primeiro dia de3 meses atras. Periodo fora da cobertura e null,
nao zero. Pop-ups listam exatamente os meses usados e os respectivos valores.
Sem analise nao e possivel comprovar os meses; nao reconstruir series pela media.

Realizado usa as datas originais de cada relatorio no mes de referencia. Quando
a coleta ainda pertence a outro mes, a raiz nao apresenta esses numeros como
mes vigente. Auto-refresh observa troca do snapshot e virada do dia local.
Coleta de outro dia nao gera parecer de ritmo para hoje nem reutiliza janelas
moveis com rotulos atuais; os totais mensais permanecem datados ate nova coleta.
Pastas aprovadas nao recebem serie mensal derivada de ranking/status atual:
definicao temporal permanece pendente, apresentada como indisponivel.

### Ativacao e recuperacao

Flag `SALESFORCE_DASHBOARD_ANALYSIS_ENABLED=true` somente no coletor aprovado.
Default false preserva produtor legado. Ordem: gates/CI, backup privado,
migration aditiva revisada, app aprovado pelo coordenador de producao, coletor
com flag, coleta/recibo e reconciliacao. Nao reinstalar o servico existente.
Atualizacao do coletor deve conferir unidade/SHA atual, guardar backup privado
da unidade/drop-ins e validar novo caminho antes de reiniciar somente o coletor.
Falha preserva snapshot anterior; recuperar unidade/flag anteriores sem apagar
dados, candidato, locks ou ledger. Sem REST de n8n; nenhum workflow alterado.

Comprovar lint, tipos, testes, build, pgTAP e QA de temas/responsividade;
conferir versoes de CRM e coletor separadamente. Os resultados finais e provas
de ativacao serao registrados apos os gates. A secao abaixo e historica e nao
substitui a decisao mais recente do usuario nem comprova estado remoto.

---

Status: proposta de contrato; nao implementada nem ativada.
Verificacao local: 2026-10-15, Windows/PowerShell, branch
`codex/dashboard-filtros-layout`, HEAD
`ad496340cf57871c8fa80015aaaf0e0bd1da983c`.

Conferencia posterior pelo coordenador em15/10/2026,14:30Z: metadados de
producao via Supabase MCP confirmam tabelas legadas agregadas, sem os quatro
IDs dimensionais, e nao listam as tabelas v3 em public. Sem registros de
clientes ou mutacoes. Evidencia e limites em
[auditoria do layout](audits/dashboard-layout-2026-10-15.md#metadados-remotos-e-revalidacao).

## Objetivo e decisao recebida

Aplicar Canal de vendas, Gerente de Vendas, Responsavel da conta e Empresa a
todo o dashboard legado `/app`, com multisselecao e resultados reais.
Orientacao do usuario: "O banco de dados é geral, o usuário faz o filtro de acordo com a sua necessidade de gestão".

Isso define filtros gerenciais sobre uma base compartilhada. Nao confirma
Responsavel da conta = corretor, Empresa = imobiliaria, Canal = origem, nem
autoriza conceder acesso global a todos os usuarios. A consulta deve intersectar
a selecao com as permissoes efetivas no servidor. Um usuario autorizado ao
universo global pode filtra-lo; os demais continuam sujeitos ao seu acesso.

## Referencias existentes e limites

Este documento combina o diagnostico do legado com a proposta dos quatro
filtros. Referencia, sem substituir ou duplicar seus contratos completos:

- [Matriz v3 de filtros e escopos](integration-read-model-v3/FILTER_SCOPE_MATRIX.md):
  permissoes, escopos, cobertura e parametros existentes.
- [IDs e mappings v3](integration-read-model-v3/ID_SCOPE_MAPPING.md): identidade
  oficial, vigencia e reconciliacao. Nomes nao resolvem identidades.
- [Read model v3](integration-read-model-v3/READ_MODEL_V3.md) e
  [cutover e rollback](integration-read-model-v3/CUTOVER_AND_ROLLBACK.md):
  envelopes, autoridade, ativacao e reversao.
- [Auditoria do dashboard](audits/dashboard-reference-2026-10-13.md), linhas
  92-99, e [registro da referencia](audits/dashboard-reference-knowledge-2026-10-14.md),
  linhas 39-45: ausencia das dimensoes no agregado e limites da equipe.

Os documentos v3 incluem estados historicos de rollout e restricoes de papeis.
Nao comprovam o estado remoto atual. Para o legado, considerar tambem a migration
posterior `20261005234936_reconcile_roles_dashboard_views_and_bulk_overrides.sql`.
Esta analise nao consultou banco, Salesforce, n8n, GitHub ou producao.
O checkout possui trabalho concorrente de interface; nenhuma conclusao abaixo
depende de alteracoes de layout ainda nao integradas.

## Estado atual verificavel

| Evidencia local                                                                                           | Capacidade e limite                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [app/(protected)/app/page.tsx:23](<../app/(protected)/app/page.tsx#L23>)                                  | A rota recebe `view` e `period`; exige `crm.dashboard.view`, valida a visao autorizada e carrega agregado/equipe. Nao encaminha os quatro filtros.                                                                             |
| [lib/crm/dashboard/data.ts:84](../lib/crm/dashboard/data.ts#L84), leitura na linha 134                    | O contrato guarda valores por visao e etapa. Le `snapshot_key=global`; nao guarda IDs dimensionais por evento. Confere o snapshot antes/depois e tenta novamente uma vez se mudar.                                             |
| [lib/crm/ingestion/schema.ts:62](../lib/crm/ingestion/schema.ts#L62), envelope na linha 152               | V2 estrito: tres visoes, quinze metricas, top empreendimentos e ranking opcional. Acrescentar campos arbitrarios ao payload nao e compativel.                                                                                  |
| [ops/salesforce/transform.mjs:179](../ops/salesforce/transform.mjs#L179)                                  | `hasCanalImob` usa nome normalizado e lista de imobiliarias; `byView` produz Geral/com canal/sem canal. Nao representa um catalogo oficial de canais.                                                                          |
| [ops/salesforce/transform.mjs:95](../ops/salesforce/transform.mjs#L95)                                    | Calcula mes/semana/hoje, mes anterior ate o mesmo dia, medias dos meses anteriores do ano e ultimos tres, janelas de 7/14 dias, semana anterior e ontem.                                                                       |
| [ops/salesforce/transform.mjs:219](../ops/salesforce/transform.mjs#L219), chamada na linha 400            | Top 5 de oportunidades por empreendimento e visao, sobre os registros coletados; nao recebe o periodo selecionado. Nao e ranking por vendas ou pontuacao.                                                                      |
| [lib/crm/dashboard/team.ts:83](../lib/crm/dashboard/team.ts#L83), consulta na linha 135                   | Equipe exige ranking + visao Geral, snapshots coincidentes e participantes do mes. Conta corretores distintos por gerente; limite de 1.000 com contagem exata e rejeicao de carga incompleta.                                  |
| [ops/salesforce/transform.mjs:274](../ops/salesforce/transform.mjs#L274)                                  | Ranking inclui corretores ativos, inclusive sem eventos; atribui gerente recente por nome normalizado. Isso nao prova identidade nem vinculo historico oficial.                                                                |
| [lib/crm/read-model-v3/contracts.ts:71](../lib/crm/read-model-v3/contracts.ts#L71), resposta na linha 381 | V3 modela organizacao, equipe, carteira, coordenador, gerente, corretor, origem, empreendimento e local. Oferece contagens, conversoes, VGV decimal, medias e serie de meses certificados; metas e planejamento indisponiveis. |
| [lib/crm/read-model-v3/filters.ts:67](../lib/crm/read-model-v3/filters.ts#L67)                            | Parser de URL atual rejeita mais de um UUID por dimensao. Multisselecao exige alteracao explicita do contrato de URL, parser, controles e testes.                                                                              |

O coletor gera `schemaVersion: 2` em `ops/salesforce/transform.mjs:403`;
`app/api/ingest/salesforce/route.ts` chama `ingest_crm_salesforce_snapshot`.
A busca local por `ingest_crm_read_model_v3` em `app`, `lib` e `ops` nao encontrou
produtor executavel dessa RPC. Existencia do schema, SQL e rotas shadow nao
comprova ingestao, mappings, grants ou dados v3 remotos.

## Campos oficiais necessarios

Os nomes abaixo descrevem requisitos de negocio; nao inventam nomes de API
Salesforce. O owner da fonte deve confirmar objeto, campo, ID, relacionamento,
cardinalidade e vigencia antes de escolher parametros definitivos.

| Dimensao             | Evidencia coletada hoje                                                                                                                                           | Requisito para filtrar todas as etapas                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canal de vendas      | `realEstateName` participa da classificacao binaria; `accountSource` e `campaignName` aparecem em atividades.                                                     | ID/codigo oficial de canal e rotulo; vinculo oficial em oportunidade, agendamento, visita, pasta e venda. Confirmar taxonomia e relacao com as visoes legadas. Nao assumir `originIds`.           |
| Gerente de Vendas    | Oportunidades usam `Opportunity.Gerente_de_vendas__c`; atividades usam `Activity.Gerente_de_Vendas__c`; pastas/vendas usam campos de comissionado da imobiliaria. | ID oficial da pessoa na funcao de gerente de vendas e vigencia por evento; confirmar se os campos representam o mesmo papel. Usar `managerIds` somente apos mapping verificado.                   |
| Responsavel da conta | Existe `brokerName`; nenhum campo projetado prova o owner da conta.                                                                                               | ID oficial da conta, ID e tipo do responsavel, relacao com cada evento e vigencia. Confirmar se o responsavel e pessoa, equipe ou outro tipo admitido pela fonte. Nao substituir por `brokerIds`. |
| Empresa              | Imobiliaria e unidade de negocio aparecem em parte dos relatorios; atividades nao projetam a mesma unidade.                                                       | Definicao oficial de Empresa, ID e rotulo, mais vinculo de cada evento. Nao assumir imobiliaria, unidade de negocio ou `organizationIds`.                                                         |

Fonte dos campos: [ops/salesforce/export-candidate.mjs:27](../ops/salesforce/export-candidate.mjs#L27)
(colunas exigidas), linha 137 (projecao por etapa) e linha 199 (cadastros de
contatos/contas com IDs). IDs nos cadastros auxiliares nao comprovam o join com
eventos que hoje carregam nomes.

Cada fato tambem precisa de ID estavel da fonte, etapa, instante, data comercial,
timezone, valor monetario quando aplicavel e dimensoes de autorizacao. O v3
exige escopo e organizacao, e pessoas exigem equipe oficial
(`lib/crm/read-model-v3/contracts.ts:71-108`). Preservar IDs e versoes de mapping;
nao casar nomes, criar hashes de nomes como identidade ou ratear agregados.
Campos ausentes permanecem ausentes, com qualidade/cobertura explicitas.

## Contrato proposto de selecao e autorizacao

1. Cada dimensao aceita de zero a 100 IDs canonicos distintos. Zero selecoes
   significa ausencia de predicado naquela dimensao, apenas dentro do universo
   autorizado. Na RPC atual, omitir a chave; nao enviar array vazio.
2. Usar OR dentro de cada dimensao e AND entre dimensoes. Exemplo: canais A/B,
   gerentes G1/G2, responsavel R1 e empresas E1/E2 significam
   `(canal IN A,B) AND (gerente IN G1,G2) AND (responsavel = R1) AND
(empresa IN E1,E2)`. Deduplicar o fato por seu grao antes de contar ou somar;
   joins ou selecoes multiplas nao podem multiplicar VGV ou eventos.
3. Validar formato, quantidade, duplicatas, chaves desconhecidas e acesso no
   servidor. Uma selecao invalida ou nao autorizada rejeita a consulta inteira;
   nao remover silenciosamente o ID e nao voltar para Geral.
4. Resultado = fatos autorizados INTERSECAO filtros gerenciais INTERSECAO janela
   temporal de cada bloco. A escolha de Empresa nao concede escopo. As opcoes
   tambem devem vir do universo autorizado, sem enumerar catalogos globais.
5. Preservar permissoes de pagina, visao e ranking. Se o backend for v3, exigir
   tambem a permissao especifica do dataset, um escopo efetivo e sua cadeia de
   delegacao. Nao converter permissao legada em permissao v3, unir grants ou
   criar grant global implicitamente. Nao usar `service_role` para leitura UI.
6. Persistir toda a multisselecao na URL e nos refreshes/links pertinentes.
   Opcoes truncadas devem ser sinalizadas e selecoes preservadas. A API atual
   limita opcoes a 100; ampliar busca/paginacao requer contrato explicito.
7. Valores sem dimensao ficam em Geral quando autorizados e sao excluidos por
   filtro preenchido dessa dimensao. Nao inventar ID para "nao informado".
   Se essa selecao for necessaria, definir operador proprio e testa-lo.

Evidencias: policies do legado em
[`20261005234936...sql:407`](../supabase/migrations/20261005234936_reconcile_roles_dashboard_views_and_bulk_overrides.sql#L407);
escopo/permissao v3 em
[`20260809181424...sql:393`](../supabase/migrations/20260809181424_crm_read_model_v3.sql#L393);
arrays de 1-100 UUIDs e duplicatas na linha 446; `ANY` por dimensao e `AND`
entre elas na linha 1725; revogacao de acesso direto a tabelas na linha 2266.
O legado autoriza por visao, nao por esses quatro IDs; filtros nao substituem RLS.

## Snapshot, periodos e secoes

Uma requisicao deve fixar run/snapshot imutavel, fonte, data de referencia,
timezone, watermark, cobertura e versoes de mapping. Calcular todos os blocos
com a mesma selecao e autorizacao. Se houver cadastro de equipe separado, exigir
manifesto que vincule sua versao ao mesmo snapshot comercial. Nao combinar
totais novos com equipe, ranking ou comparativos de outra coleta.

Recalcular contagens, VGV, conversoes, variacoes, distribuicoes, percentuais e
ordenacoes a partir do subconjunto filtrado, incluindo:

- Funis de mes, semana e hoje; mes anterior ate o mesmo dia, limitado ao fim do
  mes; media dos meses fechados do ano e ultimos tres conforme regra vigente.
- Comparativos de 14 dias e seus 14 dias anteriores, 7 dias e seus 7 anteriores,
  semana anterior e ontem. Todas as janelas precisam de cobertura certificada.
- VGV e demais valores por periodo, preservando moeda, precisao e significado
  oficial de venda. Recalcular conversoes pelos totais filtrados; denominador
  zero resulta em indisponibilidade, nao percentual fabricado.
- Equipe por gerente e respectivos totais/percentuais. Preservar a semantica de
  cadastro de corretores ativos, inclusive sem eventos, com vinculos oficiais
  para aplicar os quatro filtros. Nao substituir por pessoas com atividade.
- Top empreendimentos por oportunidades. Aplicar os quatro filtros sobre sua
  janela declarada; manter a janela coletada atual ate decisao comercial que
  aprove outra. Nao trocar por total de eventos, vendas ou pontuacao.
- Metas, planejamento e pastas aprovadas somente quando houver fonte/contrato
  oficial para o mesmo recorte. Nao reutilizar meta global ou metricas de ranking
  para preencher um funil mensal sem essa medida.

O v3 atual retorna `monthlySeries` de meses certificados, mas seus breakdowns
contam eventos de todas as etapas e limitam a 100 itens, nao membros da equipe
ou apenas oportunidades. Evidencia: `20260809181424_crm_read_model_v3.sql:1769`,
`:1913` e `:2082`. A resposta em `lib/crm/read-model-v3/contracts.ts:381` nao
expoe o run ID nem os comparativos completos do legado.

A RPC v3 valida a presenca de cada dimensao no periodo solicitado
(`20260809181424_crm_read_model_v3.sql:1669`). Portanto, repetir a RPC para cada
comparativo pode rejeitar um filtro valido sem atividade naquela janela, alem
de atravessar uma troca de run. O contrato novo deve validar IDs no dominio
autorizado do snapshot/horizonte certificado e depois calcular cada janela;
ausencia de eventos nessa janela so vira zero com cobertura e medida comprovadas.
Nao tratar erro de filtro como zero. Preferir uma RPC versionada que retorne
todas as secoes atomicamente, com identificacao do run, a chamadas independentes.

Coleta atual inicia em 1 de janeiro (`ops/salesforce/export-candidate.mjs:278`).
Comparativos que cruzem o ano exigem ampliar a cobertura ou retornar
indisponibilidade explicita. Meses nao certificados nao entram como zero nas
medias. Ausencia de dados, fonte indisponivel, acesso negado e zero real precisam
de estados distintos por bloco; nunca preencher lacunas com agregado global.

## Caminho e gates de ativacao

Nao ha caminho completo comprovado sem mudanca de contrato e armazenamento.
O agregado legado nao pode ser desagregado pelos quatro filtros. Apenas as
tres visoes atuais funcionam sem migration, com equipe limitada a Geral; isso
nao atende ao pedido. Nao implementar seletores que apenas mudem rotulos.

| Etapa                       | Entrega e gate obrigatorio                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Semantica e fonte        | Owner confirma os quatro conceitos, campos/IDs por etapa, cardinalidade, vigencia, cobertura e definicao temporal da equipe/ranking. Nenhuma equivalencia presumida.                                                                                                                                                                                                                                         |
| 2. Contrato aditivo         | Reutilizar dimensoes v3 somente quando equivalentes oficialmente. Se distintas, ampliar fatos, identidades, filtros e validadores por migration nova. Preservar v2; nao editar migration aplicada nem inserir dimensoes no envelope v2 estrito.                                                                                                                                                              |
| 3. Autoridade e produtor    | Implementar produtor v3 com IDs oficiais, idempotencia, manifesto de escopos e meses fechados. Aprovar tupla `dataset/source/workflow/producer`, owner e evidencias; cadastro de autoridade por migration revisada. Reconciliar mappings por fluxo governado. Preparacao local nao autoriza coleta real.                                                                                                     |
| 4. Leitura completa         | RPC versionada calcula todos os blocos sobre run fixo, incluindo equipe e top oportunidades com semanticas explicitas. Atualizar schemas, loader, parser multisselecao e contratos de erro; fornecer apenas dados autorizados ao cliente.                                                                                                                                                                    |
| 5. Validacao isolada        | Fixtures sinteticas e pgTAP para papeis permitidos/negados, acesso direto negado, grant revogado, IDs externos ao escopo, AND/OR, duplicatas, limites, ausencia de vinculo, zero comprovado e todas as secoes/periodos. Testar troca de snapshot, limites de calendario, cobertura parcial, moeda, membros sem eventos, truncamento e regressao v2. Executar lint, typecheck, test e build no SHA candidato. |
| 6. Reconciliacao autorizada | Somente com autorizacao especifica: conferir drift remoto, mappings, grants e autoridade; aplicar migrations revisadas com backup/rollback, coletar e ingerir em ambiente autorizado. Comparar contagens/VGV por etapa, dimensao e janela. Carga rejeitada nao substitui a anterior.                                                                                                                         |
| 7. Ativacao                 | Somente apos gates e autorizacao de cutover/publicacao: habilitar leitura integral e controles reais juntos, observar consistencia e acesso permitido/negado. Cumprir PR/CI e runbook de release vigente. Rollback preserva runs/mappings e nao amplia acesso nem apresenta totais globais como filtrados.                                                                                                   |

Autoridade da fonte: `20260809181424_crm_read_model_v3.sql:39`.
Aplicacao remota de migrations, ingestao, refresh, coleta, cutover e deploy nao
estao autorizados por este documento. Alterar workflow n8n existente exige MCP,
`validate_workflow_code` antes de `update_workflow` e releitura via MCP; falha
do MCP interrompe a mutacao. Nao usar REST como alternativa sem pedido explicito.
Nao conceder acesso direto as tabelas Qlik nem alterar regras financeiras.

## Verificacao desta entrega

Escopo de escrita: somente `docs/dashboard-dimensional-filters.md`.
Comandos executados: `git status --short`, `git branch --show-current`,
`git rev-parse HEAD`, `git diff --stat`, `rg` e `Get-Content` nos contratos e
documentos citados. Resultado: base conferida, referencias pertinentes
encontradas e limites do legado/v3 confirmados por inspecao local.
Buscas iniciais com glob em caminho Windows falharam; refeitas por diretorio
com `--glob`. Nenhuma falha de busca foi usada como prova de ausencia.
Validacao documental em PowerShell com `Test-Path` e `Get-Content`: 19 links
com destinos existentes e ancoras de linha validas; nenhum espaco final.
`git diff --check` passou nos arquivos rastreados; o arquivo novo foi conferido
separadamente pelo verificador documental. Esses checks nao validam o runtime.

Testes existentes inspecionados, nao executados: `tests/dashboard-access.test.tsx:97`,
`tests/dashboard-team.test.ts:104`, `tests/dashboard-snapshot-read.test.ts:127`,
`tests/read-model-v3-filters.test.ts:51` e `supabase/tests/read_model_v3.test.sql:1548`.
Lint, typecheck, test, build e pgTAP nao foram executados nesta entrega documental
isolada com trabalho concorrente no checkout; continuam gates da implementacao
e da integracao pelo coordenador. Esta nota nao aprova codigo, CI ou runtime.

Sem consultas privadas/remotas, migrations, ingestao, coleta/n8n, cutover,
deploy ou sync. Sem escrita em knowledge, WORKLOG ou CHANGELOG. Pendencias:
definicoes oficiais das dimensoes, dados/mappings e cobertura reais, contrato
completo de leitura, matriz de acesso aprovada e validacao operacional autorizada.
