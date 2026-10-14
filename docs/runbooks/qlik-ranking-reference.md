# Ranking Qlik: referencia integral e contrato pendente

## Proveniencia e estado

Inspecao em 14/10/2026, branch `codex/qlik-ranking-vps`, base `1313d64`.
Referencia indicada pelo usuario: https://descomplicapro.com.br/ranking.
Destino: https://crm.descomplicapro.com.br/app/ranking.
Metodo: leitura visual/AX das visoes Corretores e Gerentes, sem salvar
configuracoes ou copiar registros de pessoas para este documento.

O estado vazio da referencia identifica a imobiliaria **DIRECIONAL VENDAS SPC**.
Isso define o recorte desejado, mas nao prova o nome tecnico do campo Qlik,
um ID de organizacao, nem equivalencia com a regional SP CAPITAL.
A referencia exibe sincronizacao em 07/08/2026; seus numeros nao sao uma base
atual para conciliar a coleta de outubro. A mudanca de visao tambem apresentou
periodos diferentes; comparar fontes somente com filtros e instante fixados.

O usuario autorizou migracao aditiva e isolada para Qlik, apos testes e backup,
preservando o ranking Salesforce. Indicou Leandro como responsavel e Alvaro
como substituto. Identidades cadastradas e pacote de politica seguem pendentes.
Esta autorizacao nao ativa pontos, premios, grants amplos ou coleta sem recorte.

Preflight somente leitura no projeto `hnncxuerlcsaahdxoswb`, confirmado pelo
catalogo MCP e auditoria de ambiente de13/10: nao existem
`private.crm_integration_owners`, `private.crm_commercial_engine_catalog`,
`private.crm_commercial_policy_versions` ou `private.crm_commercial_engine_gates`.
Portanto, os nomes indicados ainda nao podem ser vinculados ao registro de
responsaveis do runtime. Reconciliar dependencias das migrations antes de
aplicar a fundacao; nao executar a cadeia inteira por suposicao. Nenhum dado
de autenticacao ou perfil foi exportado, e nenhuma escrita foi feita.

## Inventario completo observado

| Area                 | Conteudo a preservar                                                                                                         | Situacao no CRM novo                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Metas comerciais     | Links Direcional Vendas, Canal Parcerias e Meta por pontos; data de alteracao; sete pesos editaveis e salvar autorizado      | Configuracao em rota separada, rascunho sem autoridade comercial |
| Visao                | Corretores e gerentes; data de sincronizacao                                                                                 | Ambas existem; fonte Qlik ainda nao ligada                       |
| Periodos             | Ano, mes, mes atual, semana passada, esta semana, ontem, hoje                                                                | Somente quatro atalhos; faltam ontem e calendario                |
| Pessoas              | Corretor e gerente; visao de gerentes nao mostra filtro de corretor                                                          | Filtros ausentes; exigir IDs estaveis                            |
| Podio                | Prata/ouro/bronze, nome, gerente ou tamanho da equipe, pontos, distancia para proxima posicao e alvo                         | Podio parcial; nao inventar nomes/pontos em indisponibilidade    |
| Placar               | Posicao, roleta, agendamentos, visitas, pastas aprovadas, vendas, pontos por acao, tres conversoes, SLA, base, bonus e total | Tabela parcial; SLA e duas conversoes ausentes                   |
| Resumo               | Contagens e pontos de todas as metricas, conversoes, perdas SLA, desconto, producao, bonus e total                           | Ausente como secao completa                                      |
| Explicacao           | Pesos, formula, arredondamento, exemplo, seis criterios de desempate                                                         | Ausente; so publicar regra com autoridade validada               |
| Pulso                | Quantos corretores produziram em cada uma das cinco etapas, denominador e percentual                                         | Ausente; denominador precisa ser reconciliado                    |
| Equipes              | Corretores ativos por gerente, participacao na equipe, pessoas sem vinculo                                                   | Ausente; roster atual nao equivale a participantes com producao  |
| Comparativo gerentes | Tabela com cinco etapas, pontos, conversao, produtividade, perdas e resultado final                                          | Ausente como comparativo especifico                              |
| SLA gerentes         | Perdas por gerente, criador da oportunidade, ultima fase, desconto e resultado; equacao consolidada                          | Ausente; nao transportar dados de clientes desnecessarios        |
| Premiacoes           | Campeao mensal, sorteios por metas, campeao semanal, valores e criterios cumulativos                                         | Indisponiveis ate politica, vigencia e aprovacao                 |
| Ajuda                | Orientacao para procurar gerente ou Regional Leandro Lucas                                                                   | Preservar orientacao no destino                                  |

## Regras exibidas, ainda nao homologadas

- Pesos: roleta dias uteis 1, sabado 2, domingo 3; agenda 1; visita 7;
  pasta aprovada 4; venda 10.
- Corretor: soma por acao; bonus por conversao de agendas em visitas,
  arredondado para baixo. Ausencia de denominador e conversao acima de 100%
  exigem casos aprovados, nao inferencia de uma tela.
