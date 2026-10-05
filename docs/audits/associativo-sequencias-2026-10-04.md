# Associativo: Sequencias Visuais

## Escopo

Pedido de doze ajustes visuais. Branch `codex/associativo-animacao-sequencial`,
base `a4a9ef500c1b17cdc70547934e71405543097fc5`.
Durante a validacao, o PR #148 integrou o canvas em `77a07a7`. O PR #150
incorpora essa main, preservando a nova composicao e repetindo os testes sobre
a combinacao. Resultados anteriores a essa integracao sao identificados abaixo.
Nao altera formulas, taxas, datas, dados do estoque, propostas, auth, RLS ou n8n.
O primeiro nome pertence ao cabecalho compartilhado; os efeitos e a remocao
do breadcrumb sao exclusivos do Associativo.

## Contrato

- Brilho integral: banda de 46% a 54% do gradiente (antes 32% a 68%), mantendo
  nucleo branco a 70% e ombros dourados a 58%; ciclo de 4,5s (antes 3s).
- Selecao, proxima acao e CTAs continuos compartilham o relogio da pagina.
  MutationObserver e eventos de formulario apenas agendam alinhamento de novas
  animacoes CSS, com no maximo um requestAnimationFrame pendente; nao ha timer
  continuo, estado React animado, calculo financeiro nem leitura de rede.
- Descricao do imovel: dez slots de 4,5s, contorno externo seguido pelas nove
  informacoes em ordem, de Incorporadora a Outras Descricoes. Um contorno ativo
  por vez, ciclo de 45s; o contorno externo usa 2px e os internos 1px.
- Parcelas: Linear 100%, Decrescente 40%, 30%, 20%, 10%, um contorno completo
  por vez em slots de 4,5s, ciclo de 22,5s. Somente com resumo calculavel.
- Resumo financeiro: brilho no plano sugerido e depois na composicao, slots
  de 4,5s, ciclo de 9s. Grupos iniciam na primeira posicao quando montados.
- Guias e tres botoes de pagamentos opcionais habilitados: reflexo sem fim.
  Controles desabilitados nao recebem o loop. Filtros nativos usam o mesmo
  reflexo no hover/foco sem substituir o select nem interceptar o ponteiro.
- Movimento reduzido desativa todos os loops; foco de teclado continua visivel.
- Dolar externo ao resumo e a tabela, alinhado a ultima data no espaco interno
  do painel de fluxo. Icone 17px, alvo 24px com mouse e 44px com toque. Bordas
  esquerda/direita de resumo e aprovacao permanecem alinhadas.
- Nome cadastrado: primeiro token de `user_metadata.name`, sem reticencias,
  com quebra para nomes extensos. Ausente/invalido usa Conta, nunca um nome
  presumido a partir do email. Identidade completa permanece no menu.

## Validacao

- Antes da integracao do canvas, preview isolado com componentes reais e estoque sintetico: 6/6 jornadas,
  temas claro/medio/escuro em 1440px e 375px; Node 24.19.0 e Chromium
  151.0.7922.34 no Windows. Evidencia local: `test-results/guidance/65118-results.json`
  e 42 capturas referenciadas. Preview nao comprova autenticacao ou servidor.
- Por jornada: dois ciclos de cada grupo, 60/30/12 amostras para os grupos de
  10/5/2 alvos; cinco CTAs sincronizados inclusive no hover/foco, seis filtros
  sem deslocamento, movimento reduzido sem loops, dolar com gap de 4px e alvos
  24/44px sem sobreposicao. QA coleta animacoes dos pseudo-elementos por subtree
  e filtra pelo target, evitando confundir o contorno do pai com os filhos.
- Lint, typecheck, build e auditoria de dependencias passaram localmente.
  A suite completa final teve 1926 testes aprovados, quatro skips condicionais
  e seis falhas POSIX do Windows. Um timeout inicial em project-devtools nao
  reapareceu na rodada final; os 24 testes tambem passaram isolados.
  As oito provas Node Salesforce passaram. Os 47 testes focados de efeitos,
  geometria, orientacao, temas e sincronizacao passaram com Chromium ativado.
  A CI Linux continua obrigatoria, sem relaxar os testes POSIX.
