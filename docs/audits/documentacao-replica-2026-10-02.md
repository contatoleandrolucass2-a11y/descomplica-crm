# Replica de Calcular documentacao

Status: validado_local; CI e publicacao pendentes. Data: 2026-10-02.
Branch: codex/calcular-documentacao. PR: #130.

## Fonte e escopo

Pedido: reproduzir 100% do conteudo da pagina indicada, habilitando o item
Calcular documentacao do menu Simulacao. A origem foi consultada somente por GET
e inspecao do navegador: https://descomplicapro.com.br/simulacao/calcular-documentacao.
Nao houve alteracao ou publicacao nessa origem.

O cabecalho de navegacao do CRM permanece. O conteudo da pagina utiliza as mesmas
classes e estilos da referencia, ja versionados em investor-archive.css.
O componente React foi reconstruido a partir dos bundles publicos
DocumentationCalculator-BjH7PIsT.js e DocumentationFlow-D1Ugmenc.js.
O titulo pequeno do resultado tem ajuste local de contraste no tema claro,
sem mudanca de texto, estrutura, formulas ou estilos da origem.

## Inventario integral

- Trilha Simulacao / Calcular documentacao, titulo e etapas Perfil, Valores, Resultado.
- Construtora Direcional/Riva, MCMV/SBPE, primeiro imovel Sim/Nao e liberacao sequencial.
- Valor do imovel, avaliacao bancaria, financiamento e renda, com mascara monetaria,
  progresso, obrigatoriedade, limite disponivel, percentual da venda e faixa de renda.
- Sete ajudas com o texto original Em construcao, fechamento externo e por Escape.
- Data de simulacao em America/Sao_Paulo, calculo, invalidez e retirada de resultado obsoleto.
- Alertas de SBPE automatico e de simulacao invalida, erros completos e teto disponivel.
- Resumo financeiro, quantidade/valor de parcelas, primeiro vencimento e total.
- ITBI, registro total, despachante, seguro Caixa e total da documentacao.
- Tabela Price, taxa mensal, regra de ITBI e sete verificacoes da auditoria.
- Impressao e aviso final integral sobre validacao no Bora Vender/Secretaria de Vendas.

## Preservacao financeira

Nenhuma linha do motor foi modificada. Comparacao executada contra o export r do
bundle documentation-calculator-rules-DI3ss1MX.js consultado em 02/10/2026:
2 construtoras x 2 modalidades x 2 condicoes de primeiro imovel x 8 valores de venda
x 8 rendas x 4 percentuais de financiamento = 2.048 resultados profundamente iguais.

Inclui R$ 245.527,77/245.527,78, R$ 600.000,00/600.000,01,
R$ 725.808,00/725.808,01; rendas ausente, R$ 3.200,00/3.200,01,
R$ 5.000,00/5.000,01, R$ 9.600,00, R$ 13.000,00/13.000,01;
financiamento 80%, 80,001%, 90% e 90,001%. Data-base: 02/10/2026.

Caso Direcional/MCMV/primeiro imovel, venda 240.000, avaliacao 250.000,
financiamento 192.000 e renda 5.000: ITBI zero, registro 2.651,99, total 3.951,99,
40 parcelas de 132,10 e primeiro vencimento 15/01/2027.
Caso Riva/nao primeiro imovel, financiamento 201.000, renda ausente: SBPE,
ITBI 4.175,80, registro 4.710,41, total 10.186,21 e 36 parcelas de 368,26.

Reproduzir a referencia nao constitui homologacao legal/comercial dessas taxas.
Runtime oficial WF16, integracoes n8n e politicas comerciais permanecem inalterados.

## Validacao

- Lint e typecheck aprovados no Windows/Node 24.19.0.
- 32 testes focados aprovados: calculos, permissao permitida/negada e catalogo de rotas.
- Matriz dedicada de navegador integrada ao harness autenticado: liberacao, ajudas,
  MCMV, SBPE, limite, invalidacao, auditoria, impressao, 4 larguras e 3 temas.
- Revisao independente identificou classes de estado concatenadas; corrigidas e
  cobertas por assercoes dos estados inicial, preenchido e calculado.
- Build de producao aprovado no Windows.
- Suite completa Windows (Vitest com 2 workers): 1.271 aprovados, 4 ignorados,
  20 falhas em testes POSIX, timeouts de infraestrutura/MCP e conhecimento sob carga.
  Nenhuma dessas falhas pertence aos testes da nova calculadora.
- Primeira matriz local: 12 combinacoes sem overflow global e sem violacoes Axe;
  revisao das capturas detectou scroll horizontal interno do perfil ao redimensionar.
  Corrigido com overflow: clip local; adicionadas assercao geometrica e captura a 200%.
- Matriz local final aprovada: 12 combinacoes (320/390/768/1440px e tres temas),
  sem overflow ou violacoes Axe, com assercao de geometria do perfil.
  Fluxo completo, valores de referencia, teclado/ajudas, invalidacao e impressao aprovados.
- Layout equivalente a 200% (720x450 CSS em tela de 1440x900) aprovado.
  O teste nao usa CSS zoom, que nao reproduz a mudanca de media queries do navegador.
- Oito testes Node/Salesforce aprovados. CI Linux e publicacao pendentes no PR #130;
  nao promover em caso de gate reprovado. Evidencia final sera anexada ao PR.
- Docker local indisponivel; gates de banco/restore devem rodar na CI Linux.
- CI 36970005859: validate, restore e 20 testes E2E aprovados (um skip).
  documentation-results.json confirma a matriz dedicada autenticada integral,
  incluindo 12 combinacoes sem overflow/violacoes Axe. Artefato 11211986933,
  ZIP SHA-256 52ba7ebebd9e20fe0e25955527d9973e1f239aa989aff339c7dae6a1a313d026.
  A matriz das outras paginas parou na expectativa antiga de documentacao bloqueada;
  expectativa corrigida, sem reduzir verificacoes de links, teclado ou geometria.

## Seguranca e retorno

Rota /app/simulacao/calcular-documentacao mantem autenticacao e crm.simulators.view.
Calculos sao locais e nao persistem dados. Nenhuma migration, grant ou API nova.
Rollback segue o artefato anterior, conforme automatic-publication.md.
Baselines historicos das demais paginas nao sao regravados para aprovar a nova tela.
