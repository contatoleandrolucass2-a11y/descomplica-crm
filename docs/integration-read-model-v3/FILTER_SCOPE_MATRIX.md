# Matriz de filtros e escopos

## Regra invariável

Toda leitura exige simultaneamente:

1. sessão `authenticated` aprovada e ativa;
2. permissão efetiva do dataset: `crm.read_model_v3.view` para funil,
   `crm.read_model_v3.ranking.view`, `crm.read_model_v3.partnerships.view` ou
   `crm.read_model_v3.stock.view`;
3. exatamente um `reporting_scope_id` efetivo;
4. lineage efetivo até a raiz;
5. manifesto do run contendo exatamente o escopo solicitado e período dentro
   dos bounds certificados;
6. filtros cujos UUIDs existam nos fatos visíveis daquele scope e período.

Remover, ignorar ou normalizar silenciosamente um parâmetro inválido é proibido. A RPC retorna erro genérico e não executa uma consulta mais ampla.

## Escopos por papel

| Papel               | Tipo permitido pelo catálogo | Universo de “Geral”                           | Estado de rollout desta PR                            |
| ------------------- | ---------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Master              | `global`                     | todos os fatos publicados sob a raiz global   | modelo provado; zero grant automático nesta PR        |
| Admin               | `organization`               | somente a organização concedida               | provado; requer grant explícito futuro                |
| Coordenador         | `portfolio` ou `team`        | somente a carteira ou equipe selecionada      | provado estruturalmente; política de rollout pendente |
| Gestor              | `team`                       | somente a equipe concedida                    | provado; requer grant explícito futuro                |
| Corretor            | `person`                     | somente fatos ligados ao próprio person scope | provado; requer grant explícito futuro                |
| House / Imobiliária | `organization`               | somente a organização concedida               | modelo pronto; rollout pendente                       |
| Canal de Parcerias  | `portfolio`                  | somente a carteira de parceria concedida      | modelo pronto; caller Qlik bloqueia cutover           |

Permissão sem scope retorna zero opções. Scope sem permissão retorna zero
acesso. Nenhum papel recebe permissão v3 automaticamente nesta PR. Vários
grants não são unidos implicitamente: o usuário escolhe um scope.

Nesta PR, a interface dimensional vive apenas sob `/app/read-model-v3/*`, fora
do catálogo de navegação e atrás da flag server-side shadow. As rotas atuais
continuam com os filtros e contratos v2; não houve cutover.

## Dimensões

| Parâmetro de URL | Campo da RPC      | ID canônico                        | Verificação de autorização                        |
| ---------------- | ----------------- | ---------------------------------- | ------------------------------------------------- |
| `period`         | `period`          | `month`, `week`, `today`, `custom` | limites calculados pela data de referência do run |
| `from`, `to`     | `from`, `to`      | datas `[início, fim)`              | `custom`, até cinco anos, em cobertura completa   |
| `organizations`  | `organizationIds` | `crm_organizations.id`             | precisa ocorrer em fato visível                   |
| `teams`          | `teamIds`         | `crm_teams.id`                     | precisa ocorrer em fato visível                   |
| `portfolios`     | `portfolioIds`    | `crm_portfolios.id`                | precisa ocorrer em fato visível                   |
| `coordinators`   | `coordinatorIds`  | `crm_people.id`                    | precisa ocorrer em fato visível                   |
| `managers`       | `managerIds`      | `crm_people.id`                    | precisa ocorrer em fato visível                   |
| `brokers`        | `brokerIds`       | `crm_people.id`                    | precisa ocorrer em fato visível                   |
| `origins`        | `originIds`       | `crm_origins.id`                   | precisa ocorrer em fato visível                   |
| `developments`   | `developmentIds`  | `crm_developments.id`              | precisa ocorrer em fato visível                   |
| `locations`      | `locationIds`     | `crm_locations.id`                 | precisa ocorrer em fato visível                   |

As opções da interface vêm da mesma RPC escopada e do mesmo run ativo. Cada
dimensão retorna no máximo 100 opções, com ordem determinística; o campo
`truncatedOptions` e um aviso visual tornam qualquer truncamento explícito.
Uma opção já selecionada recebe prioridade dentro do cap, evitando que o
controle mostre “Geral” sobre uma consulta ainda filtrada.
Tabelas canônicas não são enumeradas diretamente pelo navegador.

## Períodos

- `month`: primeiro dia do mês até o dia posterior à data de referência.
- `week`: segunda-feira da semana até o dia posterior à referência.
- `today`: data de referência em `[data, data + 1)`.
- `custom`: datas explícitas `[from, to)`, integralmente contidas nos bounds de
  cobertura `complete`; fora deles a RPC rejeita a consulta.

Os presets também precisam estar integralmente nos bounds. Quando `month`,
`week` ou `today` extrapola a cobertura, a resposta é indisponível com
`period_coverage_not_proven` e métricas nulas.

`commercial_date` é validada no ingest contra
`occurred_at AT TIME ZONE run.timezone`. O timezone precisa existir em
`pg_timezone_names` e na família IANA compatível com `Intl`; aliases exclusivos
do PostgreSQL são rejeitados.

## Combinações

Filtros diferentes usam interseção lógica. A interface aceita exatamente uma
opção por dimensão e rejeita URL com lista, evitando descartar seleção num novo
submit. A RPC mantém suporte interno a até 100 UUIDs únicos para consumidores
server-side futuros, sujeitos ao mesmo scope. Uma combinação válida sem fatos
retorna estado vazio e zeros reais somente quando a fonte declarou a medida
`counts`, certificou integralmente o período e incluiu o escopo exato no
manifesto. Um fato descendente não comprova cobertura do pai.

## Falha fechada testada

- UUID malformado;
- parâmetro repetido ou duplicado;
- chave desconhecida;
- array vazio usado como tentativa de “Geral”;
- scope inexistente, revogado ou fora do usuário;
- organização de outro tenant;
- dimensão que não ocorre no scope/período;
- intervalo invertido ou incompleto;
- tentativa de acessar tabela de fatos diretamente.

Os casos estão cobertos por `supabase/tests/read_model_v3.test.sql` e `tests/read-model-v3-filters.test.ts`.