- Gerente: producao da propria equipe, bonus separados de conversoes e
  produtividade. O pulso utiliza percentuais inteiros por etapa e por gerente.
  Uma soma dos percentuais globais nao substitui a soma por equipe.
- SLA: texto visivel desconta um ponto por oportunidade com motivo
  `SLA - Automatico`. O inventario anterior detectou divergencia com campos
  "Criada Pelo SLA". Nao confundir criacao automatica com perda efetiva.
- Desempate: visitas, conversao agenda/visita, pastas aprovadas, conversao
  visita/pasta, vendas, conversao pasta/venda, nessa ordem. Empate final ainda
  precisa de definicao oficial.
- Campeao mensal: ate R$ 1.500 em midia Facebook; texto especifica R$ 500 em
  boleto e R$ 500 adicionais quando o corretor tambem investir R$ 500;
  vale-jantar de R$ 100. Nao interpretar esse texto como ordem de pagamento.
- Premio semanal: R$ 250 por meta, em cinco sorteios de R$ 50 de segunda a
  sexta entre presentes na loja. Agenda exige 100% com ao menos uma e 50 na
  regional por semana; visita e pasta exigem 100%; venda exige 70%.
- Campeao semanal em pontos: vale-jantar de R$ 100. Premios por indicador
  aparecem como cumulativos. Vigencia, elegibilidade, aprovacao, tributacao,
  estorno e fechamento nao estao definidos pela tela.

Referencias locais de autoridade:
`docs/commercial-engines-policy-runtime/POLICY_CONTRACT.md`,
`docs/commercial-engines-policy-runtime/REMAINING_DECISIONS.md` e
`docs/reconciliation/COMMERCIAL_POLICY_INVENTORY.md`.
Nao alterar `rankingPolicyAuthorityAvailable()` para liberar a tela.

## Fonte e separacao de escritores

- Tenant autorizado: `direcional.us.qlikcloud.com`.
- App candidato observado: Visao House,
  `00171c17-48de-4488-b1f9-dd6dcb0249e2`.
- A sessao dedicada na VPS abriu Agendamentos; somente ano 2026 selecionado
  e totais de varias regionais. Nao e coleta aprovada para o ranking.
- Filtros visiveis incluem Empresa, Regional, Ranking, Papel do Usuario,
  Criador da Oportunidade, Produto, Canal de Vendas, Diretor de Vendas,
  Gerente de Regional, Gerente de Vendas, Corretor, Fase, Origem da Conta,
  Captacao do Cliente e Bolsao. Rotulo visual nao prova campo ou ID tecnico.
- Confirmar objetos, dimensoes, medidas, selecoes efetivas, IDs de pessoas,
  organizacao, datas/fuso e fontes de roleta/SLA antes de exportar.
- Rejeitar timeout, pagina incompleta, selecao abrangente, campo ausente ou
  metrica desconhecida. Nao completar ausencia com zero.
- Salesforce escreve `crm_ranking_snapshots/global`. O relay Qlik existente
  trata imobiliarias/VGV/contratos; nao reutilizar nenhum desses contratos
  para simular atividades de corretores.
- Preparar armazenamento Qlik privado e RPC dedicada, com idempotencia,
  proveniencia, reconciliacao, ACL/RLS e pgTAP. Aplicar somente apos backup
  validado e testes; nao conceder acesso direto as tabelas Qlik existentes.

## Aceite de ponta a ponta

1. Recorte exato comprovado na origem e todas as paginas coletadas.
2. IDs, vinculos, datas e metricas reconciliados, incluindo ausencias explicitas.
3. Escritor Qlik isolado e replay identico sem duplicacao, sem tocar no global.
4. Duas coletas distintas conciliadas, falha preservando ultima base valida.
5. Politica versionada, owner/backup distintos, casos de ouro, gate e coorte.
6. Todas as secoes e filtros acima validados com fixtures sinteticas,
   teclado, temas, desktop/mobile e indisponibilidade honesta.
7. CI no SHA exato, merge e publicacao pelo coordenador oficial; so depois
   confirmar primeira atualizacao real e habilitar agenda operacional.

Login/cofre nao equivalem a coleta, ingestao, agenda ou ranking publicado.

## Preflight offline

`ops/qlik/ranking-scope.mjs` valida somente declaracoes de campo, selecao e
cobertura. Usa o app como candidato e nao como mapeamento aprovado. Evidencias
precisam ser conferidas contra a fonte por quem preparar a coleta; preencher
`evidenceRef` nao comprova seu conteudo. Os resultados
`productionMappingVerified` e `collectionAuthorized` permanecem falsos,
inclusive com `requirementsMet: true`. Nenhum servico chama esse modulo ainda.

Fixtures sinteticas em `ranking-scope.node-test.mjs` cobrem recorte ausente,
multiplas organizacoes, fonte incorreta, evidencia ausente, timeout, paginacao
incompleta, contagens divergentes e accessors sem execucao. Isso nao e um teste
de integracao Qlik ou de ingestao remota.
