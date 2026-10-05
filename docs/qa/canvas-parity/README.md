# Contrato visual dos canvases aprovados

Data da aprovação: 2026-10-04. Escopo: as 22 páginas protegidas do CRM.

Este diretório preserva os canvases aprovados pelo usuário como referência de
composição, densidade, hierarquia e navegação. Eles não são autoridade para
dados, permissões, políticas comerciais, fórmulas ou disponibilidade de
motores. A aplicação continua exibindo somente dados provenientes de fontes
validadas; ausência de fonte deve aparecer como estado indisponível.

## Regras de implementação

- Existe uma única navbar global. Páginas e simuladores não criam outro header
  ou outra navegação de aplicação dentro do conteúdo.
- Os cinco grupos raiz continuam derivados do catálogo autorizado no servidor.
  Submenus contêm somente páginas efetivamente permitidas ao perfil.
- A geometria navy/cyan, os painéis compactos, a hierarquia tipográfica e a
  densidade dos canvases são o alvo nos três temas. Cores semânticas se adaptam
  a Claro, Médio e Escuro sem reduzir contraste ou esconder foco.
- Os textos e traços mostrados nos canvases representam composição visual, não
  registros comerciais. Nenhum número, nome, status ou participante ilustrado
  pode virar dado real ou fixture produtiva.
- O selo “Prévia visual · sem dados reais” só é válido em estado sintético ou
  comprovadamente sem fonte. Quando houver snapshot validado, a interface deve
  identificar honestamente a origem e o estado reais.
- A tela CAIXA pode ser acessada apenas por sessão com
  `crm.simulators.view`. Seu motor, endpoint de cálculo, submissão e aprovação
  bancária permanecem bloqueados por gates independentes.
- Layout não substitui autorização: Proxy, SSR, APIs, RPCs, grants e RLS
  continuam obrigatórios e falham fechados.

## Mapeamento das 22 páginas

| Canvas                           |   Região | Rota                                      |
| -------------------------------- | -------: | ----------------------------------------- |
| `dashboard-oportunidades.webp`   | esquerda | `/app`                                    |
| `dashboard-oportunidades.webp`   |  direita | `/app/etapas/oportunidades`               |
| `agendamentos-visitas.webp`      | esquerda | `/app/etapas/agendamentos`                |
| `agendamentos-visitas.webp`      |  direita | `/app/etapas/visitas`                     |
| `pastas-vendas.webp`             | esquerda | `/app/etapas/pastas`                      |
| `pastas-vendas.webp`             |  direita | `/app/etapas/vendas`                      |
| `ranking-canal-parcerias.webp`   | esquerda | `/app/ranking`                            |
| `ranking-canal-parcerias.webp`   |  direita | `/app/canal-de-parcerias`                 |
| `configuracoes-metas-funil.webp` | esquerda | `/app/configuracoes`                      |
| `configuracoes-metas-funil.webp` |  direita | `/app/configuracoes/metas`                |
| `metas-parcerias-pontos.webp`    | esquerda | `/app/configuracoes/metas/parcerias`      |
| `metas-parcerias-pontos.webp`    |  direita | `/app/configuracoes/metas/pontos`         |
| `hub-simulacao-associativo.webp` | esquerda | `/app/simulacao`                          |
| `hub-simulacao-associativo.webp` |  direita | `/app/simulacao/associativo-fluxo-linear` |
| `documentacao-caixa.webp`        | esquerda | `/app/simulacao/calcular-documentacao`    |
| `documentacao-caixa.webp`        |  direita | `/app/simulacao/caixa`                    |
| `tabela-direta-investidor.webp`  | esquerda | `/app/simulacao/tabela-direta`            |
| `tabela-direta-investidor.webp`  |  direita | `/app/simulacao/tabela-investidor`        |
| `tabelao-administracao.webp`     | esquerda | `/app/simulacao/tabelao`                  |
| `tabelao-administracao.webp`     |  direita | `/admin`                                  |
| `usuarios-catalogo-paginas.webp` | esquerda | `/admin/usuarios`                         |
| `usuarios-catalogo-paginas.webp` |  direita | `/admin/paginas`                          |

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
