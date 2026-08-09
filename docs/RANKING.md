# Ranking comercial

## Read model

O leitor abaixo é o v2 mantido nas rotas de produção durante a validação shadow
do v3.

O ranking não copia o `DashboardPayload` JSON do CRM original. O modelo usa:

- `crm_ranking_snapshots`: referência, geração, fuso e origem do lote;
- `crm_ranking_participants`: contagens normalizadas por corretor e período.

Os períodos apresentados são mês atual, semana passada, semana atual e hoje. A futura ingestão server-side grava as contagens; navegadores possuem somente leitura com `crm.ranking.view`.

## Pontuação

A aplicação combina as atividades do snapshot com `crm_point_metrics`. A pontuação base multiplica cada contagem pelo peso atual; o bônus é o piso da pontuação base multiplicada pela conversão de agendamentos em visitas. O total é base mais bônus.

A visão de corretores calcula cada participante. A visão de gerentes agrega as contagens da equipe antes de calcular pontuação e conversão. O desempate usa total, visitas, conversão, pastas aprovadas, vendas e nome.

Se os pesos ainda não foram confirmados, o ranking falha fechado com estado “Configuração necessária”. Se não existe snapshot `global`, exibe “Aguardando dados”; nenhum participante demonstrativo é usado.

`roulette_available=false` declara que a fonte oficial da roleta não existe.
Nesse estado, os zeros técnicos persistidos não entram na pontuação, a interface
exibe “Dados indisponíveis” e nenhum peso ou valor de roleta é apresentado como
indicador comercial real. Agendamentos, visitas, pastas e vendas permanecem
calculados normalmente.

## Segurança e testes

As duas tabelas têm grants mínimos, RLS por `crm.ranking.view`, constraints de chaves/nomes/contagens e escrita reservada a `service_role` para a futura ingestão controlada. `ranking_read_model.test.sql` cobre schema, grants, RLS, constraints, índices, deny override e cascade.

A QA autenticada validou corretores, consolidação de gerentes, troca de período e cálculo com pesos persistidos. A fixture e a conta local foram removidas por reset.

## Ranking externo de imobiliárias

O schema remoto também continha `crm_imob_ranking_runs` e `crm_imob_ranking_entries`, criadas fora das migrations para cargas do Qlik. Elas não substituem o read model de corretores acima e não possuem caller no código atual. O DDL foi versionado somente para eliminar drift e preservar dados; `/app/canal-de-parcerias` exibe apenas um placeholder protegido, sem acesso direto das funções da Data API a essas tabelas.

## Shadow v3

`/app/read-model-v3/ranking` exige
`crm.read_model_v3.ranking.view`. Como não existe autoridade/fonte oficial
ativada, o contrato específico de ranking permanece indisponível e nenhum motor
de pesos, bônus, desempate, roleta ou prêmio é executado. O Canal de Parcerias
shadow usa `crm.read_model_v3.partnerships.view`; a compatibilidade Qlik lê por
RPC escopada, com lineage efetivo e `vgv` decimal textual, nunca por grant direto.
