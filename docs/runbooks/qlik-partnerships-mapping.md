# Qlik: mapeamento do Canal de Parcerias

## Referencia vigente

Em 14/10/2026 o usuario substituiu expressamente a referencia `/ranking` por
https://descomplicapro.com.br/canal-de-parcerias. Esta pagina passa a orientar
a coleta. O fluxo permanece Qlik -> VPS -> CRM; nao CRM -> Qlik.

O escopo e ranking de **imobiliarias e empreendimentos por VGV e contratos**.
Nao aplicar filtros, pontos, roleta, SLA, premios ou roster do ranking de
corretores anterior. `ranking-scope.mjs` permanece um preflight offline daquele
escopo, sem caller, e **nao valida nem autoriza esta integracao**.

O destino originalmente solicitado continua `/app/ranking` ate nova orientacao;
o repositorio ja tem
`/app/canal-de-parcerias`, hoje sem dados reais. A troca de referencia nao e
autorizacao para remover a tela de corretores, redirecionar rotas ou substituir
seu snapshot Salesforce. Foi apresentada ao usuario a alternativa de usar a
rota de parcerias existente; pergunta sem resposta nao muda o destino original.

## Evidencias e limites

- Base local: `fb9b19f`, branch `codex/qlik-ranking-vps`.
- Referencia inspecionada por interface/DOM em 14/10/2026, visoes mensal, anual
  e personalizada. Nenhuma configuracao salva e nenhum arquivo de dados baixado.
- A pagina mostra fonte/processamento de **20/08/2026 08:19**, com aviso de
  desatualizacao. Seus valores nao conciliam, por si, a fonte de outubro.
- O seletor de unidade tinha somente **Direcional** no estado observado.
  Nao ampliar para Riva por inferencia; disponibilidade de outras unidades
  precisa de evidencia. O Qlik comercial, por sua vez, mostra ambas nas series.
- Inspecao anterior de Visao House preservada somente como historico em
  `qlik-ranking-reference.md`. Seus campos nao comprovam a origem desta pagina.
- Revisoes locais independentes cobriram schema, RPCs, leitura, UI e helpers
  legados. Nenhuma consulta de registros privados, migration, ingestao ou
  mudanca de ACL foi executada nesta etapa de mapeamento.

## Inventario integral da pagina

| Secao           | Conteudo observado                                                | Dados necessarios                                       |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Cabecalho       | Canal de Parcerias / Ranking das Imob's                           | Titulo e unidade selecionada                            |
| Periodos        | Mes, mes anterior, ano e personalizado                            | Competencia mensal e cobertura por ano                  |
| Personalizado   | Ano, mes inicial/final, trimestres validos                        | Intervalo inclusivo de meses; limites disponiveis       |
| Unidade         | Seletor com Direcional no estado observado                        | Identidade oficial da unidade nas duas dimensoes        |
| Atualizacao     | Fonte, processamento e desatualizado                              | Timestamps separados, sem substituir fonte por coleta   |
| Podio           | Prata/ouro/bronze, nome, VGV, contratos, proximo alvo e diferenca | Populacao integral ordenada e valores monetarios exatos |
| Ranking IMOBs   | Top 10, posicao, variacao, nome, VGV, total, busca                | Chave estavel, snapshot comparavel, texto de busca      |
| Resumo IMOBs    | VGV total, total de contratos, IMOBs com producao                 | Agregados da populacao completa, nao somente top 10     |
| Empreendimentos | Top 10 por produto, posicao, variacao, nome, VGV, total           | Chave oficial do empreendimento e unidade               |
| Resumo produtos | VGV total, contratos, numero de empreendimentos                   | Mesmo recorte, periodo e instante das IMOBs             |
| Estados         | Lider, vice, top 3, elite/destaque; novo/subiu/caiu/estavel       | Derivacoes de posicao, nunca pontuacao de corretor      |

O personalizado observado opera por **mes**, nao intervalo arbitrario de dias.
Os atalhos trimestrais exibidos respeitam meses disponiveis na referencia.
Nao confundir a lista limitada a dez com o universo usado nos resumos.

## Fonte Qlik candidata observada

Tenant: `direcional.us.qlikcloud.com`.

