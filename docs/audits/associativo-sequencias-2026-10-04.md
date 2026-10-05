# Associativo: Sequencias Visuais

## Estado final em 05/10/2026

Runtime `e1ab14a8739153c56081e4f36a76e99f80fed8b2` publicado. PR #150 e CI
do main aprovados. As pendencias de CI descritas cronologicamente abaixo foram
superadas. O nome cadastrado inteiro esta implementado e validado nas fixtures;
a sessao usada no postcheck nao forneceu nome valido, portanto mostra Conta.
Foi solicitado ao usuario o nome e autorizacao especifica para alterar somente
esse dado de perfil. Nenhuma conta foi modificada nem nome inferido do email.

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

CI `37249431505`, tentativas 1 e 2: codigo, banco, restauracao e build passaram,
mas o E2E de paginas de simuladores excedeu 360s. A matriz visual nao executou.
O erro de context.close ocultava a operacao inicial. O diagnostico agora preserva
esse erro e usa limites por acao de 15s e navegacao de 45s, sem aumentar limites.
Teste local com componentes, fonte real e CSS dos simuladores aprovou geometria,
cliques de temas e menu em 1181/1280/1440/1920px; nao reproduziu o E2E completo.
Publicacao continua bloqueada; causa do timeout ainda nao determinada.

Diagnostico conclusivo posterior, CI `37251923554`: o clique em Claro era
interceptado por Configuracoes no Dashboard. A ampliacao do nome reduzia a coluna
de navegacao abaixo do conteudo; a coluna de temas tambem podia ficar menor que
seus tres botoes. A grade agora preserva ambas as larguras intrinsecas e limita
o nome ao restante. A fixture inicial nao representava os tres grupos com
chevrons; corrigida e ampliada com fontes system-ui/Verdana e hit-testing.
Prova negativa restaura o layout anterior em 1280px e exige detectar a colisao.
Nenhum clique forcado, timeout ampliado ou assert removido.

## Candidato final e referencia visual

CI `37253579651`, head `1ddd1f0a1231c2034a0105344a5616295b788c38`,
captura limpa `f8ea013c08a59156d7b45f14966f2a82eaf13998`: validacao Linux,
restauracao isolada, E2E e todos os contratos funcionais do QA autenticado
passaram. Foram 154 verificacoes responsivas, 88 de temas, 209 de acessibilidade,
110 de zoom e 40 combinacoes de navegacao. Comparacoes: 173 divergentes e 36
aprovadas, mantendo tolerancia de canal 16 e limiar de pixels de 1%.
O job release-gates ficou vermelho exclusivamente pelas comparacoes visuais.

Artefato GitHub `11322586971`, nome
`authenticated-visual-candidate-f8ea013c08a59156d7b45f14966f2a82eaf13998`;
SHA-256 do ZIP
`ac0ea4f30df123afa925b0fd830b12332ab8ba1cbc582bbd350a211aa7361232`.
A verificacao previa confere manifesto e todas as 418 imagens de origem e
candidato por hash, baseline versionada e inalterada durante a captura e os
gates funcionais canonicos. A promocao permanece condicionada a revisao visual.

Os 33 recortes do cabecalho foram conferidos em Dashboard, Associativo e
Administracao, de 320 a 1440px e nos temas capturados. O nome sintetico extremo
permanece completo por quebra de linha, sem interceptar os controles vizinhos.
Os menus de 320px mantem o ultimo item acessivel. A remocao do breadcrumb
permanece restrita ao Associativo. A main documental `2b713fa` foi integrada
depois da captura sem alterar runtime; nova CI continua obrigatoria.

Revisao independente concluida sobre os 209 pares: 18 folhas de topo/fim,
31 pares de recortes detalhados e comparacao integral da sobreposicao corporal.
Nenhuma nova regressao estrutural identificada; os recortes preexistentes nos
funis de Metas/Parcerias permanecem fora deste escopo. Caudas de capturas de
viewport nao comprovam o rodape inteiro, e esta revisao estatica nao substitui
os testes dinamicos de efeitos e estados posteriores descritos acima.
Evidencia local: `test-results/pr150-review-final/REVIEW.md` e `integrity.json`.

