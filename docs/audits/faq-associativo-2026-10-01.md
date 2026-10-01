# FAQ do Associativo: 43 perguntas

Data da conferência: 01/10/2026. Branch compartilhada: `codex/associativo-layout-manual`.
Status: conteúdo integrado pelo PR #122 e publicado no runtime
`f1d71da81a21cf139acc26b95a6cacc218b79325`. Os 13 testes focados, gates gerais e
QA visual passaram. Publicação e limites registrados na
[auditoria integrada](layout-manual-associativo-2026-10-01.md).

## Fonte e limites da conferência

Fonte de conteúdo efetivamente lida: `Texto colado.txt`, anexo indicado pelo usuário,
com 43 perguntas numeradas e referência declarada a São Paulo capital em 30/09/2026.
Nenhuma planilha financeira ou contrato citado dentro desse texto foi fornecido para
inspeção direta nesta tarefa. As referências às células e cláusulas foram preservadas
como relatos do **material de referência fornecido**, sem afirmar acesso aos documentos.
Identificadores do contrato, nomes de anexos privados e rótulos soltos de citação não
foram transferidos para o manual. O anexo integral não foi versionado.

As informações públicas foram conferidas nas fontes primárias abaixo em 01/10/2026.
As observações sobre a página resultam da leitura do código deste checkout, não de
execução do n8n, aprovação bancária ou validação de proposta real. Não houve mudanças
em fórmulas, taxas, limites, políticas, dados remotos ou workflows.

## Implementação e integração

- Novo `app/(protected)/app/simulacao/_components/archive-investor/associative-faq-content.ts`:
  43 itens numerados em oito categorias, respostas integrais em parágrafos, referências
  públicas por resposta e nota de origem/data/limitações.
- `InvestorCalculator.tsx`: apenas import do conteúdo, bloco `ASSOCIATIVE_MANUAL_SECTIONS`
  e renderer das perguntas do Associativo. Duplicatas foram incorporadas às respostas
  equivalentes; cinco FAQs contextuais e `ASSOCIATIVE_FIELD_GUIDE_SECTION` permanecem.
- Novo `tests/associative-faq.test.tsx`: integridade, valores e ressalvas, renderização
  integral, links, preservação do guia de 27 campos e isolamento dos outros manuais.
- Este documento registra o mapa de cobertura, fontes, divergências e validações.

Preservados `h4` por categoria e `details/summary` por pergunta. As tabelas do anexo
nas perguntas 2, 18 e 39 foram convertidas em parágrafos por linha, com os rótulos,
valores e qualificadores completos. Isso permite leitura em coluna única sem uma
tabela de largura mínima no celular. As perguntas de origem recebem números 1 a 43;
as cinco contextuais e os 27 itens do guia permanecem sem numeração de origem.

Não foram criadas classes CSS. Os links reutilizam
`investor-associative-learning-sources`, com `target="_blank"` e
`rel="noopener noreferrer"`. Não houve edição de CSS, `AssociativeLearningManual.tsx`,
scripts QA ou documentos gerais pelo responsável por este escopo. A primeira FAQ
agora contém vários `p`; no QA do coordenador, a asserção de visibilidade deve
selecionar o primeiro parágrafo explicitamente.

## Fontes públicas verificadas

