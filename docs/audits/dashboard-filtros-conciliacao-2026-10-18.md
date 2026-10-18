# Dashboard: filtros e conciliacao de 18/10/2026

## Proveniencia

- Base publicada d919751a51772dd0c57a582b9581e61412642ced, PR254,
  CI39100233037 success; health200/ok em10:54 America/Sao_Paulo.
- Video do usuario inspecionado localmente,74,87s. Quadros35s e70s mostram
  STATUS_BREAKPOINT apos interacoes nos filtros. Nao versionar video/frames.
- Carga existente gerada2026-10-18T13:32:48.967Z, referencia2026-10-18,
  cobertura desde2026-01-01, requestId5f6ad2ce-1f65-4b7e-9a6a-df45b9cb6ee5.
  SHA256608c9a23a1b25e88c9661ff150b68b688efda0070d7bb654dc64a3473146e8ae.
  Leitura agregada no host10:56-10:57 sem copiar registros ou credenciais.

## Conciliacao

Ordem: oportunidades, agendamentos, visitas, pastas e vendas. Nenhum filtro
adicional selecionado na UI inicial; todos os canais continua restrito a
SPC - CANAL IMOB PJ e DIRECIONAL VENDAS SPC.

| Recorte                      | Oportunidades | Agendamentos | Visitas | Pastas | Vendas |
| ---------------------------- | ------------: | -----------: | ------: | -----: | -----: |
| Mes, ambos                   |           913 |           68 |      51 |    128 |     13 |
| Mes, canal imobiliarias      |           259 |           26 |      33 |    103 |     10 |
| Mes, Direcional              |           654 |           42 |      18 |     25 |      3 |
| Hoje                         |            16 |            0 |       0 |      0 |      0 |
| Ontem                        |            45 |            4 |       4 |      8 |      0 |
| Semana anterior05-11/10      |           275 |           27 |      29 |     45 |      9 |
| Esta semana12-18/10          |           356 |           21 |       9 |     57 |      2 |
| Setembro                     |          1714 |          115 |      59 |    209 |     57 |
| Media janeiro-setembro, piso |          2148 |          114 |      50 |    279 |     80 |
| Media julho-setembro, piso   |          1680 |          146 |      60 |    200 |     58 |

Valores da carga coincidem com a UI. Recorte Direcional tambem verificado
por selecao real no navegador. Empresa sem informacao ("-") exibe
895/0/0/0/0 e266responsaveis. Sem filtro sao315responsaveis unicos ao longo
da cobertura;70 com atividade no mes. Metas mantem regra autorizada de
responsaveis unicos dos relatorios filtrados, nao cadastro de corretores.

Totais coletados20316/1110/522/2658/733 nao sao os totais do mes nem apenas
os dois canais. Oportunidades/pastas/agendamentos usam criacao, visitas
comparecimento e vendas data da venda. Pastas aprovadas continuam indisponiveis.

## Correcao e limites

- Substitui details/summary e fieldset rolavel por botao com aria-expanded,
  aria-controls e grupo de checkboxes controlado por React. Um menu aberto,
  clique externo e Tab preservam foco externo; Escape retorna ao acionador.
- Sem alteracao no coletor, banco, calculos, regras comerciais ou permissoes.
- O video prova recorrencia, nao a causa interna do Chrome. A sequencia foi
  parcialmente reproduzida sem crash; houve timeout posterior do controle
  do navegador sem imagem que confirme STATUS_BREAKPOINT. Nao atribuir esse
  timeout a mesma causa sem evidencia. Mitigacao remove o caminho nativo.
- A igualdade carga/UI nao equivale a executar novamente os relatorios no
  Salesforce. Nenhuma coleta ou ingestao foi disparada para esta auditoria.
