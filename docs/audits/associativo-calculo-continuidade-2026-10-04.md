# Associativo: calculo e continuidade

## Escopo

Fonte: pedido direto do usuario em 04/10/2026, dez capturas de referencia e
efeito visual em https://reactbits.dev/components/specular-button.
Branch `codex/associativo-calculo-e-continuidade`, base `c73d155`.

Somente Associativo e enriquecimento de inventario compartilhado. A pagina
Tabelao de referencia, politicas comerciais, schema e workflows n8n permanecem
inalterados. Nenhuma proposta, cliente ou estoque bruto foi exportado.

## Causas

- `selectUnit` reinicializava perfil e composicao em cada selecao; os handlers
  de renda e modalidade tambem apagavam respostas e ranking.
- O forecast subordinava a maior parcela ao andamento da obra, embora o
  comprometimento nao dependa dessa informacao. A camada de aprovacao convertia
  valores ausentes em zero. A tela mostrava zero e uma espera sem acao possivel.
- O carregamento vivo precisava aguardar a referencia comercial e enriquecer
  apenas correspondencias unicas antes de disponibilizar a unidade.

## Contratos

- Comprometimento: maior parcela corrigida do cronograma dividida pela renda.
- Maximo mensal: maior parcela mais evolucao de obra no mesmo mes, dividida
  pela renda. Anuais nao sao somadas novamente a esse indicador.
- Mes vigente e seguinte sem cobranca de evolucao; terceiro mes inicia renda
  vezes 30% vezes andamento. Na entrega, andamento atinge 100% e congela.
- Dados ausentes, invalidos ou cronogramas incompletos nao produzem aprovacao.
  Zero efetivamente calculado continua diferente de dado desconhecido.
- O painel respeita o status do motor mesmo se um flag pronto contradisser
  valores ausentes. Esse estado defensivo possui regressao de renderizacao real.
- Limites em centavos preservam as comparacoes exatas existentes; percentuais
  arredondados na tela nao sao usados para aprovar.
- Troca de unidade preserva recursos e respostas, atualiza preco e entrega e
  descarta apenas a avaliacao manual especifica da unidade anterior.
- Avaliacao real tem prioridade; complemento exige incorporadora, empreendimento
  e identificador unicos nas duas fontes. Ausencia ou ambiguidade nao autoriza
  usar preco de venda ou valor de outra unidade.
- Brilho de atencao dourado em area inteira, 4,5 segundos; reprovacao conserva
  vermelho metalico e ciclo de 3 segundos. Movimento reduzido e foco preservados.

## Validacao

- Testes financeiros focados: 80 aprovados.
- Handlers reais e renderizacao do painel: 13 aprovados. Enriquecimento real
  extraido por AST: 11 aprovados, incluindo unidade vizinha no mesmo projeto.
- Lint, typecheck, build e audit aprovados em Node 24.19.0 / pnpm 11.20.0.
  O alerta de braces permanece corrigido na base; nenhuma vulnerabilidade conhecida.
- Suite Windows: 1596 aprovados, um ignorado e oito falhas: seis de modos
  POSIX/symlinks, duas por timeout em ferramentas locais. Repeticao serial de
  knowledge/devtools: 43 aprovados e tres timeouts de knowledge, incluindo hook
  de limpeza. Sem mudar limites ou ignorar testes. Exige suite Linux na CI.
- Oito testes Node Salesforce aprovados separadamente, pois o comando encadeado
  da suite completa encerra antes deles diante de falhas Vitest.
- Seis jornadas 1440/375px nos tres temas aprovadas com CSS minificado; imagens
  desktop/mobile revisadas. Cabecalho local simplificado usa o frame e temas
  reais; matriz autenticada da CI continua obrigatoria para a navegacao completa.
- Cinco cenarios de continuidade aprovados em Chromium 151.0.7922.34, somente
  dados sinteticos e zero requisicoes externas: referencia, renda, troca de
  unidade, ausencia de obra, ausencia de avaliacao. Integrados ao gate de CI.
