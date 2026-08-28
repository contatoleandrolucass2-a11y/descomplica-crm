# Migração dos simuladores, Tabelão e Discador

Data de corte: 2026-08-28. Referência autorizada:
`https://descomplicapro.com.br/`.

## Estado dos módulos

| Módulo   | Página                                    | Runtime                    | Estado seguro                                                  |
| -------- | ----------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| WF13     | `/app/simulacao/associativo-fluxo-linear` | motor oficial já existente | preservado, sem alteração de fórmula                           |
| WF16     | `/app/simulacao/calcular-documentacao`    | `simulator.wf16`           | fórmula congelada, tipada, server-side e sem persistência      |
| CAIXA    | `/app/simulacao/caixa`                    | `simulator.caixa`          | estimativa indicativa; exige confirmação CAIXA                 |
| WF14     | `/app/simulacao/tabela-direta`            | `simulator.wf14`           | dois cenários server-side, datas e centavos reconciliados      |
| WF15     | `/app/simulacao/tabela-investidor`        | `simulator.wf15`           | oito cenários; falha fechado sem estoque conciliado            |
| Tabelão  | `/app/simulacao/tabela`                   | `simulator.tabelao`        | consulta same-origin; fonte oficial exclusivamente server-side |
| Discador | `/app/discador`                           | `dialer`                   | página em desenvolvimento; sem telefonia ou campanhas          |
| Previsão | `/app/discador/previsao-final-de-semana`  | `dialer.weekend-forecast`  | GET sintético; POST desativado                                 |

Os quatro motores derivados da referência declaram proveniência
`legacy-reference-2026-08-28`, versão, hash do asset observado, fuso e regra de
arredondamento. O código da referência não é dependência de runtime e não é
tratado como autorização comercial produtiva.

## Gates independentes

As páginas dependem de:

- `LEGACY_MIGRATION_RUNTIME_MODE=active`;
- lista exata em `LEGACY_MIGRATION_ENABLED_MODULES`.

Os motores dependem adicionalmente de:

- `OFFICIAL_SIMULATOR_RUNTIME_MODE=active`;
- chave própria em `OFFICIAL_SIMULATOR_ENABLED_KEYS`;
- `crm.simulators.execute`, papel `master` e origem same-origin.

Todos os gates falham fechados por padrão. Produção deve manter os dois modos
como `off` até autorização posterior.

## Dados e integrações

`GET /api/inventory` exige Master, contrato estrito e fonte HTTPS privada. A
URL não pode apontar para o legado; autenticação só pode vir do mount fixo
`/run/secrets/inventory_source_auth`, originado de arquivo host `root:root
0640`. O resultado reconcilia empreendimento + planta, retorna menor preço,
fonte e o horário mais conservador do conjunto; nunca afirma disponibilidade
ou reserva.

`GET /api/weekend-forecast` retorna apenas estrutura sintética vazia quando a
flag específica está ativa; caso contrário, falha fechado antes da autenticação.
`POST /api/weekend-forecast` sempre retorna indisponibilidade. Nenhum módulo
ativa Qlik, Salesforce, n8n, telefonia, campanhas ou dados produtivos.

## RBAC

A migration `20260828135947_legacy_simulators_discador_master_canary.sql`
exige o baseline exato de 17 páginas e acrescenta sete páginas. Pós-condição:

- Master: 24 páginas;
- Admin: 14 páginas;
- `coordinator`, `supervisor`, `real_estate`, `broker_lead`, `broker` e `user`:
  7 páginas cada;
- papéis futuros e `pending`: zero páginas comerciais.

Desligar flags remove menu e acesso HTTP sem apagar catálogo. Rollback do banco
não é necessário nem recomendado: a migration é aditiva e o roll-forward é o
mecanismo de correção.
