# Replica de Calcular documentacao

Status: pendente_validacao. Data: 2026-10-02. Branch: codex/calcular-documentacao.

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
- Suite completa em Windows apresenta falhas POSIX e timeouts sob carga;
  execucao final, build, matriz visual, CI Linux e publicacao pendentes.
- Docker local indisponivel; gates de banco/restore devem rodar na CI Linux.

## Seguranca e retorno

Rota /app/simulacao/calcular-documentacao mantem autenticacao e crm.simulators.view.
Calculos sao locais e nao persistem dados. Nenhuma migration, grant ou API nova.
Rollback segue o artefato anterior, conforme automatic-publication.md.
Baselines historicos das demais paginas nao sao regravados para aprovar a nova tela.