- Prova de pixels aprovada nas seis combinacoes: brilho no interior do perfil,
  linha e classificacao. Sem promover baseline visual ou reduzir gates.
- CI 37202986207: 1615 testes Vitest e oito Node aprovados, lint/tipos/build/audit,
  banco e restore aprovados. E2E parou na expectativa antiga de apagar ranking
  ao editar renda. O contrato agora exige manter escolhas e recalcular ambos os
  comprometimentos proporcionalmente a nova renda, sem tocar no isolamento.
  Nova execucao 37203612944 aprovada integralmente antes do merge do PR #145.
- Main 106d626: CI 37205634578 integralmente aprovada, incluindo imagem unica,
  dois perfis de runtime, restore, E2E concorrente e navegacao autenticada.
- Matriz do SHA publicado: 147 verificacoes responsivas, 84 de tema, 201 Axe,
  105 de zoom, 201 capturas e 40 combinacoes das jornadas arquivadas. Baseline
  permaneceu intacta. Continuidade e cinco cenarios financeiros passaram em
  375 e 1440 px; orientacao passou nos tres temas nessas duas larguras.
- Artefato visual 11305920436, SHA-256
  `65c8edc999ab3ebc3097704714dd8968c73db36cbbf722cc1e0b71ed2990f27c`.

## Publicacao

Publicada em 04/10/2026 pelo PR #145, SHA
`106d626850a6cc782ec198387074be9e8901dd78`, sem rebuild na VPS.

- Imagem do artefato 11303864491, ZIP SHA-256
  `fb0153a936f16a72a671088d907fb216f56a9ed43025eb4114604f98f6f1b7c4`.
- Arquivo image.tar.gz SHA-256
  `42fe707cdc02ace7510526946f0a9b65eebaf3234f9ce7b201c85eee40a6df04`.
- Configuracao CI: `sha256:95f7eaccf78adbeee7beee9c8fc60a6ca7049662753da83172a889b85f2d705b`.
  Manifesto no destino: `sha256:3b7db4fe776e740809e67ab1e5045ecaca999e035da7815b377c7ecad0cdc1df`.
  Cadeia OCI, plataforma, label e 11 camadas comprovadas sobre o mesmo artefato.
  `image:prove` validou novamente os dois perfis no destino, sem imprimir segredos.
- Versao anterior `c73d1555ffa07277eaa93af7f76f663fa74647f0`, imagem
  `sha256:15edc85ed8e3002697e9619caff78d27050b2c38bfde24d8ca190c1f87cb9c96`.
- Checkout isolado em `/srv/descomplica-crm-releases/106d626850a6cc782ec198387074be9e8901dd78`;
  checkout principal preservado. Backup privado verificado em
  `/var/backups/descomplica-crm/releases/106d626850a6cc782ec198387074be9e8901dd78.xTrDB5`.
  Bind por compare-and-swap e rollback preparados. Nginx permaneceu identico.
- Health local/publico confirmou o SHA, container healthy, inventario anonimo
  negado com 401 e pagina protegida com 307. Smoke limitado: 12 GETs, concorrencia
  maxima quatro, zero erros; nao e prova de capacidade de producao.
- Conferencia autenticada em aba separada: avaliacao e andamento presentes,
  percentuais calculados, renda e unidade editadas sem apagar respostas,
  recursos ou 84 parcelas. Valores sinteticos nao salvos. Zero erros de navegador;
  alinhamentos e selecoes douradas revisados. Aba temporaria encerrada.
- Nenhuma migration, alteracao de Nginx, dados remotos, politica ou workflow n8n.
  Este registro documental nao requer reiniciar a aplicacao.

Nao ha promessa de ausencia absoluta de falhas: regressao automatizada e
bloqueio de resultados incompletos reduzem o risco de uma aprovacao indevida.
