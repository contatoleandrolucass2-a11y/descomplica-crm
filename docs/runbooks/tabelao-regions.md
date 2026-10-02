# Regioes e vagas do Tabelao

## Contrato

Pedido confirmado em 01/10/2026: regioes municipais de Sao Paulo (Centro,
Norte, Sul, Leste e Oeste), nao zoneamento urbanistico. O estoque publicado
fornece `postalCode` e `parkingSpaces`. A aplicacao nao transforma consulta
recente em estoque recente: `generatedAt` permanece a data da origem.

Cada opcao e o menor valor liquido por incorporadora, empreendimento, planta
e quantidade de vagas. O estoque conta IDs distintos dentro dessa combinacao,
inclusive unidades sem preco elegivel. `0` representa nenhuma vaga;
ausente/null representa quantidade nao informada. Nao inferir vagas da planta.

## Fontes territoriais

- [ViaCEP](https://viacep.com.br/): CEP exato, municipio, UF, codigo IBGE e
  logradouro. `regiao` do ViaCEP e a regiao do Brasil, nunca a zona municipal.
- [Localiza Sampa](http://www.sinasc.saude.prefeitura.sp.gov.br/localizasampa/default.asp):
  consulta `buscacep.asp?r2=<CEP>`, tabela HTML com CEP, logradouro, faixa,
  distrito, codigo do distrito, bairro e COD.LOCALIZA.
  A Prefeitura documenta o servico no [anuncio de 2019](https://prefeitura.sp.gov.br/web/saude/w/noticias/273776)
  e no [manual municipal de enderecos de 2024](https://prefeitura.sp.gov.br/documents/d/saude/manualendereco-2024_3ed).
  Versao observada 1.6.1; data de atualizacao da base nao informada.
- [GeoSampa WFS](https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=DescribeFeatureType&typeNames=geoportal:distrito_municipal):
  camada `geoportal:distrito_municipal`, campos `nm_distrito_municipal` e
  `nm_regiao_05`. Consulta completa de 96 distritos conferida em 01/10/2026;
  `dt_atualizacao` observado em 20/03/2026. O runtime reconsulta a base.

As duas fontes municipais nao compartilham a mesma codificacao de distritos.
O cruzamento usa nomes oficiais normalizados, nunca codigo numerico. A regiao
vem de `nm_regiao_05`, nao de aliases de bairros nem de faixas aproximadas de CEP.

Somente Sao Paulo/SP, IBGE 3550308, e elegivel. CEP e logradouro precisam
concordar nas fontes de endereco. A resposta municipal precisa conter todos
os registros anunciados, com colunas e campos validos. Todos os distritos do
CEP devem existir no GeoSampa e pertencer a uma unica regiao. Caso contrario,
exibir **Nao confirmada**. Municipio confirmado diferente: **Fora de Sao Paulo**.

Exemplos publicos de verificacao: 01509-020 resulta em Liberdade/Centro;
01311-000 retorna Vila Mariana e Jardim Paulista, portanto permanece ambiguo;
20040-002 pertence ao Rio de Janeiro e nao dispara consultas municipais paulistanas.
Nao usar esses exemplos como tabela fixa de CEPs.

## Automacao e limites

`GET /api/inventory/regions?postalCodes=CEP1,CEP2,...` aceita ate oito CEPs,
com autorizacao `crm.simulators.view` uma vez por lote, antes do cache. A forma
singular `?postalCode=...` tambem e aceita. Parametros misturados, repetidos,
CEPs duplicados ou invalidos sao rejeitados. Respostas HTTP sao `no-store`; dados territoriais publicos ficam
somente em memoria, sem cookies, usuarios, projetos ou valores comerciais.

- Cache LRU de ate 256 CEPs, TTL de 24 horas, falhas/ambiguidades por 60 segundos.
- Chamadas simultaneas do mesmo CEP compartilham a consulta. Tres consultas
  ativas por processo, fila de ate 32 com espera maxima de cinco segundos.
- Origem limitada a 18 segundos, GeoSampa compartilhado a 15 segundos e 6 MB;
  HTML a 250 KB e ViaCEP a 20 KB. Sem redirecionamentos externos.
- Cliente tem tres lotes simultaneos de ate oito CEPs, ate 256 CEPs distintos e
  25 segundos por lote. Para 22 CEPs, tres autorizacoes por pagina em vez de 22.
  Aborta ao sair/recarregar, sem cancelar consultas de outros usuarios.
- Estoque aparece antes da localizacao. Respostas geograficas preservam enderecos,
  filtros e ordenacao; selecao sem correspondencias continua visivel com contagem zero.

Novos CEPs entram automaticamente a cada carga do estoque, sem cadastrar
empreendimentos manualmente nem criar cron mensal. Nao ha escrita no banco,
migration, atualizacao de workflow n8n ou envio de propostas/dados pessoais.

Nao existe garantia de erro zero: dependemos de CEP correto e atualizado na
origem e das bases externas. Localiza Sampa so respondeu por HTTP na verificacao,
sem contrato publico de API ou SLA localizado; transporte nao oferece integridade
TLS. Mudanca de HTML, fonte indisponivel, CEP ambiguo ou conflito nao autoriza chute.
Nao ha desambiguacao por numero/geometria nesta entrega. Esses casos exigem
validacao cadastral/geografica posterior. O snapshot de enderecos nao e autoridade
para inventar uma zona nem para vagas mensais de novas unidades.

`parse5` e dependencia de runtime para analisar HTML sem executa-lo. Somente
CEPs sao enviados para os provedores; nomes, estoque e dados de clientes nao saem.
O contrato territorial exige os 96 distritos verificados; mudanca dessa cardinalidade
exige revisao da base, nao classificacao silenciosa. Novos empreendimentos e CEPs nao
exigem alteracao dessa lista. O mapa de distritos tem TTL de 24 horas e cooldown de um minuto. Reinicios
descartam os caches; multiplos processos nao compartilham memoria.

## Validacao e reversao

Executar lint, typecheck, test, build e CI Linux. Testes incluem autorizacao
fria/quente, contratos malformados, ambiguidade, filas/coalescencia, TTL e falhas,
vagas 0/1/2/desconhecidas, minimo/estoque por grupo e filtros autoexcludentes.
A matriz autenticada usa fontes sinteticas e valida 14 colunas, responsividade,
texto completo, centralizacao e chegada de regioes sem perder selecoes.

Promover apenas imagem imutavel com gates aprovados, backup e CAS. Rollback
da aplicacao remove esta funcionalidade sem reversao de schema ou de dados.
