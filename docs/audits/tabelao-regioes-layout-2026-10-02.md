# Tabelao: regioes e leitura continua

## Escopo

- Data: 02/10/2026. Branch: `codex/tabelao-regioes-layout`, base `727c858`.
- Pedido: resolver os dois logradouros divergentes, organizar as cinco regioes,
  exibir seus nomes verticalmente, manter Limitador visivel no desktop e fixar
  os titulos da tabela ao rolar a pagina.
- Perfis: corretor, imobiliaria e gestor comercial com `crm.simulators.view`.
  Tarefa comum: comparar opcoes por empreendimento, planta, vagas e valor.
- Sem alteracao de precos, politica comercial, estoque remoto, schema, grants,
  RLS, credenciais ou workflows n8n.

## Implementacao

- Ordem: Zona Leste, Zona Sul, Zona Norte, Zona Oeste e Centro; dentro de cada
  regiao, nomes de empreendimentos em ordem natural pt-BR e precos crescentes.
  A opcao manual de preco decrescente nao dispersa os grupos.
- Nomes homonimos em zonas distintas nao compartilham o grupo de apresentacao.
  A chave comercial de menor preco por planta/vagas permanece inalterada.
- Letras verticais eretas em duas palavras lado a lado, com rotulo integral
  separado para tecnologia assistiva. Centro usa uma palavra.
- Colunas proporcionais e texto integral com quebra de linha, cabecalho e corpo
  em 12px. Desktop a partir de 1280px deve mostrar todas as 14 colunas; telas
  estreitas preservam rolagem horizontal e leitura, sem overflow da pagina.
- Os mesmos `th` sao deslocados durante a rolagem vertical, abaixo da navegacao
  e limitados ao fim da tabela. Nao ha copia de titulos, IDs ou semantica.
- Carga territorial e falha efetiva sao estados distintos. O texto antigo nao
  aparece; uma falha real nao recebe zona presumida. Uma tentativa adicional
  de transporte ocorre apos os lotes restantes, com concorrencia inalterada.
- Divergencia de tipo/titulo do logradouro exige comprovacao adicional pelo
  CODLOG na camada municipal `geoportal:segmento_logradouro`, consultada via TLS.
  Um nome aproximado, bairro ou nome comercial do empreendimento nao confirma zona.

## Validacao

- Node 24.19.0, pnpm 11.20.0, Windows.
- 405 testes focados de inventario, payload, regioes, componentes e contrato de
  QA aprovados; typecheck, build e oito testes Node tambem aprovados.
- Consulta observacional do backend local em 02/10/2026, 08:37 BRT: os 22 CEPs
  atuais foram confirmados pelas fontes publicas, sem persistir estoque bruto.
  Registro exato: `2026-10-02T11:37:09.413Z`, 8362 ms, zero pendencias. Contagens
  por CEP, nao por empreendimento/opcao: Oeste 11, Centro 3, Norte 1, Sul 5, Leste 2.
- CEP 04703-020: Localiza acrescentava Professor; GeoSampa confirma Rua Caetano
  Jose Batista, CODLOG 038229, distrito Itaim Bibi, Zona Oeste. Nao deduzir Sul
  apenas do nome comercial Brooklin.
- CEP 08040-115: Localiza usava Rua, enquanto ViaCEP e GeoSampa confirmam Avenida
  Afonso Lopes de Baiao, CODLOG 346160. Sao Miguel e Vila Jacui ficam na Zona Leste.
  A denominacao tambem consta no [Decreto 15.605/1978](https://legislacao.prefeitura.sp.gov.br/decreto-15605-de-27-de-dezembro-de-1978).
- Lint do codigo passou; `pnpm lint` bruto encontrou 33 erros em bundles e
  loaders sinteticos locais ignorados de `test-results`. Nenhum ignore foi
  acrescentado ao codigo para ocultar esses artefatos; CI limpa ainda obrigatoria.
- Suite completa final no Windows: 1361 aprovados, quatro skips condicionais,
  seis falhas preexistentes de permissao/symlinks POSIX. Sem novos skips ou
  alteracao dos testes de infraestrutura para ocultar a incompatibilidade.
- Chromium local: nove cenarios aprovados, 375/390/768/1024/1280/1440/1920px,
  canvas 1440 com zoom 150% e canvas 2160 com escala 150%. Testes verificam
  limites das celulas, texto integral, letras verticais, filtros, ordem regional,
  homonimos e cabecalho rolando; sem erros de navegador. Capturas sinteticas
  desktop/mobile e rolagem revisadas. A transicao CSS herdada que atrasava os
  titulos foi removida. Esse harness nao substitui a matriz autenticada da CI.
- CI limpa, revisao de referencias e publicacao ainda pendentes nesta etapa.
  Evidencias posteriores devem substituir este status.

### Proveniencia Territorial

Consulta por stdin com Node 24.19.0, no checkout indicado, importando
`lookupInventoryRegion` de `lib/inventory/region-lookup.ts`; origem dos CEPs:
`https://descomplicapro.com.br/api/inventory`. CEPs validos distintos foram
ordenados e consultados sequencialmente. Somente contagens, tempo e os dois
casos publicos foram impressos; nenhum arquivo de estoque foi criado.

ViaCEP e Localiza seguiram os URLs parametrizados documentados no runbook. A
verificacao adicional usou `geoportal:segmento_logradouro` com `count=256` e
`CQL_FILTER=codlog = '038229'` ou `codlog = '346160'`, no WFS HTTPS oficial.
Mapa regional: `geoportal:distrito_municipal`, campos `nm_distrito_municipal`
e `nm_regiao_05`. O nome do bairro/empreendimento nao foi usado como atalho.

## Limites

Fontes externas nao permitem prometer disponibilidade ou acuracia absoluta.
CEP incorreto, resposta contraditoria, limites geograficos ambiguos ou provedor
fora do ar nao autorizam inventar uma zona nem omitir opcoes do estoque.
Novos CEPs continuam sendo consultados automaticamente, sem cadastro mensal
manual. Data de consulta territorial nao altera a data publicada do estoque.

## Publicacao E Reversao

Seguir `docs/runbooks/automatic-publication.md`, CI verde, revisao de capturas,
imagem imutavel, backup, CAS e verificacao da jornada. Rollback da imagem nao
exige reversao de schema ou alteracao de dados remotos.
