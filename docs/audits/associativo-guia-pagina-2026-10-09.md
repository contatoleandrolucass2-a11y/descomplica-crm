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

CI final `37892455623`, HEAD `4477eb9`: validate, restore e release-gates
aprovados integralmente em verify. O merge protegido identificou a main mais
recente `4e16a61` (PR #168, Repasse); essa atualizacao foi integrada sem conflitos
e sem alterar seu escopo. Nova CI conjunta obrigatoria antes da publicacao.

## Publicacao

Concluida em 09/10/2026. PR #174 integrado normalmente, sem bypass, depois da
CI conjunta `37895047634` aprovada. Release
`c20c9d2951f4860d6419369daa1f99153f160351`; todos os jobs da CI main `37898684744`
aprovados: validate, release-gates, isolated-restore e promotable-image.

- Artefato de imagem `11601353622`; ZIP SHA-256
  `82eff28da1563314526c271cea257d1c99f3db616f9184bf6435ed30126ea74d`.
- Imagem compactada SHA-256
  `19b19bbc3e4a70fee100604ac8e917b4e6bf1f53348ba76b2c521634e6017efa`.
- Config ID da CI `sha256:cc4eb3746c28b9c44e7042a648346da387f986a4a7aa6b46454c81ae5daddf47`;
  manifesto/ID local `sha256:919790ef6d43958e52a517a8740c5ca0be74d15b06fdbf2c292989b212e50715`.
  Cadeia OCI, configuracao, camadas e label conferidos; `image:prove` aprovou
  homologacao e producao usando a mesma imagem, sem rebuild no servidor.
- Versao anterior reconciliada `4e16a619689ce29ac1c6b6e2dc7171119b798757`.
  CAS, backup de configuracao com hashes e rollback preparados pelo helper
  existente. Backup: `/var/backups/descomplica-crm/releases/c20c9d2951f4860d6419369daa1f99153f160351.o1dEq5`.
- Container saudavel, health local/publico com SHA novo, APIs de estoque sem
  sessao retornando 401 e rota protegida retornando 307. Nginx preservado.
  Nenhuma migration, dado comercial, permissao, DNS ou workflow n8n alterado.
- Sessao real conferida em aba separada: botao presente, abertura em Passo 1 de
  36, avanco, retorno, Escape, fechamento e reabertura aprovados; nenhum imovel
  selecionado ou valor alterado, sem erros de console. Guia deixado aberto.
  Captura local ignorada pelo Git, sem exportar estoque ou identidade para o PR.

Depois da integracao de Repasse, lint, typecheck e build locais passaram
novamente. Windows: 2.279 testes aprovados, seis skips e as mesmas seis falhas
POSIX; suites Linux obrigatorias aprovadas no PR e na main. Historico das etapas
pendentes acima mantido como registro cronologico, nao como estado atual.
