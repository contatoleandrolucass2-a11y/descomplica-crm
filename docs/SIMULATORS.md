# Simuladores — visual e motores oficiais isolados

## Motor oficial WF13

O WF13 possui implementação determinística versionada, mas continua desligado
por padrão e isolado dos demais motores. Contrato, fonte, 12 casos de ouro,
memória, segurança, canário Master e rollback estão em
[`docs/simulators-official/WF13.md`](simulators-official/WF13.md).

Os outros quatro motores permanecem visualmente completos e bloqueados até seus
incrementos independentes. Nenhum simulador depende de Salesforce, n8n ou Qlik.

## Escopo

As cinco jornadas preservam a composição visual aprovada. Somente o WF13 possui
fórmula oficial neste incremento; o bundle da referência não é versionado.

| Código | Rota protegida                            | Jornada visual             |
| ------ | ----------------------------------------- | -------------------------- |
| WF13   | `/app/simulacao/associativo-fluxo-linear` | Associativo · Fluxo Linear |
| WF16   | `/app/simulacao/calcular-documentacao`    | Documentação               |
| CAIXA  | `/app/simulacao/caixa`                    | Financiamento CAIXA        |
| WF14   | `/app/simulacao/tabela-direta`            | Tabela Direta              |
| WF15   | `/app/simulacao/tabela-investidor`        | Tabela Investidor          |

O hub está em `/app/simulacao`. Todas as seis rotas exigem
`crm.simulators.view` no guard server-side e no catálogo `app_pages`. A
navegação continua recebendo somente as páginas filtradas pelo contexto de
autorização.

## Comportamento fail-closed

- O catálogo tipado define títulos, seções, campos e espaços de resultado.
- Campos obrigatórios ganham validação associada e `aria-invalid`.
- As flags oficiais nascem `off` e a allowlist nasce vazia.
- WF16, CAIXA, WF14 e WF15 mantêm botão bloqueado e `UnavailableValue`.
- WF13 só envia ao Route Handler same-origin quando flag, chave, permissão e
  papel Master coincidem.
- O endpoint limita o corpo, valida o contrato exato, não persiste input/output
  e não registra payload na telemetria.
- A interface informa: “Cálculo temporariamente indisponível — regra aguardando
  validação” sempre que o gate não fecha.
- Nenhum acesso direto a tabela protegida foi criado.

O runtime de políticas comerciais anterior continua desligado e independente:

- `COMMERCIAL_ENGINE_RUNTIME_MODE=off` é o default;
- `COMMERCIAL_ENGINE_ENABLED_KEYS` nasce vazio;
- `COMMERCIAL_ENGINE_DATABASE_URL` nasce vazia e o papel dedicado permanece
  `NOLOGIN`, sem segredo provisionado;
- não existe policy importada nem gate ativo naquele runtime;
- o loader usa conexão PostgreSQL de menor privilégio, nunca Data API,
  `service_role` ou acesso direto às tabelas privadas.

O contrato e o runbook do runtime genérico permanecem em
[`commercial-engines-policy-runtime`](commercial-engines-policy-runtime/README.md).

## QA local

Fixtures sintéticas podem preencher os campos somente durante QA isolado. Os
casos de ouro do WF13 são testes versionados, não seeds de produção. Credenciais
QA, storage state, HTML, HAR e payloads de usuário não são versionados.