| Elemento                    | Identificacao observada                                                 | Situacao                                                                  |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Aplicativo                  | `23.1 - Painel Comercial - Web`, `7c000871-8b32-4c0f-bfd5-4b9d46946575` | Aberto; vinculo com exportador legado ainda nao demonstrado               |
| Pasta                       | `23.1.7 - Vendas`, `772db774-0bc2-42d8-ac11-3e4917bd0d37`               | Aberta pela lista de pastas                                               |
| Conteiner de canais/pessoas | `e039b893-0d96-444c-9773-aba1383f8d94`                                  | ID visivel no DOM dos controles                                           |
| Aba Parceiras               | Sufixo `pUYysrvJ` no ID do tab/panel                                    | Tabela visivel com VGV e CONTRATOS; confirmar ID Engine antes de usar API |
| Tabela Parceiras            | Primeira coluna rotulada `CORRETOR`, com nomes de parceiras             | Rotulo nao comprova identidade nem dimensao fisica IMOB                   |
| Mensal/Diario               | Conteiner `6983e9b2-c8c8-43a3-aa8b-6e1af656e4b5`                        | Series de VGV/contratos; nao e export mensal homologado                   |
| Atualizacao                 | Texto `14/10/2026 - 01:07:55`; informa atualizacao a cada hora          | Fuso e timestamp tecnico pendentes                                        |

Filtros visiveis: Data, Empresa, Regional, Ranking, Origem, Criador da
Oportunidade, Papel do Usuario, Produto, Canal de Vendas e Bolsao.
Na inspecao inicial dessa pasta havia **nenhuma selecao aplicada**. O recorte
nao foi comprovado; seus totais nao servem ainda de carga da pagina de parcerias.
Ausencia de selecao nao exclui restricoes internas do aplicativo ou das medidas.

O menu da tabela ofereceu copiar celula, baixar e opcoes do conteiner;
nao apresentou a expressao das medidas. Isso limita a evidencia desta
inspecao, nao comprova inexistencia dos metadados ou falta de permissao global.
O catalogo de campos do aplicativo comercial ficou sem rotulos carregados na
busca Canal e a ferramenta de navegador apresentou timeouts repetidos. Nao
classificar esse resultado como campo ausente; retomar a inspecao quando a
interface responder. A pesquisa anterior de Visao House nao o substitui.
O objeto de empreendimentos com VGV ainda precisa ser identificado: a tabela
`Dados de Fluxo` nao e substituta, pois tem filtro proprio de tabela Associativo
e outras medidas. Nao coletar rendas, FGTS, clientes ou dados de fluxo.

## Matriz origem -> contrato -> exibicao

`observed` significa apenas rotulo/campo visto. `unresolved` exige prova de
semantica, selecao ou cobertura. Nenhuma linha abaixo esta homologada ponta a
ponta; nao converter ausencia em zero nem estimar VGV por ticket medio.

| Requisito           | Origem a comprovar                                | Contrato existente                               | Uso/validacao                                                          |
| ------------------- | ------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Ano                 | Calendario da medida comercial                    | `referenceYear`                                  | Ano coerente com todas as competencias                                 |
| Competencia         | Data-base da venda/contrato, nao data da coleta   | `periodMonth`                                    | Primeiro dia do mes; fechar historico e virada de ano                  |
| Imobiliaria ID      | Dimensao oficial da aba Parceiras                 | `imobKey`                                        | Chave estavel; nao gerar slug apenas do nome                           |
| Imobiliaria nome    | Rotulo observado na tabela Parceiras              | `imobName`                                       | Apresentacao/busca, nao chave de deduplicacao                          |
| Unidade IMOB        | Empresa/unidade efetivamente selecionada          | Ausente em `entries`                             | Garantir snapshot mono-unidade; nao misturar empresas                  |
| Empreendimento ID   | Dimensao oficial de produto/empreendimento        | `developmentKey`                                 | Identidade persistente; homonimos nao se fundem                        |
| Empreendimento nome | Tabela de produto com VGV homologada              | `developmentName`                                | Exibicao, nao identidade                                               |
| Unidade produto     | Empresa/unidade oficial                           | `businessUnit`                                   | Mesmo universo das IMOBs                                               |
| VGV                 | Medida VGV observada; expressao ainda nao exposta | `vgv` decimal em string                          | BRL/precisao, cancelamentos, rateios e regra de sinal                  |
| Contratos           | Medida CONTRATOS observada; expressao pendente    | `contracts` inteiro                              | Distinct/contagem e chave do contrato; venda != contrato por suposicao |
| Posicao origem      | Ordenacao oficial das duas medidas                | `sourceRankVgv`, `sourceRankContracts` opcionais | Desempate precisa ser deterministico e conciliado                      |
| Fonte atualizada    | Timestamp de recarga da fonte                     | `sourceUpdatedAt` opcional                       | Manter distinto de processamento; confirmar fuso                       |
| Processamento       | Instante do snapshot aprovado                     | `generatedAt`                                    | Nao ocultar fonte antiga com timestamp novo                            |
| Identidade da carga | Execucao imutavel e conteudo                      | `requestId`, `schemaVersion: 1`                  | Replay identico; payload divergente rejeitado                          |
| Cobertura           | Todas as paginas/meses/entidades no mesmo recorte | Nao explicita no v1                              | Exigir evidencia; maximo 5000 nao prova completude                     |
| Movimento           | Snapshot anterior comparavel                      | Runs persistidos; leitor de comparacao ausente   | Mesmo periodo, unidade, escopo e desempate                             |
| Podio/top 10        | Populacao reconciliada                            | Derivado, nao campo de ingestao                  | Ordenar depois de agregar periodo, limitar so exibicao                 |
| Diferenca ao alvo   | VGV da posicao seguinte menos VGV atual           | Derivado                                         | Centavos exatos; empate e lider tratados explicitamente                |
| Totais/producao     | Populacao inteira                                 | Derivado                                         | Somar contratos/VGV; contar entidades distintas elegiveis              |

