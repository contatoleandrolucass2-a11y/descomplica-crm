# Dashboard comercial

## Estado do Gate 2

`/app` é um Server Component protegido por `crm.dashboard.view`. Ele consulta o Supabase com a sessão SSR do usuário; a RLS repete a mesma autorização no banco. Não há chave privilegiada, usuário fixo, fallback D1 nem dados demonstrativos na aplicação.

Quando não existe o snapshot `global`, a tela exibe “Aguardando dados”. Isso é intencional: ausência de dados reais nunca é mascarada com números fictícios.

## Read model

| Tabela                           | Responsabilidade                                         |
| -------------------------------- | -------------------------------------------------------- |
| `crm_dashboard_snapshots`        | Cabeçalho do snapshot: referência, geração, fuso e fonte |
| `crm_dashboard_views`            | Valor vendido por visão e período                        |
| `crm_dashboard_metrics`          | Indicadores e metas por visão, etapa e período           |
| `crm_dashboard_top_developments` | Até cinco empreendimentos classificados por visão        |

Visões aceitas: `all`, `with_canal_imob` e `without_canal_imob`. Etapas aceitas: `opportunities`, `appointments`, `visits`, `folders` e `sales`.

O contrato usa tipos PostgreSQL próprios, chaves compostas e constraints de domínio. Métricas e valores negativos são rejeitados. Não existe escrita direta para `authenticated` ou `anon`; a futura ingestão deverá substituir o snapshot completo em uma única transação por uma interface server-side separada e auditada.

## Interface

- seleção de visão e período pela URL, sem estado oculto no navegador;
- metas e progresso das cinco etapas;
- conversão sequencial do funil;
- valor vendido específico de cada visão/período;
- empreendimentos em destaque;
- data, fonte e horário do snapshot;
- layout validado em 390×844 e 1440×900 sem overflow no corpo.

## Validação

Os testes pgTAP cobrem tabelas, RLS, grants, constraints, leitura autorizada e override `deny`. Os testes Vitest cobrem seleção de parâmetros, conversão e progresso. Uma fixture temporária foi usada somente no Supabase local para o teste autenticado no navegador e removida por `supabase db reset`.
