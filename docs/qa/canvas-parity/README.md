# Contrato visual dos canvases aprovados

Data da aprovação: 2026-10-04. Escopo: as 22 páginas protegidas originais do CRM.

Em 15/10/2026, o pedido de reproducao integral do link publico de Meta
substitui somente as regioes DV e Parcerias dos canvases compactos anteriores.
As referencias novas sao capturas independentes de
https://descomplicapro.com.br/configuracoes/metas e sua subguia Parcerias,
feitas pelo navegador em 1440x900, tema escuro, pagina completa, sem login.
JPEGs capturados em 16:59:57 e 17:01:12 UTC foram convertidos em WebP sem
nova perda. O navegador excluiu a faixa da scrollbar, resultando em largura
1424px. Hashes, fontes e limites estao no manifesto e na auditoria de Meta.
Os quinze assets anteriores permanecem identicos; Pontos continua usando sua
regiao original. Os novos assets usam regiao full e os mesmos limites de
distancia de cor/bordas. Nenhuma captura do proprio CRM vira referencia de
origem. A baseline autenticada e revisada separadamente apos os gates.

Este diretório preserva os canvases aprovados pelo usuário como referência de
composição, densidade, hierarquia e navegação. Eles não são autoridade para
dados, permissões, políticas comerciais, fórmulas ou disponibilidade de
motores. A aplicação continua exibindo somente dados provenientes de fontes
validadas; ausência de fonte deve aparecer como estado indisponível.

Em 20/10/2026, a rota `/app` recebeu os seletores exclusivos House/Imob e uma
composição mais compacta solicitados pelo usuário. O canvas histórico de
04/10 continua sendo a referência externa de composição; somente essa rota usa
tolerância de distância de cor `24` (medição `23,88`), sem alterar o limite de
bordas nem a comparação integral de pixels da baseline autenticada.

Em 27/10/2026, a jornada CAIXA passou a exibir no formulário principal o teto
automático de renda e o limite municipal vigente. A referência externa e os
limites de cor e bordas permanecem iguais; somente o teto de altura autenticado
da rota foi ajustado de `1200` para `1220` px para acomodar as duas orientações
sem ocultá-las nem ampliar a tolerância de regressão visual.

## Regras de implementação

- Existe uma única navbar global. Páginas e simuladores não criam outro header
  ou outra navegação de aplicação dentro do conteúdo.
- Os seis grupos raiz continuam derivados do catálogo autorizado no servidor.
  Submenus contêm somente páginas efetivamente permitidas ao perfil.
- A geometria navy/cyan, os painéis compactos, a hierarquia tipográfica e a
  densidade dos canvases são o alvo nos três temas. Cores semânticas se adaptam
  a Claro, Médio e Escuro sem reduzir contraste ou esconder foco.
- Os textos e traços mostrados nos canvases representam composição visual, não
  registros comerciais. Nenhum número, nome, status ou participante ilustrado
  pode virar dado real ou fixture produtiva.
- O pedido de 15/10/2026 remove os códigos WF da apresentação comercial,
  incluindo cards, cabeçalhos, mensagens, ajuda e resultados. Esses códigos
  permanecem apenas nos identificadores e contratos internos. A referência
  histórica não autoriza reintroduzi-los no texto visível.
- O selo “Prévia visual · sem dados reais” só é válido em estado sintético ou
  comprovadamente sem fonte. Quando houver snapshot validado, a interface deve
  identificar honestamente a origem e o estado reais.
- A tela CAIXA pode ser acessada apenas por sessão com
  `crm.simulators.view`. Seu motor, endpoint de cálculo, submissão e aprovação
  bancária permanecem bloqueados por gates independentes.
- Layout não substitui autorização: Proxy, SSR, APIs, RPCs, grants e RLS
  continuam obrigatórios e falham fechados.

## Mapeamento das páginas

O pedido de 04/10/2026 acrescenta `/app/configuracoes/recurso-mkt` como 23a
pagina protegida. A guia usa o padrao da Tabela Associativo e o print fornecido
para fundo, custo, percentuais, destinos e conversoes. O pedido de 11/10/2026
acrescentou Rotina em Configuracoes; o pedido seguinte moveu esse conteudo para
`/app/gestao/rotina` e criou `/app/gestao`, elevando o inventario para 27 rotas
protegidas. A rotina segue no padrao visual da Tabela Associativo, com
classificacao inicial de Gerente regional house e demais funcoes nulas. Os 22
canvases originais continuam preservados; Recurso MKT, Gestao e Rotina possuem
testes funcionais proprios.

O pedido de 16/10/2026 acrescenta `/app/gestao/previsao`, elevando o inventário
para 28 rotas protegidas. Os três prints enviados pelo usuário são referência
para a entrada em Gestão e a tabela manual com Nome do corretor, Previsão e
Realizado, sem os cards de entrada numérica. A tela permite incluir e excluir
linhas e colunas e salvar. Esses prints não foram incorporados como baseline
nem constituem uma comparação externa executada. A validação sintética prevista
em `tests/forecast-settings.test.tsx`, com `FORECAST_SETTINGS_BROWSER=1`, cobre
edição, salvamento e conflitos; seus resultados devem ser registrados após
execução, sem alegar paridade visual antes dessa evidência.