- Validacao local: typecheck e build aprovados;32 testes do dashboard aprovados.
  QA dashboard207 checks aprovados em light/balanced/dark e320/390/768/1440/1920,
  incluindo layout, axe, filtros, foco, popups, metas, navegacao e erros de browser.
  Lint aprovado com exclusao CLI de test-results (artefatos locais nao versionados);
  tentativa integral interrompida ao percorrer artefatos acumulados. CI limpa
  mantem pnpm lint sem exclusao adicional. Suite completa, CI e deploy pendentes.

## Rechecagem da carga e do navegador

- Carga de 18/10/2026 11:02:59.121 America/Sao_Paulo, lida em11:20:48:
  requestId fcface7b-335b-4829-a63d-c6ac38aff083, SHA256
  0c65005002fc0b50d8e7e1e265be35e74c111b53fb585b5d0dd6dd2d092f17cd.
  Mes ambos916/68/51/128/13; Imob259/26/33/103/10;
  Direcional657/42/18/25/3. UI reaberta confirma ambos, sem filtros adicionais.
  Diferenca da carga anterior: tres oportunidades no Direcional.
- Relatorios brutos nao localizados nos caminhos examinados. Descoberta
  encerrada sem exportar registros. Prova limitada a artefato coletado versus
  UI; nao afirmar reconciliacao independente dos relatorios brutos.
- Apos usuario reabrir a aba, quatro filtros abriram e fecharam por clique
  externo sem crash nesta tentativa. Ainda era a versao publicada d919751a,
  portanto essa observacao nao valida a mitigacao nova em producao.
- Baseline isolada: Chrome155/Chromium151, oito casos imediatos e dois
  pending controlados sem crash. Erros iniciais de harness preservados no
  relatorio local. Causa nativa continua nao demonstrada.
- Vitest completo:3808 aprovados/95 ignorados. Operacionais Windows:
  1593 aprovados/3 falhas/19 ignorados; release:712 aprovados/11 falhas/14
  ignorados, falhas de fixtures POSIX Meta Ads. CI Linux39135151478 aprovou
  lint, tipos e testes completos, mas bloqueou na fonte ITBI HTTP403:
  https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517.
  Nenhum gate foi dispensado. PR255 ainda nao publicado.
- Regressao de browser inicial excedeu240s globais no quarto contexto;
  nao registrar como aprovada. Casos sendo separados sem reduzir assercoes.

## Regressao e CI do controle React

- Casos separados no commit3dde464d: quatro aprovados,32 ciclos completos,
  Chromium Windows/Node24.19.0; duracoes117,303/109,279/92,975/101,029s.
  Desktop/celular com resposta imediata/pending, incluindo troca por toque.
  Format e tipos aprovados. Nao prova causa interna do crash nativo.
- CI39136199536 aprovou validate, restore, dashboard sintetico e banco.
  E2E autenticado parou em e2e/release-candidate.spec.ts:1588 por procurar
  quatro summary antigos; recebido zero porque agora sao botoes acessiveis.
  Atualizado seletor e acrescentada abertura/fechamento externo dos quatro
  filtros no navegador autenticado. Nenhuma assercao comercial removida.
  Matriz visual completa nao executou nessa tentativa; nova CI obrigatoria.
- CI39138212029 aprovou tambem E2E autenticado. Matriz parou no helper
  dashboard-auto-refresh.mjs, que ainda usava details/summary para o filtro.
  Migrado para botao/grupo, conferindo aria-expanded e visibilidade antes e
  depois do refresh RSC. Preservadas selecao oculta, scroll, unica requisicao
  concorrente e details nativo das conversoes, que nao mudou no produto.
- CI39140025155 aprovada integralmente no head4877dd76, inclusive matriz
  autenticada. main recebeu PR256/6b6e88fb durante validacao; integrado
  ao branch porque protecao exige base atualizada. Nova CI do conjunto e
  ativacao coordenada da migration de Previsao pendentes. Health16:11Z ainda
  d919751a; nao confundir aprovacao do PR com publicacao.
