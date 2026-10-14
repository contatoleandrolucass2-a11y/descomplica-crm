# ITBI e registro: Sao Paulo, capital

## Escopo e autoridade

Politica `sp-capital-2026.1`, conferida em 10/10/2026. Implementacao em
`lib/archive-investor/documentation-sp-policy.mjs`, compartilhada entre
Associativo e Calcular Documentacao. Trata compra e venda com financiamento e
uma garantia; nao emite guia, nao confirma direito a beneficio e nao substitui
orcamento do cartorio. Certidoes, averbacoes e outros atos nao estao incluidos.

Despachante de R$ 300, seguro Caixa de R$ 1.000, juros de 1,5% a.m. e regras de
parcelamento permanecem como parametros comerciais preexistentes. Nao sao
tarifas publicas universais. Nenhuma regra do pro-soluto foi alterada.

## ITBI

- Municipio: Sao Paulo/SP. Outra cidade nao usa esta politica.
- Pessoa fisica, uso exclusivamente residencial, valor ate R$ 245.527,77 e
  primeira aquisicao **ou** compra no MCMV: isencao de 2026. Nao exigir MCMV e
  primeira aquisicao simultaneamente; SBPE nao exclui o beneficio. Apresentar
  declaracao preenchida e assinada ao cartorio.
- Sem isencao: SFH, PAR, HIS ou consorcio com imovel ate R$ 725.808,00 usa
  `F = min(financiamento, base ITBI, 120968)` e
  `ITBI = F * 0.005 + (base ITBI - F) * 0.03`.
- Demais regimes, incluindo SFI, ou valor acima do teto: `base ITBI * 0.03`.
- Base fiscal explicitamente conferida, separada de preco, IPTU e avaliacao
  bancaria. Nao arbitrar base usando automaticamente a avaliacao do banco.
  A pagina municipal orienta maior valor entre transacao e referencia;
  controverias de avaliacao dependem do procedimento aplicavel, nao do CRM.
- Data do contrato de financiamento seleciona os limites das aliquotas;
  data da transmissao seleciona a isencao. Nao confundir com entrega da obra
  nem primeiro vencimento da documentacao. Este motor valida ambas em 2026.

Fontes:

- [Prefeitura: isencoes](https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517).
- [Prefeitura: calculo e vigencias](https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513).
- [CTN, alteracoes pela LC 227/2026, art. 165](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm).

## Registro

- Tabela II, Registro de Imoveis SP/2026, item 1, 48 faixas inclusivas em
  centavos. Vigencia validada de 08/01/2026 a 31/12/2026.
- O operador deve declarar que confirmou a tabela aplicavel com o cartorio.
  `ARISP_2` usa os totais publicados pela ARISP com ISS de 2% sobre o Oficial;
  `QUINTO_SP_2026` usa os totais publicados pelo 5o RI de Sao Paulo. Nenhuma
  opcao e selecionada automaticamente pela cidade. Outra tabela fica bloqueada.
- O repasse do ISS difere nessas publicacoes: na faixa de R$ 240 mil, ARISP
  publica R$ 2.547,41 e o Quinto R$ 2.548,04. Nao adicionar ISS novamente,
  aplicar percentual truncado nem extrapolar a tabela do Quinto para outras
  serventias. A confirmacao e declarada pelo operador, nao auditoria fiscal.
- Compra e venda: maior valor aplicavel entre preco, valor venal do IPTU e
  base usada no ITBI (Lei estadual 11.331/2002, art. 7).
- Alienacao/garantia: valor do financiamento. Nao usar avaliacao bancaria.
- O antigo multiplicador fixo `0.620879` foi removido. A reducao depende do
  enquadramento legal e nao da pergunta comercial "Primeiro imovel?".
- MCMV: reducao de 50%; FAR/FDS: 75%; financiamento residencial FGTS fora do
  MCMV: 50%, nos atos abrangidos. Beneficios nao se acumulam automaticamente.
