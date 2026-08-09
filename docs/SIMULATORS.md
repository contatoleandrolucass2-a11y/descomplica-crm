# Simuladores — contrato visual seguro

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

Habilitar qualquer motor exige outro incremento: fonte oficial identificada,
fórmula versionada, contrato tipado, validação, autorização server-side,
RLS/grants quando houver persistência, testes de casos oficiais e aprovação
explícita.

## QA local

Fixtures sintéticas podem preencher os campos somente durante QA isolado. Elas
não são importadas pelo código, não são seed de produção e não geram resultado.
Credenciais QA, storage state, HTML, HAR e payloads não são versionados.
