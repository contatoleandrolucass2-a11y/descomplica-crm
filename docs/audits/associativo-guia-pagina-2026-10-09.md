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

PR #174, primeira CI `37888409221`: validate passou. O novo gate browser reteve
o clique sintetico em filtro sob o painel flutuante em 320px. O roteiro passou
a navegar ate a etapa de filtros e rolar o controle para a area livre, conferindo
`elementFromPoint` antes do clique real. Sem `force`, remocao de verificacoes ou
alteracao de baselines. Reteste local em 320x568 aprovou os tres temas e os dois
estados, com 36 etapas cada.

Matriz local integral aprovada: 18 cenarios, 648 visitas aos 36 passos,
1440x900/375x812/320x568, tres temas e estados sem unidade/com proposta.
Preservacao de campos, selecao e filtros, teclado, reabertura, geometrias, Axe e
ausencia de erros de console confirmadas. Estoque completo antes dos filtros:
seis combinacoes adicionais 1440x900/1280x720 e tres temas passaram no predicado
original de viewport inicial, sem overflow. O roteiro agora integra essa prova.

CI `37889190061`, HEAD `fba599b`: validate Linux, restore isolado, banco,
advisors, build, gate do guia e E2E/autorizacao passaram. Na matriz autenticada,
o predicado funcional original aprovou 154 checks responsivos, 88 de tema,
242 de acessibilidade, 110 de zoom, teclado, menus e simuladores. Apenas sete
comparacoes visuais do Associativo falharam pela inclusao do acionador.

Captura limpa `4c6ad9a4da8b7fe36bf8161888be4a521a21be09`, arvore identica ao
HEAD acima; artefato `11598453651`, ZIP SHA-256
`7c56783832bcc5224bb4de4e68b99b1f2d25ce512aab1f9ff0607a42365cc081`.
Imagens inspecionadas, hashes de todas as candidatas/baselines conferidos e
promocao transacional pelo helper existente. Sete referencias atualizadas,
235 imagens e sua proveniencia preservadas. Limiares de 1%/16 inalterados.
CI final em verify, merge e publicacao continuam pendentes.

## Publicacao

Pendente dos gates, PR/CI, artefato imutavel, backup, CAS e verificacao final.
