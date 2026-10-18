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