| Canvas                                 |   Região | Rota                                      |
| -------------------------------------- | -------: | ----------------------------------------- |
| `dashboard-oportunidades.webp`         | esquerda | `/app`                                    |
| `dashboard-oportunidades.webp`         |  direita | `/app/etapas/oportunidades`               |
| `agendamentos-visitas.webp`            | esquerda | `/app/etapas/agendamentos`                |
| `agendamentos-visitas.webp`            |  direita | `/app/etapas/visitas`                     |
| `pastas-vendas.webp`                   | esquerda | `/app/etapas/pastas`                      |
| `pastas-vendas.webp`                   |  direita | `/app/etapas/vendas`                      |
| `ranking-canal-parcerias.webp`         | esquerda | `/app/ranking`                            |
| `ranking-canal-parcerias.webp`         |  direita | `/app/canal-de-parcerias`                 |
| `configuracoes-metas-funil.webp`       | esquerda | `/app/configuracoes`                      |
| `metas-dv-live-2026-10-15.webp`        | completa | `/app/configuracoes/metas`                |
| `configuracoes-metas-funil.webp`       | derivada | `/app/gestao`                             |
| `hub-simulacao-associativo.webp`       | derivada | `/app/gestao/rotina`                      |
| `metas-parcerias-live-2026-10-15.webp` | completa | `/app/configuracoes/metas/parcerias`      |
| `metas-parcerias-pontos.webp`          |  direita | `/app/configuracoes/metas/pontos`         |
| `hub-simulacao-associativo.webp`       | esquerda | `/app/simulacao`                          |
| `hub-simulacao-associativo.webp`       |  direita | `/app/simulacao/associativo-fluxo-linear` |
| `documentacao-caixa.webp`              | esquerda | `/app/simulacao/calcular-documentacao`    |
| `documentacao-caixa.webp`              |  direita | `/app/simulacao/caixa`                    |
| `tabela-direta-investidor.webp`        | esquerda | `/app/simulacao/tabela-direta`            |
| `tabela-direta-investidor.webp`        |  direita | `/app/simulacao/tabela-investidor`        |
| `tabelao-administracao.webp`           | esquerda | `/app/simulacao/tabelao`                  |
| `tabelao-administracao.webp`           |  direita | `/admin`                                  |
| `usuarios-catalogo-paginas.webp`       | esquerda | `/admin/usuarios`                         |
| `usuarios-catalogo-paginas.webp`       |  direita | `/admin/paginas`                          |

Gestão > Rotina reutiliza os tokens da Tabela Associativo. Sua rotina é uma
nova superfície, validada pelo roteiro `scripts/qa/routine-settings.mjs`, com
edição, inserção, persistência local, teclado, temas, Axe e capturas responsivas.
A referência derivada identifica a origem visual; não afirma reprodução
pixel a pixel de uma tela de rotina que não existia no canvas aprovado.

O pedido de 12/10/2026 define a Rotina compacta com modos Semana e Hoje,
seis dias visiveis (segunda a sabado), textos centralizados e cabecalhos
fixos na area de rolagem. Hoje segue America/Sao_Paulo; domingo exibe estado
sem rotina. O schema local preserva domingos anteriores sem exibi-los.
Testar troca de modos, virada do dia, insercao com foco, salvamento,
cabecalhos sem sobreposicao, teclado e temas sem alterar o Associativo.

`navegacao-dropdown.webp` e `navegacao-mobile.webp` são contratos adicionais
da navbar única. `dashboard-composicao-alternativa.webp` é referência secundária
de densidade. `hub-simulacao-superseded.webp` foi preservado para rastreabilidade,
mas não é autoridade: ele contém jornadas que não existem no catálogo aprovado.

Os arquivos WebP foram derivados localmente dos PNGs aprovados, sem metadados,
redimensionados somente para armazenamento versionado. Integridade, fonte e
papel de cada arquivo estão em [`manifest.json`](./manifest.json).

## Gate contra a referencia externa

O QA autenticado nao pode aprovar uma tela apenas porque ela coincide com uma
captura anterior da propria aplicacao. Para cada uma das 22 rotas, o gate
recorta a regiao correspondente do canvas aprovado e compara, em `1440x900` e
tema Escuro, duas caracteristicas independentes:

- composicao cromatica normalizada, para detectar troca de paleta, superficies
  e distribuicao geral dos paineis;
- estrutura de bordas normalizada, para detectar hierarquia, densidade e
  geometria divergentes.

Os hashes das referencias e as distancias medidas ficam no resultado
versionado. A comparacao continua acompanhada por Axe, overflow, console,
teclado, zoom, reduced-motion, sete larguras e os tres temas. As capturas
internas seguem uteis para regressao, mas deixaram de ser autoridade unica de
paridade.

Os limites normalizados sao `23` para composicao cromatica e `52` para bordas.
Eles foram calibrados sobre as 22 regioes aprovadas para absorver apenas as
diferencas inevitaveis entre canvas gerado e captura do navegador, como
rasterizacao de fonte e altura de conteudo. A regressao pixel a pixel da
aplicacao continua mais restritiva, com tolerancia de `1%` e diferenca maxima de
`16` por canal.

### Revisão dos códigos internos em 16/10/2026

A captura Linux limpa da execução `38828948624`, artefato `12016679397`,
validou a remoção dos códigos WF. Foram atualizadas somente as referências
móveis do Hub em 320, 375 e 390 pixels, incluindo o tema escuro em 390 pixels.
As outras 238 imagens foram preservadas. A proveniência está em
`docs/qa/reference-parity/authenticated-results.json`; a integração com
`main` em `b5458ff5` exige nova CI normal antes da publicação.
