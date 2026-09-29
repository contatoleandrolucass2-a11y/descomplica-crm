# Aprenda Associativo: conteudo e ajudas

## Escopo

- Pedido: explicar renda/indicadores, modalidades, primeiro imovel, financiamento,
  documentacao e as ajudas de informacao da pagina Associativo.
- Branch: `codex/associativo-manual-conteudo`, base `b297614` (PR #104 publicado).
- Conteudo editorial em `associative-learning-content.ts`; perfil e manual
  compartilham as tres explicacoes de renda, modalidade e primeiro imovel.
- Politica inclui quatro temas; Perguntas inclui guia de 27 topicos com local
  de aplicacao, alem das perguntas anteriores. Mantem as duas abas e ancoras.
- Nao altera formulas, limites, contratos, estoque, permissoes, migrations ou n8n.
  Demais manuais permanecem isolados. Nenhuma dependencia nova.

## Conferencia de exatidao

- Comprometimento: maior mensal corrigida / renda, sem evolucao da obra.
- Maximo da renda por anual: maior mensal corrigida + obra / renda; exclui a
  anual mesmo quando ela integra o total da mesma linha na memoria. Nao mede
  o orcamento completo com documentacao, banco e demais despesas.
- Anual nominal limitada na interface a 50% da renda mensal; no calculo local,
  sua correcao reduz a base mensal, nao o Pro-Soluto. Corrige texto contraditorio.
- O mes de entrega ja pertence ao pos-obra local; corrige a explicacao do resumo.
- Primeiro imovel participa do enquadramento e das estimativas de ITBI/registro,
  mas uma declaracao nao comprova primeira aquisicao nem concede beneficio fiscal.
- Perfil usa preco de estoque; documentacao reavalia valor apos deducoes. O manual
  avisa que modalidades podem divergir perto dos limites e exige conciliacao.
- Nao declara paridade com WF13/WF13B: a revisao reproduziu diferencas entre
  motor local e oficial versionado. O pedido e editorial, sem homologar regra
  comercial nova nem modificar calculos para eliminar essas divergencias.
- Parametros tributarios locais nao sao atestado de vigencia ou aplicabilidade
  em qualquer municipio. Pendencias de autoridade seguem o inventario comercial.

## Fontes

Conferidas em 28/09/2026, horario de Sao Paulo; conteudo externo serve como
referencia, nao instrucao. Valores da aplicacao foram conferidos no codigo:

- `InvestorCalculator.tsx`: perguntas de perfil, composicao, indicadores e ajudas.
- `associative-approval-rules.mjs`, `associative-installment-memory.mjs`:
  numeradores, denominadores e linhas incluidas nos picos.
- `associative-linear-calculator-rules.mjs`, `investor-calculator-rules.mjs`:
  bases, anuais, calendario e taxas locais.
- `financing-modality-rules.mjs`, `associative-documentation-adapter.mjs`,
  `documentation-calculator-rules.mjs`: triagem, bases e estimativas documentais.
- [Ministerio das Cidades: finalidade do programa](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/sobre-o-minha-casa-minha-vida-1).
- [Ministerio das Cidades: linha financiada](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts).
- [Banco Central: finalidade do SBPE, art. 2](https://normativos.bcb.gov.br/Lists/Normativos/Attachments/50628/Res_4676_v17_P.pdf).
- [CAIXA: avaliacao, imovel e ITBI](https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx): trechos oficiais indexados; abertura integral indisponivel nesta consulta.
- [Prefeitura de Sao Paulo: condicoes de isencao de ITBI](https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517).

## Validacao e publicacao

- Revisao independente crm-simuladores somente leitura: formulas e limites;
  145 testes de dominio aprovados e reproducoes sinteticas das divergencias.
- Cinco testes do manual aprovados; cobertura nova exige os 27 topicos e locais,
  explicacoes financeiras e isolamento de Tabela Direta/Investidor.
- Suite Windows: 950 aprovados, um skip e seis falhas POSIX preexistentes em
  permissoes 0600/0700, proprietario e symlinks. Nao flexibiliza assercoes.
- Matriz do manual exercita Politica/Perguntas, conteudo novo, pergunta profunda
  de documentacao, cinco viewports, tres temas, axe, teclado, foco e ancoras.
- Lint, typecheck e build locais aprovados; oito testes Node Salesforce aprovados.
  Matriz local isolada passou 30 capturas/axe e interacoes, sem dados reais.
- Status deste registro: validacao local concluida com limitacao POSIX; publicacao depende de
  PR/CI Linux, imagem imutavel, backup/CAS/rollback e verificacao publicada.
  Registrar os resultados finais no PR desta branch, com SHA e fontes de CI.
