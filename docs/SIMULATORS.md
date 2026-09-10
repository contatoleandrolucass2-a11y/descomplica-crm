# Simuladores — visual e motores oficiais isolados

## Motor oficial WF13

O WF13 possui implementação determinística versionada, mas continua desligado
por padrão e isolado dos demais motores. Contrato, fontes, caso de ouro do PDF
2, 14 transições de calendário, 12 regressões, memória, segurança, canário
Master e rollback estão em
[`docs/simulators-official/WF13.md`](simulators-official/WF13.md).

O WF14 implementa a réplica integral da Tabela Direta do arquivo anexado, com
snapshot SPC em volume privado fora do Git e da imagem, montado somente para
leitura, e cálculo executado no navegador. O WF15 publica a réplica completa da
Tabela Investidor do respectivo arquivo anexado, com o mesmo snapshot protegido
do estoque e cálculo no navegador. Isso não promove os workflows n8n históricos
nem o runtime de políticas comerciais a fonte oficial. WF16 e CAIXA permanecem
bloqueados. Nenhum simulador depende de Salesforce, n8n ou Qlik.

## Escopo

As cinco jornadas preservam a composição visual aprovada. Somente o WF13 possui
fórmula classificada como oficial; WF14 e WF15 reproduzem integralmente os
respectivos artefatos anexados e mantêm suas regras e cálculos isolados do
runtime oficial.

| Código | Rota protegida                            | Jornada visual        |
| ------ | ----------------------------------------- | --------------------- |
| WF13   | `/app/simulacao/associativo-fluxo-linear` | Simulador Associativo |
| WF16   | `/app/simulacao/calcular-documentacao`    | Documentação          |
| CAIXA  | `/app/simulacao/caixa`                    | Financiamento CAIXA   |
| WF14   | `/app/simulacao/tabela-direta`            | Tabela Direta         |
| WF15   | `/app/simulacao/tabela-investidor`        | Tabela Investidor     |

Na jornada associativa da Tabela Investidor, o popup “Proposta pronta - Bora
Vender” mantém a proposta faturada e acrescenta a memória de comissão apartada
da planilha `Pasta2.0.xlsx` quando a Entrada alcança o valor da comissão
calculada. A segunda coluna usa somente as classificações de Imobiliária
definidas pela fonte (Ouro, Prata e Bronze), preserva valores em centavos e
permanece oculta abaixo do limite.

O hub está em `/app/simulacao`. Todas as seis rotas exigem
`crm.simulators.view` no guard server-side. O catálogo PostgreSQL permanece com
17 páginas e as réplicas WF14 e WF15 estão implementadas neste candidato pelo
catálogo HTTP versionado, sem migration. A navegação continua recebendo somente
as páginas filtradas pelo contexto de autorização. No canário atual, essa
permissão é exclusiva do Master e não possui override direto. O acesso à página
e a execução são gates independentes: WF13 também exige
`crm.simulators.execute`, flag e chave oficiais. WF14 e WF15 são renderizados
somente após o mesmo guard `crm.simulators.view`, não persistem propostas nem
habilitam motores oficiais.

## Comportamento fail-closed

- O catálogo tipado define títulos, seções, campos e espaços de resultado.
- Campos obrigatórios ganham validação associada e `aria-invalid`.
- As flags oficiais nascem `off` e a allowlist nasce vazia.
- WF16 e CAIXA mantêm botão bloqueado e `UnavailableValue`.
- WF14 usa as 3.301 linhas do volume SPC privado, validado por checksum e montado
  somente para leitura. `GET /api/inventory/snapshot` entrega esse conteúdo e
  é a única fonte aceita pela Tabela Direta. Se ele falhar, a página informa a
  indisponibilidade e permite tentar novamente, sem consultar silenciosamente
  `GET /api/inventory`. Ambos os endpoints continuam exigindo
  `crm.simulators.view` e respondendo com `no-store`; o endpoint vivo atende
  somente outras jornadas. Linhas do snapshot sem preço permanecem visíveis e
  indisponíveis. A simulação também exige unidade com valor e término da obra.
- A Tabela Direta fecha a distribuição no centavo, preserva o bloco pós-chaves
  e separa pendência de dados, ajuste operacional, aprovação e recusa de
  crédito.
- WF15 usa o snapshot SPC protegido, exclui vagas avulsas, exige unidade com
  valor e término da obra, mantém estados de loading, vazio e erro e trata
  `GET /api/inventory` como atualização protegida não bloqueante.
- Na Tabela Investidor, as oito propostas permanecem divididas em quatro opções
  para 18 parcelas e quatro para 24. A escolha rápida exibe uma opção por vez em
  livro-caixa; o fluxo editável usa o mesmo padrão em linhas e mantém os limites
  do motor: três sinais consecutivos, intermediária de até 5% e até três/quatro
  intermediárias conforme o prazo selecionado e a entrada total válida.
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

Fixtures sintéticas podem preencher os campos somente durante QA isolado. A
matriz visual da Tabela Direta gera em diretório temporário 3.301 unidades
sintéticas determinísticas, para que o snapshot comercial não entre no Git, no
CI ou nas capturas. A execução local primeiro valida a cópia privada real; a
ausência dela só é aceita no GitHub Actions com opt-in explícito do workflow.
Produção continua exigindo a cópia privada com o SHA-256 do anexo. Os casos de
ouro do WF13 são testes versionados, não seeds de produção. Credenciais QA,
storage state, HTML, HAR e payloads de usuário não são versionados.