- Uma captura antiga de shimmer em 375px/tema medio falhou na amostragem de
  pixels; a causa nao foi comprovada. Na rodada final, ambas as metades tiveram
  alteracao visivel (3557/3466 pixels), sem reduzir limiares de contraste.
  A CI executa novamente o contrato integrado ao QA autenticado.
- Cabecalho: 76 testes focados aprovados, 60 cenarios estaticos e 66 cenarios
  adicionais usando o detector real de geometria/foco. Nomes extensos, tres
  temas e larguras de 320 a 1920px, sem afrouxar colisoes. Fixtures autenticadas
  agora cadastram nomes sinteticos explicitos; o QA exige nome esperado,
  visivel, inteiro, sem ellipsis e com rotulo acessivel correspondente.
- Testes financeiros de regressao permanecem obrigatorios apesar de nenhum
  motor ter sido alterado. Suites extensas e fixtures sinteticas rodam
  localmente ou na CI, nunca na VPS compartilhada.

## Publicacao

PR #150 aberto. A main `77a07a7` foi integrada sem remover a composicao do
PR #148. Preview combinado `50443`: 6/6 jornadas aprovadas. Revisao das capturas
encontrou o badge do fluxo ampliado pelo canvas sobrepondo o titulo; a regra
exclusiva do Associativo preserva o badge de 30px dentro de sua coluna de 30px.
O QA agora verifica a separacao entre badge e texto nos titulos.
Essa verificacao tambem detectou o badge do estoque mobile: ele preserva 28px
na coluna de 28px. A declaracao TypeScript do gate de cabecalho foi ampliada
para permitir sua execucao direta pelas fixtures de nomes completos.

Cabecalho combinado: 78 testes focados e 126 cenarios aprovados. Em 320px,
nome de 26 caracteres usa 58,17px de altura; nome de 34 usa 72,56px. O limite
compacto permanece 60px, com excecao calculada somente pela altura real do nome
mais 16px. Um teste negativo injeta 80px de padding e exige rejeicao, evitando
aprovar espaco vazio arbitrario. Os 17 testes dos dois arquivos que exercitam
esse contrato passaram, incluindo as 126 geometrias.

Preview final combinado `52473`: 6/6 jornadas e 47 testes focados aprovados.
Suite local integrada: 1944 aprovados, quatro skips e seis falhas POSIX no Windows.
CI `37245218837`: validacao Linux (incluindo os testes POSIX), banco, E2E e
restauracao isolada passaram. A matriz autenticada detectou links cortados no
menu em 320px nas quatro rotas de simulacao: nome longo ampliava o cabecalho,
mas o menu ainda descontava apenas 58px da altura da tela. Corrigido usando
o tamanho real do pai posicionado; paineis de navegacao e conta exercitados
em 320/375/600/1180px, incluindo ultimo item, com 28 testes focados aprovados.
Nenhuma referencia visual foi promovida para ocultar essa falha funcional.

CI `37247029738`, candidato `62ab2de184874538c4d927f22226fd2f4be1af78`:
154 verificacoes responsivas, 88 de temas, 209 de acessibilidade, 110 de zoom,
navegacao e jornadas dos simuladores passaram. As 209 comparacoes visuais
divergiram da referencia anterior. Antes de promover, a revisao constatou
nome sintetico de 34 caracteres muito estreito no desktop. Sua largura agora
aproveita o espaco disponivel, sem retirar os limites da navegacao; desde 1280px
o teste exige no maximo duas linhas. Os 44 testes focados passaram, incluindo
as 126 geometrias e os oito casos de menus com ultimo item dentro da tela.

Pendente de nova CI apos correcao. Aplicar o runbook automatic-publication:
PR, imagem imutavel, backup, compare-and-swap, rollback e conferencia posterior.
Nenhum dado oficial ausente na origem e preenchido por esta mudanca visual.
