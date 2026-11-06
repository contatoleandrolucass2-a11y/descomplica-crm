# Agendamentos: alinhamento e navegação por linhas

## Abertura — 06/11/2026

Demanda restrita a Agendamentos: preencher a largura útil, alinhar os cards e
mostrar juntos os gráficos da mesma linha ao navegar pelas setas. Remover
somente os textos visíveis Subir seção e Descer seção, preservando os nomes
acessíveis. Não alterar metas, coleta, dados, permissões ou outras páginas.

Git comum confirmado. Base origin/main7084fda6; PR504 integrado em0307bd47,
CI42099068642 aprovada. Health público200/ok/0307bd47 observado em06/11 às
03:11:20UTC; deploymentd29a5a61 de05/11 às20:56:59UTC, sem pendência no ledger.
Checkout anterior preservado com seus registros locais não publicados.
Novo worktree codex/agendamentos-alinhamento-linhas isolado da demanda CAIXA506.

Skills locais descomplica-interface, descomplica-validacao, cavecrew e Caveman
Lite. Escritas disjuntas: hook/teste de navegação por linhas delegado; shell,
estilos, integração e registros pelo coordenador. Testes aprovados da versão
anterior não comprovam a mudança nova; executar regressões focadas e CI candidata.

## Implementação e validação local

Cards da visão geral usam o espaço restante de cada linha, mantendo suas
dimensões salvas como base do fluxo. Guia captura as linhas antes de esconder
cards e conserva os grupos até sair. Cada linha apresentada ocupa a largura
útil com colunas iguais e altura comum limitada pela tela. Escape retorna aos
mesmos nós React e estado; nenhuma gravação de perfil é disparada pelo guia.
Subir/descer conservam nomes acessíveis e mostram somente os ícones.

Node24.19: nove testes unitários aprovados; browser Chromium isolado passou
cinco geometrias (1280x900,390x844,844x390,640x450 e zoomCSS200%). Conferidos
preenchimento à direita, três gráficos juntos, alinhamento, altura/largura
iguais, limite da tela, retorno/estado preservado, modal centralizado e
redimensionamento pelo canto. Typecheck e ESLint focado aprovados. Screenshots
usam fixture sintética e não representam dados reais nem publicação.
Primeiro teste de resize detectou que a largura renderizada agora inclui a
distribuição da sobra; a asserção passou a medir a largura inicial real e
continua verificando o delta correto na escala lógica, sem ignorar a falha.