| Código | Fonte primária                                                                                                                                                                          | Conferência utilizada                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01    | [São Paulo, Decreto 64.895/2026](https://legislacao.prefeitura.sp.gov.br/decreto-64895-de-5-de-janeiro-de-2026)                                                                         | Artigos 1 e 2: tetos familiares/per capita e alienação HIS-1, HIS-2 e HMP.                                                                                                       |
| S02    | [São Paulo, Lei 16.402/2016 consolidada](https://legislacao.prefeitura.sp.gov.br/lei-16402-de-22-de-marco-de-2016/consolidado)                                                          | Classificações de uso, R2v e subdivisões.                                                                                                                                        |
| S03    | [São Paulo, Decreto 63.130/2024](https://legislacao.prefeitura.sp.gov.br/decreto-63130-de-19-de-janeiro-de-2024)                                                                        | Regime da produção privada HIS/HMP e responsabilidade pela destinação.                                                                                                           |
| S04    | [Ministério das Cidades, Sobre o MCMV](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/sobre-o-minha-casa-minha-vida-1) | Linhas subsidiada/financiada; OGU, FNHIS, FAR, FDS, FGTS e Fundo Social.                                                                                                         |
| S05    | [Ministério das Cidades, linha financiada](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts)                   | Renda de até R$ 5 mil para subsídios de até R$ 55 mil fora do Norte; imóveis de R$ 210–275 mil, R$ 400 mil e R$ 600 mil conforme enquadramento. Página atualizada em 28/06/2026. |
| S06    | [Portaria MCID 333/2026](https://www.gov.br/cidades/pt-br/acesso-a-informacao/institucional/base-juridica/portarias/2026/PORTARIAMCIDN333DE30DEMARODE2026.pdf)                          | Faixas urbanas e teto de renda R$ 13 mil; Faixa 2 começa em R$ 3.200,01. Publicada em 01/04/2026.                                                                                |
| S07    | [Banco Central, Resolução CMN 4.676/2018](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4676&tipo=Resolu%C3%A7%C3%A3o)                                            | SBPE e direcionamento de recursos da poupança; não usada para fixar uma quota universal.                                                                                         |
| S08    | [Habitação SP, Casa Paulista CCI](https://www.habitacao.sp.gov.br/habitacao/institucional/nossos_servicos/programa-casa-paulista/setor%20privado)                                       | Renda R$ 4.863,00, subsídio R$ 16 mil na capital, empreendimento autorizado.                                                                                                     |
| S09    | [Lei 8.036/1990 consolidada](https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm)                                                                                                | Artigo 15 vigente: depósito de 8% pelo empregador, em regra.                                                                                                                     |
| S10    | [CAIXA, utilização do FGTS](https://www.caixa.gov.br/voce/habitacao/Paginas/utilizacao-fgts.aspx)                                                                                       | Três anos, financiamento SFH, imóvel impeditivo/localização e usos do saldo.                                                                                                     |
| S11    | [CAIXA, novos financiamentos](https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx)                                                   | Avaliação, menor valor entre compra e avaliação, registro e liberação. Conteúdo recuperado pela busca indexada oficial após falha de abertura direta.                            |
| S12    | [CAIXA, perguntas sobre financiamento](https://www.caixa.gov.br/voce/habitacao/financiamento/perguntas-frequentes/Paginas/default.aspx)                                                 | Amortização/juros, seguros, tarifas e fatores do encargo.                                                                                                                        |
| S13    | [CAIXA, cartilha de juros na fase de obras](https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/Cartilha_Juros_Fase_de_Obras.pdf)                                            | Crédito liberado, encargos durante a obra e amortização posterior. Cartilha didática; não usada para garantir condições de todos os contratos atuais.                            |
| S14    | [Direcional, modelo associativo](https://ri.direcional.com.br/a-companhia/diferenciais-competitivos/)                                                                                   | Financiamento do cliente com a venda e custeio da obra.                                                                                                                          |
| S15    | [Lei 6.015/1973 compilada](https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm)                                                                                               | Artigo 290: redução de 50% nos emolumentos abrangidos da primeira aquisição residencial financiada pelo SFH.                                                                     |
| S16    | [Prefeitura SP, cálculo do ITBI](https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513)                                                                                         | R$ 725.808,00; base reduzida de até R$ 120.968,00; 0,5%/3%; modalidades e tabela 2026.                                                                                           |
| S17    | [Prefeitura SP, isenções de ITBI](https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2517)                                                                                        | Pessoa física, imóvel exclusivamente residencial, R$ 245.527,77; primeira aquisição ou MCMV nas condições publicadas.                                                            |
| S18    | [FGV IBRE, INCC](https://portalibre.fgv.br/estudos-e-pesquisas/indices-de-precos/incc)                                                                                                  | Materiais, equipamentos, serviços/mão de obra; versões M, DI e 10.                                                                                                               |
| S19    | [IBGE, IPCA](https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor.html)                                                         | Fonte e conceito do IPCA; não é índice da FGV.                                                                                                                                   |
| S20    | [Direcional, Fale Conosco](https://ri.direcional.com.br/servicos-aos-investidores/fale-conosco/)                                                                                        | Seção Relacionamento com Cliente: (31) 4002-2600 e portal Pode Morar.                                                                                                            |
| S21    | [Direcional, aplicativo Pode Morar](https://www.direcional.com.br/blog/direcional/app-pode-morar-premio-master/)                                                                        | Aplicativo próprio, documentos, pagamentos, obra e atendimento.                                                                                                                  |
| S22    | [CAIXA, serviços do contrato](https://www.caixa.gov.br/voce/habitacao/servicos/Paginas/default.aspx)                                                                                    | App Habitação CAIXA, contratos e acompanhamento de obra.                                                                                                                         |

Nota editorial: o FAQ genérico do Ministério consultado exibia R$ 3.201,01 como início
da Faixa 2. A Portaria 333/2026, artigo 1, traz R$ 3.200,01. O conteúdo usa a portaria,
coincidente com o texto fornecido e o código. A notícia oficial da CAIXA de 17/04/2026
também confirma as novas faixas e tetos operacionais a partir de 22/04/2026.

## Mapa das 43 perguntas

`REF` significa relato do material de referência fornecido, sem acesso às planilhas
ou ao contrato original. `LOCAL` significa comportamento conferido no código listado
na próxima seção. Nenhum dos dois é apresentado como legislação ou decisão bancária.

| Nº  | Tema preservado               | Fontes e tratamento                                                                                                             |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIS, HMP, R2V                 | S01/S02; municipal versus MCMV.                                                                                                 |
| 2   | Rendas e preços               | S01/S03; três linhas completas, salários mínimos e per capita; ressalva contratual REF.                                         |
| 3   | Finalidade HIS/HMP            | S03; incentivos e destinação; futuras operações REF.                                                                            |
| 4   | MCMV e recursos               | S04/S05; financiado versus subsidiado; todos os fundos preservados.                                                             |
| 5   | SBPE e poupança               | S07; natureza distinta de programa de subsídio.                                                                                 |
| 6   | MCMV versus SBPE              | S05/S07/S10; usar FGTS não torna operação MCMV.                                                                                 |
| 7   | Subsídio                      | S05; R$ 55 mil e renda R$ 5 mil; exemplo 250 − 20 = 230 mil.                                                                    |
| 8   | Cheque Moradia                | S08; R$ 16 mil e renda R$ 4.863; origem de rubrica contratual não comprovada, REF.                                              |
| 9   | FGTS                          | S09/S10; 8%, três anos e demais requisitos.                                                                                     |
| 10  | Associativo/bancário          | S13/S14; momento da contratação; dois compromissos.                                                                             |
| 11  | Etapas do financiamento       | S11/S13; registro e liberação, banco e construtora.                                                                             |
| 12  | Aprovação CAIXA               | S11; simulação distinta; 60 dias restritos ao caso REF.                                                                         |
| 13  | Cálculo das parcelas          | S12; SAC/Price, fórmula didática e parâmetros REF/LOCAL.                                                                        |
| 14  | Conceito de evolução          | S13; avanço físico versus encargo; estimativa LOCAL.                                                                            |
| 15  | Razão dos encargos            | S13; sem amortização nessa fase; dívida da construtora separada, REF.                                                           |
| 16  | Cálculo da evolução           | S13/REF; exemplo 80 mil × 0,6% = 480; K59 versus projeção LOCAL.                                                                |
| 17  | Avaliação do imóvel           | S11; exemplo 240 mil × 80% = 192 mil; base LOCAL distinta.                                                                      |
| 18  | Faixas MCMV                   | S05/S06; quatro linhas completas de renda e imóveis; teto simplificado LOCAL.                                                   |
| 19  | Finalidade das faixas         | S04/S05; sem gratuidade ou crédito automáticos.                                                                                 |
| 20  | Primeiro imóvel               | S05/S10/S15/S17; passado versus propriedade atual; SBPE e isenção LOCAL.                                                        |
| 21  | Parâmetros de aprovação       | REF/LOCAL; correção matemática distinta de permissão comercial.                                                                 |
| 22  | Ranking                       | REF/LOCAL; categorias internas; referência WF-10/WF-19 sem alegar execução.                                                     |
| 23  | Pró-soluto                    | REF D48; exemplo 45/250 = 18%; diferença da fórmula LOCAL e preço tributário.                                                   |
| 24  | Comprometimento               | REF J59; 600/4.000 = 15%; pico LOCAL, sem orçamento total.                                                                      |
| 25  | Máximo da renda               | REF M59/K59; 600 + 1.200 = 1.800, 45%; indicador LOCAL sem anuais.                                                              |
| 26  | Status da proposta            | REF/LOCAL; estados de processamento e decisão comercial, não percentual.                                                        |
| 27  | Reprovação e ajustes          | S11/REF/LOCAL; causas comerciais e bancárias; sem recursos fictícios.                                                           |
| 28  | Data de entrega               | REF/LOCAL; 0,5%/1,5%, distribuição dos meses; Habite-se contratual distinto.                                                    |
| 29  | Correções e juros             | S12/S18/S19; INCC, IPCA + 1% e Price como condição REF.                                                                         |
| 30  | Fator acumulado               | S18/S19; exemplo 1.000 × 1,005^12 = 1.061,68; diferenças/devolução REF.                                                         |
| 31  | INCC                          | S18; três versões, custos e ausência de taxa fixa.                                                                              |
| 32  | IPCA                          | S19/S18; IBGE; erro atribuído ao material sem afirmar leitura do contrato.                                                      |
| 33  | Análise de crédito            | S11; risco, documentação, imóvel; comitê referido no material.                                                                  |
| 34  | Destinatários da documentação | S11/S15/S16; bonificação de 100% específica REF, não aplicada automaticamente LOCAL.                                            |
| 35  | Custo de documentação         | S16/S17; todos os limites, taxas e exemplo R$ 4.925,80; B49, 300/1.000 REF/LOCAL.                                               |
| 36  | Parcelamento documental       | REF B52/B53; 1,5%, 36/40 meses LOCAL; sem INCC automático.                                                                      |
| 37  | Relacionamento                | S20; 4002-2600, DDD oficial incluído.                                                                                           |
| 38  | Aplicativos                   | S20/S21/S22; Pode Morar distinto de Habitação CAIXA.                                                                            |
| 39  | Entrada e sinais              | REF/LOCAL; quatro linhas de condições, 150 reais, dias 5/10/15, janelas 30/31, limite do primeiro sinal incerto no referencial. |
| 40  | Repasse reprovado             | S11/REF; crédito, cadastro, diferença financeira, garantia e registro.                                                          |
| 41  | Travas e VMD                  | S11/REF/LOCAL; 80%/90% não universais; VMD sem valor, responsabilidade do caso quitado só REF.                                  |
| 42  | Anuais                        | REF D37:E41/LOCAL; 50% da renda mensal nominal, cinco posições, 15/12, exemplo 4.000/2.000 e correção.                          |
| 43  | Linear e decrescente          | S12/REF/LOCAL; 40/30/20/10, B64/B68/B72/B76, limites da memória e distinção SAC/Price.                                          |

## Divergências e código conferido

As linhas abaixo foram localizadas neste checkout durante a tarefa; podem deslocar
com a integração de outros trabalhos. Os símbolos são as referências estáveis.

| Assunto                 | Evidência local                                                                                                                                           | Diferença ou limite explicado no FAQ                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCMV e primeiro imóvel  | `lib/archive-investor/financing-modality-rules.mjs:3`, `evaluateFinancingModality`, linha 74                                                              | Faixas coincidem com a portaria, mas teto único de R$ 600 mil e `NOT_FIRST_PROPERTY` forçam triagem sem cobrir todos os critérios legais. Q18/Q20.                                 |
| Isenção de ITBI         | `lib/archive-investor/documentation-calculator-rules.mjs:248`, `calculateItbi`                                                                            | Código exige `firstProperty === SIM` **e** `MCMV`; S17 admite primeira aquisição **ou** MCMV dentro das condições municipais. Q20/Q35.                                             |
| Base e alíquota de ITBI | Mesmo `calculateItbi`                                                                                                                                     | Usa preço de venda e regra progressiva por teto, sem verificar todas as categorias fiscais SFH/PAR/HIS/consórcio/SFI/CH. Não equivale a cálculo fiscal definitivo. Q35.            |
| Avaliação/quota         | `lib/archive-investor/associative-documentation-adapter.mjs:13`, `resolveAssociativeAppraisal`; `documentation-calculator-rules.mjs:365`                  | Quota 80%/90% sobre avaliação. S11 orienta menor entre compra e avaliação, sujeito à operação. O teto local não é VMD. Q17/Q41.                                                    |
| Pró-soluto              | `lib/archive-investor/associative-linear-calculator-rules.mjs:206`; `associative-approval-rules.mjs:443`                                                  | Deduz recursos, entrada e sinais; anuais corrigidas reduzem base mensal, não pró-soluto da aprovação. Diverge da fórmula D48 relatada. Q23.                                        |
| Evolução de obra        | `lib/archive-investor/associative-installment-memory.mjs:90`, `progressAt` e `workEvolutionAt`                                                            | Renda × 30% × progresso; mês-base e seguinte sem encargo; 100% a partir da entrega. Não é cobrança bancária sobre saldo liberado e permanece projetada depois da entrega. Q14/Q16. |
| Indicadores de renda    | Mesmo arquivo, linhas 231–275; `associative-approval-rules.mjs:443`                                                                                       | Picos separados dos fluxos; máximo mensal soma mensal + evolução, sem anual, não constante J59 + 30%. Q24/Q25.                                                                     |
| Ranking/status          | `lib/archive-investor/associative-approval-rules.mjs:1`, `ASSOCIATIVE_APPROVAL_TIERS`; `calculateAssociativeApproval`, linha 483                          | Há limites locais e estados pending/approved/rejected, mas nenhum dado comprova política externa vigente ou classificação bancária do cliente. Q21/Q22/Q26.                        |
| Sinais e datas          | `lib/archive-investor/investor-calculator-rules.mjs:458`; `associative-linear-calculator-rules.mjs:41`, `latestOfficialDate` e `firstInstallmentBaseDate` | Há caminhos de 30 e 31 dias. A validação dos sinais não limita Sinal 1 ao ato. Confirmar datas da proposta e política; não impor regra ausente. Q39.                               |
| Pré/pós e anuais        | `lib/archive-investor/associative-linear-calculator-rules.mjs:174`, `annualSchedule`, linhas 218–271; `associative-decreasing-calculator-rules.mjs`       | Anual × 1,005 × 1,005^meses completos; mês de entrega já pós; exibição usa maior pagamento por período/bloco. Q28/Q42/Q43.                                                         |
| Documentação            | `lib/archive-investor/documentation-calculator-rules.mjs:13`, parâmetros; linhas 434–455                                                                  | Honorários 300, componente bancário 1.000, juros 1,5%, Direcional 40/Riva 36. Tabela local; não reconhece bonificação de contrato individual. Q34–36.                              |

Os limites de Ranking encontrados no código, na ordem pró-soluto / comprometimento /
máximo mensal com evolução, são: Diamante 25%/20%/50%; Ouro 20%/20%/50%; Prata
18%/18%/48%; Bronze 15%/15%/45%; Aço 12%/10%/40%; Não Elegível 0%/0%/0%.
Este é inventário de implementação, não homologação comercial nem tabela CAIXA.
O FAQ remete aos limites exibidos e à política autorizada, evitando duplicar uma
tabela financeira que passaria a exigir manutenção sincronizada com o motor.

## Verificações realizadas

Ambiente: Windows/PowerShell, Node 24.19.0 pelo runtime instalado, pnpm 11.20.x.

1. `pnpm exec vitest run tests/associative-faq.test.tsx tests/associative-learning-manual.test.tsx`:
   2 arquivos e 13 testes aprovados. Cobrem 43 IDs ordenados, oito categorias, valores
   e exemplos materiais, condições específicas, ressalvas do runtime, todos os
   parágrafos no HTML, links HTTPS de fontes primárias e guia de 27 campos.
2. `pnpm exec eslint "app/(protected)/app/simulacao/_components/archive-investor/associative-faq-content.ts" "app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx" "tests/associative-faq.test.tsx"`:
   aprovado, exit code 0.
3. Diff de `InvestorCalculator.tsx` inspecionado: restrito aos imports, array do FAQ
   e renderer do FAQ. Nenhum bloco de cálculo ou manual de outra modalidade alterado.
4. Conferência editorial do anexo contra as 43 respostas: exemplos, valores, limites,
   ressalvas contratuais e divergências preservados; tabelas transpostas para texto.

## Pendências e riscos

- Não houve conferência direta das planilhas ou do contrato referido no anexo.
  Prazo de 60 dias, bonificação, juros/índices contratados, mecanismo de diferenças,
  VMD e atribuição indevida do IPCA permanecem relatos específicos do material.
- As fontes públicas têm referência temporal e municipal. Não extrapolar ITBI/HIS/HMP
  para outras cidades nem limites de modalidade para todas as operações.
- Fontes oficiais sustentam conceitos e parâmetros públicos, não homologam fórmulas
  internas. As divergências acima foram documentadas sem alterar runtime.
- Renderização estática não comprova geometria, foco ou ausência de overflow no
  navegador. QA responsivo, temas e navegação real pertencem ao coordenador, que
  está ajustando o CSS do manual e os scripts em escopo separado.
- Não executados neste escopo: gates completos `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, sync, commit, deploy ou validação n8n. O coordenador
  integra esses resultados antes de publicar.

## Resultado da integração

O coordenador executou os gates locais e as CIs `36919448507` e `36923454213`,
ambas verdes. A matriz autenticada aprovou 30 capturas do manual em cinco
viewports e três temas, teclado, foco, âncoras e axe. Os 43 itens de origem,
cinco perguntas contextuais e 27 campos permanecem no manual publicado.
O deploy utilizou imagem imutável, backup, CAS e conferência pública da versão.
Não houve alteração ou execução de workflow n8n nem mudança de regra financeira.
