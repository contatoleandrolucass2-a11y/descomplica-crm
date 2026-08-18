# Simuladores — visual e motores oficiais isolados

## Motor oficial WF13

O WF13 possui implementação determinística versionada, mas continua desligado
por padrão e isolado dos demais motores. Contrato, fontes, caso de ouro do PDF
2, 14 transições de calendário, 12 regressões, memória, segurança, canário
Master e rollback estão em
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
autorização. No canário atual, essa permissão é exclusiva do Master e não possui
override direto. O acesso à página e a execução são gates independentes: WF13
também exige `crm.simulators.execute`, flag e chave oficiais; os demais papéis
falham antes da renderização e os demais motores permanecem desligados.

## Comportamento fail-closed

- O catálogo tipado define títulos, seções, campos e espaços de resultado.
- Campos obrigatórios ganham validação associada e `aria-invalid`.
- As flags oficiais nascem `off` e a allowlist nasce vazia.
- WF16, CAIXA, WF14 e WF15 mantêm botão bloqueado e `UnavailableValue`.
- WF13 só envia ao Route Handler same-origin quando flag, chave, permissão e
  papel Master coincidem.
- Hub e rota do simulador são renderizados por requisição. O cliente consulta
  um status autenticado e `no-store` para substituir com segurança qualquer
  estado visual aberto antes da ativação; esse status retorna
  `executionEnabled: false` para um visualizador sem todos os gates e não executa
  cálculo.
- O endpoint limita o corpo, valida o contrato exato, não persiste input/output
  e não registra payload na telemetria.
- Valores nominais usam centavos inteiros; vencimentos mensais são restritos a
  05/10/15 e sinais nunca são criados ou datados implicitamente.
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