Promocao canonica transacional concluida: 173 imagens revisadas atualizadas,
36 referencias aprovadas preservadas byte a byte. Nenhum limiar, tolerancia,
assert ou gate reduzido. Lint (um aviso em helper local ignorado), typecheck e
build repetidos com sucesso apos integrar a main documental. Publicacao ainda
pendente da nova CI em modo verify e da prova da imagem imutavel.

Rodada local apos promocao: 1944 testes aprovados, quatro skips condicionais
e as mesmas seis falhas POSIX no Windows, sem timeout adicional; os oito testes
Node Salesforce passaram separadamente. Auditoria: nenhuma vulnerabilidade
conhecida. A CI Linux continua sendo a prova obrigatoria para os testes POSIX.

## Evidencia de publicacao

- PR #150 integrado apos CI `37257462975` integralmente verde no head
  `292641f8366c76e9c629ddd21ecde9ff24686ccd`, inclusive QA em modo verify.
- Main `e1ab14a8739153c56081e4f36a76e99f80fed8b2`: CI `37259237555`
  aprovou validate, release-gates, isolated-restore e promotable-image.
- Artefato GitHub `11323174321`; SHA-256 do ZIP
  `9e1b2700ec83eb5ea2aac6b7700aaab2a0119becb007e59f44c4167a938f7c38`.
  Arquivo image.tar.gz:
  `d2760448aaced488694a1be84d74efed0989a924cf0635f833118a02e6ed7b1b`.
- Digest de configuracao da CI:
  `sha256:6055b658e764d186aaed2c8d82dbcdfe1c26b68a71ea71ccd848c6811fceb459`.
  Manifesto carregado no containerd:
  `sha256:135dc775d6f2275a608572175c3686d99740fadffcf561fca99bb4d65a31ed4f`.
  Cadeia OCI, plataforma, label e 11 camadas conferidas; dois perfis de runtime
  aprovados sobre a mesma imagem. Nenhum rebuild na VPS.
- Um comando de prova terminou com CR no caminho ao receber stdin do PowerShell;
  falhou antes do bind. Reexecucao com caminho absoluto direto aprovou os dois
  perfis. Nao houve tentativa de contornar ou omitir essa prova.
- Checkout destacado e limpo em `/srv/descomplica-crm-releases/<SHA>`; checkout
  principal preservado. Backup privado verificado em
  `/var/backups/descomplica-crm/releases/e1ab14a8739153c56081e4f36a76e99f80fed8b2.hKLoTg`.
  CAS partiu de `77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`, com rollback
  preparado e configuracao Nginx inalterada. Promocao concluiu com codigo zero.
- Health local/publico e container saudaveis no SHA novo. Estoque/snapshot
  anonimos negados (401), rota protegida redireciona (307). Smoke observacional:
  12 GETs, concorrencia 4, zero erros; nao comprova capacidade de producao.

Postcheck autenticado no Chrome, sem salvar/enviar proposta: cenario sintetico
com renda 5000, financiamento 190000, entrada 1000 e 84 parcelas, usando uma
unidade com avaliacao e andamento oficiais disponiveis. Comprometimento
14,13%/17,58%, maximo 44,13%/44,71%; documentacao e resumo foram calculados.
Ao trocar a unidade, renda, modalidade, primeiro imovel, recursos, entrada e
quantidade permaneceram preenchidos. Nao se infere cobertura de todas as
unidades a partir deste smoke; a matriz isolada continua sendo a prova ampla.

CSS computado da pagina publicada confirmou 10 alvos/45s, 5 alvos/22,5s e
2 alvos/9s, com defasagem de 4,5s, alem do CTA infinito de 4,5s. Dolar: alvo
24px, icone 17px, gap 4px apos o resumo, diferenca vertical de centro 0,34px e
espaco restante de 4,65px antes do painel no viewport observado. A API de
animacoes nao estava exposta pelo navegador de automacao; nao foi contornada.
Sincronia temporal e amostragem de dois ciclos foram comprovadas na CI/preview,
nao reexecutadas via essa API em producao.

Registro posterior somente documental, sem novo restart. Nenhuma alteracao
de banco, credenciais, conta, politica financeira, estoque, DNS ou n8n.
