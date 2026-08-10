# Simuladores — visual e runtime comercial bloqueado

## Escopo

Este incremento entrega somente a composição visual das cinco jornadas
aprovadas. Ele não importa bundles, fórmulas, parâmetros comerciais ou regras da
referência viva.

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
- Campos servem apenas à inspeção visual local; não possuem valores padrão
  comerciais. Campos obrigatórios ganham estado local de validação após
  interação, com `aria-invalid` e mensagem associada.
- A validação não envia o formulário. Ele não possui Server Action, Route
  Handler, consulta ou escrita.
- O botão de cálculo permanece desabilitado.
- Todo resultado usa `UnavailableValue`.
- A interface informa: “Cálculo temporariamente indisponível — regra aguardando
  validação”.
- Nenhum acesso direto a tabela protegida foi criado.

O runtime comercial versionado existe como fundação server-only, mas não muda
esse comportamento. Os cinco simuladores estão registrados, a rota de execução
aceita somente essas chaves e exige `crm.simulators.execute`; nenhum papel recebe
essa capacidade operacional neste incremento. Além disso:

- `COMMERCIAL_ENGINE_RUNTIME_MODE=off` é o default;
- `COMMERCIAL_ENGINE_ENABLED_KEYS` nasce vazio;
- `COMMERCIAL_ENGINE_DATABASE_URL` nasce vazia e o papel dedicado permanece
  `NOLOGIN`, sem segredo provisionado;
- não existe policy oficial importada nem gate ativo;
- cada versão exige owner, backup, evidência, vigência e pelo menos um caso de
  ouro aprovado;
- `shadow` audita hashes sem devolver resultado; somente `active`, com todos os
  gates satisfeitos, pode devolver output;
- fórmulas nunca são enviadas ao cliente e o ledger não guarda input/output.
- o loader usa conexão PostgreSQL de menor privilégio, nunca Data API,
  `service_role` ou acesso direto às tabelas privadas.

Os formulários visuais continuam sem submit. Conectá-los ao endpoint requer um
incremento posterior, políticas oficiais e autorização explícita. O contrato e
o runbook estão em
[`commercial-engines-policy-runtime`](commercial-engines-policy-runtime/README.md).

## QA local

Fixtures sintéticas podem preencher os campos somente durante QA isolado. Elas
não são importadas pelo código, não são seed de produção e não geram resultado.
Credenciais QA, storage state, HTML, HAR e payloads não são versionados.