## Contratos locais e riscos confirmados

1. `lib/crm/integrations/contracts.ts` define envelope Qlik v1, IMOB mensal e
   empreendimento mensal/unidade. IMOB nao transporta unidade; developments e
   sourceUpdatedAt sao opcionais, sem declarar indisponibilidade/completude.
2. `app/api/ingest/qlik/route.ts` usa relay HMAC em `lib/crm/qlik/handler.ts`.
   Configuracao `off` por padrao; existencia do endpoint nao comprova ativacao.
3. Tabelas Qlik versionadas sao separadas do Salesforce. A RPC historica grava
   `SP CAPITAL`/`Direcional` como literais, nao como selecao Qlik comprovada.
4. `list_scoped_crm_imob_ranking_entries` exige mapeamento de identidade,
   responsavel/organizacao/grants ativos e permissao. Pagina varios runs;
   nao fornece por si o snapshot atual/anterior e os produtos conciliados.
5. `/app/canal-de-parcerias` e previa sem consulta real, protegida por
   `crm.partnerships.view`. Nao atribuir dados de corretor a essa tela.
6. `lib/archive-investor/partnership-ranking-views.mjs` contem helpers de
   periodos, ordenacao e variacao. Mes atual usa ultimo mes disponivel;
   valores usam `Number`; produtos podem agrupar por nome. Nao importar como
   autoridade sem testes de precisao, identidades e calendario.
7. O mesmo helper usa substring normalizada `SPC - CANAL IMOB PJ` para filtrar
   vendas de produtos. E pista historica de canal, nao selecao Qlik homologada.
   Exclui amount nao positivo, deduplica somente quando key existe e incrementa
   contratos por linha; nao demonstra equivalencia com as medidas Qlik.
8. O runbook de ingestao descreve servico/workflow de agosto. Conferencia
   operacional anterior desta tarefa nao encontrou esse publisher ativo.
   A atividade do legado nao foi comprovada. Nao presumir que a comparacao
   shadow esta disponivel, nem recriar publicador com autenticacao anonima.
   Substituir esse gate exige decisao explicita e evidencia equivalente.

Fontes versionadas: `docs/qlik-relay-mapping-cutover/CALLER_AND_CONSUMERS.md`,
`supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql`,
`supabase/migrations/20260809181424_crm_read_model_v3.sql`.
Marcadores sanitizados de migrations nao comprovam implementacao remota.

## Fechamento do mapeamento e ativacao

- Comprovar canal, empresa, regional e calendario nas duas agregacoes; nao
  transportar `DIRECIONAL VENDAS SPC` do escopo substituido.
- Obter definicao das dimensoes/medidas e IDs dos objetos reais; resolver a
  coluna `CORRETOR` da aba Parceiras e o objeto de produtos.
- Conciliar mes fechado com todos os registros, mesmos filtros e recarga,
  mostrando totais nativos versus recebidos. Depois conferir ano/custom.
- Testar duplicacao, nulos, cancelamentos, homonimos, virada de ano, empates,
  zero legitimo, vazio, dados atrasados, timeout e pagina incompleta.
- Definir leitura autorizada de snapshots comparaveis e cobertura atomica de
  IMOBs/produtos. Nao conceder CRUD direto as tabelas Qlik.
- Reconciliar migrations instaladas antes de qualquer escrita. Autorizacao
  anterior exige testes e backup; nao libera cadeia inteira, novas contas ou
  politicas. Leandro/Alvaro continuam indicados, sem identidade vinculada.
- Somente apos essa evidencia implementar coletor, validar duas cargas,
  preservar ultima base valida e habilitar agenda na VPS. Login persistente
  nao garante reautenticacao eterna e nao deve contornar MFA.

Estado: inventario funcional completo, candidato Qlik localizado e contrato
local mapeado; formulas, recorte e conciliacao produtiva ainda `unresolved`.
Nenhuma coleta automatica ou publicacao de dados foi declarada concluida.
