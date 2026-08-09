# Fundação do design system analítico

## Objetivo

A fundação aproxima o CRM da linguagem navy/cyan/lime da referência viva sem
copiar seu bundle. Os componentes são Server Components sempre que não há
interação de navegador. A única lógica client-side do shell permanece restrita
à rota ativa, disclosure da navegação e troca de tema.

## Tokens

Os tokens semânticos vivem em `app/globals.css`:

- superfícies: `--analytics-page`, `--analytics-surface`,
  `--analytics-surface-muted` e `--analytics-surface-strong`;
- texto e borda: `--analytics-ink`, `--analytics-muted` e `--analytics-line`;
- identidade: `--analytics-navy`, `--analytics-navy-raised`,
  `--analytics-cyan`, `--analytics-cyan-strong` e `--analytics-lime`;
- estados: `--analytics-positive`, `--analytics-warning` e
  `--analytics-danger`;
- elevação: `--analytics-shadow`.

Claro, equilibrado e escuro consomem os mesmos tokens semânticos. O equilibrado
sobrescreve principalmente superfícies e bordas; o escuro redefine a paleta
completa. Cor nunca é o único indicador de estado.

## Componentes e contratos

| Componente          | Entrada principal                             | Saída acessível                       | Restrição                            |
| ------------------- | --------------------------------------------- | ------------------------------------- | ------------------------------------ |
| `PageHeader`        | título, descrição, metadados e rodapé         | Um único `h1` por página              | Não consulta dados                   |
| `AnalyticsCard`     | conteúdo e tom                                | `article`                             | Não calcula métricas                 |
| `MetricCard`        | realizado formatado, detalhe e razão opcional | Valor textual + rosca descrita        | Razão nula não desenha arco          |
| `FilterBar`         | grupos de links e dimensões indisponíveis     | `section`, `fieldset`, `legend`       | Não recebe opção sem enforcement     |
| `DonutChart`        | razão e texto já calculados                   | `figure` com nome textual             | Clamp somente no arco SVG            |
| `FunnelChart`       | etapas na ordem da fonte                      | Lista ordenada legível                | Larguras iguais; não codifica área   |
| `Gauge`             | razão e texto já calculados                   | `figure` com leitura textual          | Sem thresholds comerciais            |
| `AnalyticsTable`    | colunas, linhas e chave estável               | `caption`, `scope`, região focável    | Rolagem só no wrapper                |
| `RankingList`       | entradas já ordenadas e identificadas         | Lista ordenada                        | Não pontua ou desempata              |
| `AnalyticsSkeleton` | rótulo de carregamento                        | `aria-busy`                           | Animação desligada em reduced-motion |
| `DataState`         | `empty`, `unavailable` ou `error`             | Estado textual; erro usa `role=alert` | Não mostra erro bruto do backend     |
| `UnavailableValue`  | motivo seguro opcional                        | “Indisponível”                        | Nunca substitui ausência por zero    |

## Regras de métricas

- O realizado zero continua sendo mostrado como `0`.
- Um campo nulo é mostrado como “Indisponível”.
- Metas dependem de `goals_available` e de valor maior que zero para formar um
  denominador visual.
- Valores acima de 100% mantêm o texto real; apenas o arco é limitado ao
  círculo ou semicírculo disponível.
- Relações sequenciais usam `calculateConversion`, mas a interface esclarece
  que são razões entre volumes agregados.
- As faixas do funil têm a mesma largura. Nenhuma área visual sugere uma
  proporção que não tenha sido calculada pela fonte.
- O ranking de empreendimentos representa oportunidades por empreendimento,
  conforme o contrato de ingestão; não é rotulado como vendas.

## Filtros

Somente `view` e `period` são links ativos. Os valores aceitos são validados
pelos catálogos fechados no servidor. Canal detalhado, gerente, responsável e
empresa aparecem apenas como dimensões indisponíveis, sem controles simulados.

## Navegação

`AuthorizedNavigation` monta a árvore depois do filtro de permissão. Pais sem
filhos são links; pais com filhos usam `details`/`summary`, incluem a visão geral
e os filhos autorizados. Os grupos são mutuamente exclusivos e fecham ao clicar
fora, ao escolher um link ou com `Escape`; nesse último caso, o foco retorna ao
disclosure. Filhos cujo pai não veio no conjunto autorizado são omitidos.

## Acessibilidade e responsividade

- foco visível global de três pixels, com contraste mínimo de 5,26:1 nas
  superfícies claras e 8,89:1 sobre o gradiente navy;
- texto pequeno em cyan forte mantém contraste mínimo medido de 4,81:1 no pior
  fundo dos temas claros; o tema escuro supera 8,9:1;
- alvos interativos com altura mínima próxima de 44 pixels;
- navegação por teclado com elementos nativos;
- tabelas em região focável com rolagem horizontal isolada;
- reflow em uma coluna em telas estreitas e a 200% de zoom;
- SVG decorativo fora da árvore acessível e valor textual sempre visível;
- skeletons e transições decorativas desativados por
  `prefers-reduced-motion: reduce`;
- três temas baseados nos mesmos tokens semânticos.

## Dependência de QA

`@playwright/test` é dependência de desenvolvimento porque o incremento exige
capturas repetíveis e verificação do limite anônimo nos quatro viewports com
reduced-motion. O harness importa o pacote diretamente e os scripts
`qa:visual:reference` e `qa:security:anonymous` comprovam o uso. Temas, teclado e
zoom das páginas protegidas integram o plano autenticado bloqueado, não o
harness atual. Nenhuma dependência de runtime foi adicionada.

## Localização

Os componentes estão em
`app/(protected)/app/_components/analytics/`. O CSS é escopado pelo módulo
`analytics.module.css`; somente os tokens de tema permanecem globais.
