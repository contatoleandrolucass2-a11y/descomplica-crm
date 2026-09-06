# Simuladores — visual e motores oficiais isolados

## Motor oficial WF13

O WF13 possui implementação determinística versionada, mas continua desligado
por padrão e isolado dos demais motores. Contrato, fontes, caso de ouro do PDF
2, 14 transições de calendário, 12 regressões, memória, segurança, canário
Master e rollback estão em
[`docs/simulators-official/WF13.md`](simulators-official/WF13.md).

O WF14 implementa a réplica integral da Tabela Direta do arquivo anexado, com
snapshot SPC em volume privado fora do Git e da imagem, montado somente para
leitura, e cálculo executado no navegador. Isso não promove o workflow n8n
histórico nem o runtime de políticas comerciais a fonte oficial. WF16, CAIXA e
WF15 permanecem bloqueados. Nenhum simulador depende de Salesforce, n8n ou Qlik.

## Escopo

As cinco jornadas preservam a composição visual aprovada. Somente o WF13 possui
fórmula classificada como oficial; o WF14 reproduz integralmente o artefato
anexado e mantém suas regras isoladas do runtime oficial.

| Código | Rota protegida                            | Jornada visual        |
| ------ | ----------------------------------------- | --------------------- |
| WF13   | `/app/simulacao/associativo-fluxo-linear` | Simulador Associativo |
| WF16   | `/app/simulacao/calcular-documentacao`    | Documentação          |
| CAIXA  | `/app/simulacao/caixa`                    | Financiamento CAIXA   |
| WF14   | `/app/simulacao/tabela-direta`            | Tabela Direta         |
| WF15   | `/app/simulacao/tabela-investidor`        | Tabela Investidor     |

O hub está em `/app/simulacao`. Todas as seis rotas exigem
`crm.simulators.view` no guard server-side. O catálogo PostgreSQL permanece com
17 páginas e a réplica WF14 está implementada neste candidato somente pelo
catálogo HTTP versionado, sem migration. A navegação continua recebendo somente
as páginas filtradas pelo contexto de autorização. No canário atual, essa
permissão é exclusiva do Master e não possui override direto. O acesso à página
e a execução são gates independentes: WF13 também exige
`crm.simulators.execute`, flag e chave oficiais. A réplica WF14 não persiste a
proposta nem habilita um motor oficial.

## Comportamento fail-closed

- O catálogo tipado define títulos, seções, campos e espaços de resultado.
- Campos obrigatórios ganham validação associada e `aria-invalid`.
- As flags oficiais nascem `off` e a allowlist nasce vazia.
- WF16, CAIXA e WF15 mantêm botão bloqueado e `UnavailableValue`.
- WF14 usa as 3.301 linhas do volume SPC privado, validado por checksum e montado
  somente para leitura. `GET /api/inventory/snapshot` entrega esse conteúdo e
  `GET /api/inventory` oferece o fallback vivo; ambos exigem
  `crm.simulators.view`, respondem com `no-store` e mantêm as linhas sem preço
  visíveis e indisponíveis. A simulação também exige unidade com valor e término
  da obra.
- A Tabela Direta fecha a distribuição no centavo, preserva o bloco pós-chaves
  e separa pendência de dados, ajuste operacional, aprovação e recusa de
  crédito.
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
