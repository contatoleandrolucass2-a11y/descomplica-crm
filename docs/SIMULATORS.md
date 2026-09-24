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

O Tabelão é uma consulta de estoque, não um motor de simulação. A rota protegida
`/app/simulacao/tabelao` opera em modo somente leitura, consome
`GET /api/inventory` com `no-store`. No mesmo shell e modelo visual da Tabela
Associativo, exibe uma unidade por combinação de incorporadora, empreendimento,
tipo de planta e área privativa, escolhida pelo menor valor líquido. Todas as
combinações válidas permanecem acessíveis pela rolagem; a janela de 60 linhas é
apenas uma otimização de renderização, não um limite de resultados. Vagas e lojas
continuam elegíveis. A barra de filtros permanece removida.

O valor exibido e a seleção usam exatamente `finalWithKit - (unitBonus +
tableSlack)`, correspondentes a **Valor Final Com Kit - (B.A. da Unidade + Folga
de Tabela)**. Cada parcela monetária é convertida em centavos antes da subtração;
`finalPrice` não substitui nenhum campo. Exigem-se valores numéricos finitos,
abatimentos não negativos, resultado positivo, identificador, incorporadora,
empreendimento, planta e área positiva. Ausências não viram zero: a interface
informa quantas linhas não puderam participar, qualificando a comparação.

Nomes são normalizados apenas na chave do grupo (caixa, acentos e espaços). Áreas
distintas não são arredondadas para deduplicar. Empates usam identificador natural,
produto e ID, sem depender da ordem da fonte. A unidade vencedora mantém seus
dados completos; as opções ficam juntas por empreendimento em ordem alfabética,
separadas por incorporadora quando o nome coincide, e por valor líquido crescente
dentro de cada empreendimento. Contadores
mostram opções e empreendimentos distintos, não o total bruto de unidades.

A fonte e sua data de geração continuam explícitas. Ausência ou erro não aciona
mock, snapshot alternativo ou motor de simulação. O atalho continua abrindo a
página Tabela Direta; não promete seleção automática entre fontes distintas.

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

Na Tabela Investidor, a seleção de propostas prontas mantém os oito cenários
simultaneamente disponíveis: quatro opções de 18 parcelas na primeira linha e
quatro opções de 24 parcelas na linha seguinte. A mudança é somente de
apresentação; códigos, percentuais, pagamentos e cálculos de WF15 permanecem
inalterados. Os cartões usam altura fixa de 88 px e, depois da seleção da
unidade, o foco avança para os planos. Ao abrir uma opção, a página conduz ao
livro-caixa centralizado, que preserva entrada, sinais, intermediárias, saldo,
parcela e datas em linhas individuais. O cabeçalho desse livro-caixa repete a
barra compacta de 23 px da Tabela Direta: mostra somente o número da opção e o
ícone de informação; plano, modalidade, percentuais, sinais, intermediárias e
descrição integral permanecem disponíveis no popover acessível do ícone. O
fluxo editável repete esse livro-caixa com ações opcionais no topo. A área final
reúne manual, documentos, impressão e
atalhos comerciais antes da auditoria, sem o antigo painel redundante de
composição. Esse comportamento é exclusivo de WF15 e não altera a Tabela Direta.

O hub está em `/app/simulacao`. As cinco jornadas e a consulta Tabelão exigem
`crm.simulators.view` no guard server-side. O catálogo PostgreSQL permanece com
17 páginas; Tabelão, WF14 e WF15 estão implementados neste candidato pelo
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
- Tabelão consulta o estoque protegido e seleciona uma unidade por empreendimento,
  planta e área, pelo líquido com kit e os dois abatimentos. Dados inválidos são
  contabilizados explicitamente; não geram um falso menor preço.
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

`node scripts/qa/tabelao-exclusive-audit.mjs` consulta a mesma origem do proxy e
recalcula independentemente o mínimo de todos os grupos, a cobertura, campos
ausentes e estabilidade ao inverter a fonte. Aceita um caminho de payload local
não versionado como argumento. A saída contém somente agregados, sem registros
comerciais. `tests/tabelao-inventory.test.ts` cobre a regra com dados sintéticos.