- Primeira aquisicao residencial SFH: reducao restrita a parte financiada,
  conforme art. 290 e nota 1.8.1. Quando base registral = preco, usa
  `compra = T(preco) * (1 - 0.5 * financiamento/preco)` e
  `garantia = T(financiamento) * 0.5`, arredondando ao final de cada ato.
  O Parecer CG 346/2009-E demonstra a proporcionalidade, mas nao fixa um
  algoritmo geral de centavos. O resultado informa esse limite; com base
  registral superior ao preco, o calculo fica pendente de analise do cartorio.
- A lei federal MCMV precede a tabela estadual incompativel (Parecer CG
  35/2010-E). Nao escolher automaticamente o menor regime.
- Item 14.4: cobranca conjunta de R$ 516,81 na primeira alienacao com FGTS
  ate 6.000 UFESPs (R$ 230.520,00). Fora do MCMV, a sobreposicao com art. 43-B
  fica bloqueada, pois a precedencia especifica nao foi confirmada. O valor
  e teto permanecem na politica como referencia, nao como cobranca automatica.
- Beneficios especiais nao implementados, como FMH, COHAB, CDHU, ZEIS e
  decisao especifica, ficam pendentes de analise. HIS do perfil comercial
  nao comprova, sozinho, um beneficio registral especial.

Fontes:

- [ARISP: tabela 2026, ISS 2%](https://arisp.com.br/wp-content/uploads/2026/01/2.pdf).
- [5o RI de Sao Paulo: tabela publicada de 2026](https://www.quinto.com.br/informe-se/tabela-de-custas).
- [Lei estadual 11.331/2002 e notas da tabela](https://www.al.sp.gov.br/repositorio/legislacao/lei/2002/lei-11331-26.12.2002.html).
- [Lei 11.977/2009, arts. 43 e 43-B](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l11977.htm).
- [Lei 6.015/1973, art. 290](https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm).
- [SEFAZ-SP: UFESP](https://legislacao.fazenda.sp.gov.br/Paginas/ValoresDaUFESP.aspx).
- [TJSP: proporcionalidade SFH, Parecer 346/2009-E](https://extrajudicial.tjsp.jus.br/pexPtl/visualizarDetalhesPublicacao.do?cdTipopublicacao=5&nuSeqpublicacao=2462).
- [TJSP: prevalencia federal, Parecer 35/2010-E](https://extrajudicial.tjsp.jus.br/pexPtl/visualizarDetalhesPublicacao.do?cdTipopublicacao=5&nuSeqpublicacao=2680).

## Atualizacao e bloqueios

O contrato fiscal exige confirmacao independente do perfil comercial. Mudanca
de proposta ou de dado fiscal invalida a confirmacao anterior. Faltas, datas
fora da vigencia, outro municipio ou beneficio especial impedem o resultado
documental, sem impedir o fluxo Linear/Decrescente.

`pnpm documentation:verify-sources` consulta as duas publicacoes municipais e
o PDF ARISP e a tabela do 5o RI. Compara a primeira linha vigente de limites,
validade da politica, SHA-256 do PDF integral e as 48 faixas e totais do Quinto.
A CI impede publicacao se fonte estiver indisponivel, limite/tabela mudar
ou a vigencia expirar. Nao altera valores automaticamente e
nao certifica sozinho que todo o texto legal permaneceu igual. A consulta nao
envia dados de propostas ou clientes a nenhuma fonte.

Ao mudar ano, limite, tarifa, aliquota ou beneficio:

1. Reler fontes oficiais, inclusive leis e notas; registrar data e evidencias.
2. Conferir todas as faixas, ISS municipal e precedencia dos beneficios.
3. Versionar politica, fontes e vigencia; nunca apenas trocar ano ou hash para
   destravar CI. Outra vigencia exige tratamento explicito e testes proprios.
4. Atualizar fixtures e casos de fronteira, conferir UI nos tres temas.
5. Executar fontes, lint, tipos, testes e build; cumprir o runbook de publicacao.
6. Atualizar conhecimento versionado e sincronizar Obsidian.

O runtime nao consulta a Web a cada simulacao. Usa a politica publicada e a
data declarada; nao transporta valores de 2026 para 2027 silenciosamente.
