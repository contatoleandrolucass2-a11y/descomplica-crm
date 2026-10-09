# Guia da pagina Associativo

Data: 09/10/2026. Branch: `codex/guia-pagina-associativo`.
Fonte: pedido e dois prints fornecidos pelo usuario.

## Escopo

- Botao Guia passo a passo no canto inferior direito do quadro de estoque,
  usando o acabamento e animacao existentes de Iniciar passo a passo.
- Apresentacao em 36 etapas: ajuda, filtros, ordenacao, unidade, ficha, dados
  ausentes, renda, modalidade, primeiro imovel, desconto, financiamento,
  subsidio, FGTS, Cheque Moradia, entrada, sinais, anuais, saldo, quantidade,
  datas, classificacao, percentuais, repasse, ajustes, Linear, Decrescente,
  cronograma, proposta pronta, remuneracao, documentacao, manual, documentos,
  impressao e plataformas.
- Anterior, Proximo, Concluir, Fechar e Escape; indicador de progresso,
  destaque da area correspondente, rolagem, foco e reposicionamento responsivo.
- Secoes indisponiveis nao sao simuladas: texto informa a dependencia e usa
  destaque de contexto. Nenhuma escolha, valor ou data e alterado pelo guia.
- Guia nao modal permite consultar os controles reais. Dialogs nativos mantem
  sua prioridade de teclado. Impressao omite guia, acionador e destaque.

## Preservacao

Motores financeiros, ingestao de estoque, permissoes, auth/RLS e integracoes
nao foram modificados. Nenhuma dependencia ou rota foi adicionada.
O guia existente de preenchimento e Aprenda + continuam disponiveis.

## Validacao

- Revisao independente dos 36 passos: refinadas orientacoes sobre financiamento
  aprovado, sinais estritamente antes da mensal e exclusao das anuais do
  indicador de renda mensal. Nenhuma formula foi alterada.
- Windows, Node 24.19.0/pnpm 11.20.0: lint sem erros (um aviso em artefato local
  antigo ignorado), typecheck, build de 45 rotas e inventario de recursos passaram.
  A suite integral teve 2.270 testes aprovados, seis skips e seis falhas POSIX
  conhecidas de permissoes/symlinks. Essas falhas nao foram suprimidas; Linux
  continua obrigatorio. O encadeamento Node da suite nao rodou apos a falha Vitest.
- Reteste focado: 98 testes aprovados (guia, calendario e paridade Salesforce).
  Revisao independente: 246 testes de contratos financeiros aprovados.
- Gitleaks do diretorio de componentes passou, sem segredos encontrados.
- O roteiro `scripts/qa/associative-page-guide.mjs` usa somente estoque sintetico
  e loopback. Esta integrado ao gate Linux antes da matriz autenticada; evidencia
  local nao equivale a prova de auth/RLS ou publicacao. Matriz browser em andamento.

## Publicacao

Pendente dos gates, PR/CI, artefato imutavel, backup, CAS e verificacao final.
