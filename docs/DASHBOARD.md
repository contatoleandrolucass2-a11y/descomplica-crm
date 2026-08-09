# Dashboard comercial

## Estado do Gate 2

`/app` é um Server Component protegido por `crm.dashboard.view`. Ele consulta o Supabase com a sessão SSR do usuário; a RLS repete a mesma autorização no banco. Não há chave privilegiada, usuário fixo, fallback D1 nem dados demonstrativos na aplicação.

Quando não existe o snapshot `global`, a tela exibe “Aguardando dados”. Isso é intencional: ausência de dados reais nunca é mascarada com números fictícios.

`goals_available` distingue metas provenientes de uma fonte autorizada de zeros
técnicos. Enquanto estiver `false`, o dashboard e os detalhes de etapa exibem
“Fonte não configurada”/“Dados indisponíveis” e omitem barra de progresso,
atingimento e gap. O realizado continua visível e não é afetado.

## Read model

Esta seção descreve o leitor v2 que continua ativo em produção. A migration v3
não altera esta rota nem o catálogo.

| Tabela                           | Responsabilidade                                  |
| -------------------------------- | ------------------------------------------------- |
| `crm_dashboard_snapshots`        | Cabeçalho, fonte e disponibilidade das metas      |
| `crm_dashboard_views`            | Valor vendido por visão e período                 |
| `crm_dashboard_metrics`          | Indicadores e metas por visão, etapa e período    |
| `crm_dashboard_top_developments` | Até cinco empreendimentos classificados por visão |

Visões aceitas: `all`, `with_canal_imob` e `without_canal_imob`. Etapas aceitas: `opportunities`, `appointments`, `visits`, `folders` e `sales`.

O contrato usa tipos PostgreSQL próprios, chaves compostas e constraints de domínio. Métricas e valores negativos são rejeitados. Não existe escrita direta para `authenticated` ou `anon`; a futura ingestão deverá substituir o snapshot completo em uma única transação por uma interface server-side separada e auditada.

## Interface

- seleção de visão e período pela URL, sem estado oculto no navegador;
- cards e roscas das cinco etapas, desenhadas apenas com meta oficial positiva;
- funil do período e cinco comparativos mensais sustentados pelo read model;
- relações sequenciais explicitamente rotuladas como comparação entre volumes
  agregados, não como conversão de coorte;
- valor vendido específico de cada visão/período;
- ranking de oportunidades por empreendimento, sem cálculo no componente;
- tabela com mês, históricos, semana, hoje e metas, mantendo campos nulos como
  “Indisponível”;
- data, fonte e horário do snapshot;
- filtros dimensionais apenas como pendência explícita, sem controles sem efeito;
- identidade navy/cyan/lime nos temas claro, equilibrado e escuro.

A projeção proporcional observada na referência viva não foi reproduzida porque
não existe fórmula oficial versionada. Filtros por gerente, responsável, empresa
e canal detalhado continuam indisponíveis até haver enforcement no servidor e
no banco.

## Shadow v3

`/app/read-model-v3` oferece a composição dimensional nova somente quando a
flag server-side `CRM_READ_MODEL_V3_SHADOW_ENABLED=true`. A rota não aparece na
navegação, exige `crm.read_model_v3.view`, um scope explícito e lineage efetivo,
e consulta apenas `list_crm_read_model_v3_scopes` e
`get_crm_read_model_v3`. Valores de moeda são decimais textuais exatos; metas,
planejamento e fórmulas não aprovadas aparecem como indisponíveis. Nenhum dado
real é seedado pela PR. Zero real exige intervalo certificado e manifesto
explícito contendo exatamente o escopo consultado.

## Validação

Os testes pgTAP cobrem tabelas, RLS, grants, constraints, leitura autorizada e
override `deny`. Os testes Vitest cobrem seleção de parâmetros, cálculos
existentes, snapshots visuais e preservação de indisponibilidade.

A comparação autenticada desta fundação está bloqueada porque URL de homologação
e credencial QA dedicada não foram disponibilizadas nem localizadas pelos canais
seguros inspecionados. Produção não foi usada para QA autenticada; somente sua
barreira anônima compõe o baseline “antes”. Contas pessoais não foram usadas. O
harness versionado valida a referência sanitizada e essa barreira anônima.
