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

## Correção após revisão independente

A primeira versão preenchia a sobra mas conservava diferenças entre tamanhos
salvos. A revisão identificou esse caso antes da publicação. A visão geral
agora equaliza visualmente cada linha com variáveis CSS locais, calculadas
sobre a geometria original; não muda largura/altura inline ou perfil. Observar
somente mudanças de tamanho/ordem evita reagir às próprias variáveis ou ao tilt.
O teste de navegador cobre três gráficos originalmente390x500,410x650 e380x550,
verifica alinhamento e igualdade nas cinco geometrias e preservação dos valores
salvos. Os27testes focados de canvas/apresentação passaram. CI42157333051 do
primeiro candidato foi cancelada por estar superada; nova CI exigida.

O segundo achado da revisão foi o placeholder do arraste: sua substituição
removia temporariamente um artigo da contagem. O alinhador agora conserva as
medidas de cada slot durante o gesto e só recalcula após concluir/cancelar.
Novo teste real de ponteiro mantém os três slots alinhados com tamanhos
originais heterogêneos; Escape cancela sem gravação. Nenhuma alteração no motor
compartilhado do canvas foi necessária. A assinatura também é atualizada nesse
ramo para ignorar suas próprias variáveis e evitar reagendamento contínuo.

## Integração e imagem candidata

PR507 aprovado nos quatro gates em CI42158302299, head875edf82. Integrado em
06/11/2026 às04:49:19UTC no main6ae947fe83242bfd78c27a75f0fb975ae7e038f4.
Árvore a0af716fbc2fb5fbff513ebc25bda5716ba12734 idêntica à do PR aprovado.
CI do main42164749623 em andamento: validate, isolated-restore e promotable-image
aprovados; release-gates ainda executando. Nenhum gate dispensado. Nenhuma
publicação desta alteração realizada até esta observação. Checkout imutável
remoto preparado sem trocar aplicação, dados ou coletor. Diff completo desde
produção0307bd47 inclui somente estes ajustes visuais/testes e registros
documentais já integrados de CAIXA505; pacotes/lockfile não mudaram.

## Publicação e aceite — 06/11/2026

CI42164749623 do main6ae947fe concluiu os quatro gates com sucesso, incluindo
matriz completa de temas, responsividade, zoom e teclado, sem atualizar
baselines. Artefato13478678101: ZIPd43f4be0b55b50fe5ed354ae834faef691abe05a27509028cab6b9266420819b;
archive5fe06b85f8acdf408d7ad643a5735b3e5cd6847f1cb94a99f2ebe0d7eff7b1fc;
configCIfb6e87557b6734e27fa341a45bce7f947e3d78ca0a86074c9bf8e6a87956eaa7;
manifest/local7f1a9cbee17f4dfe71064e389b442e4b53c33dbf50c9cdb48791efc7a7c4089c.
Verificados14layers e cadeia OCI, sem rebuild/retag; image:prove confirmou dois
perfis sobre a mesma imagem. Promoção exclusiva pelo coordenador, CAS e locks,
deployment17006ab5-7b85-45c0-9d9c-c4a4d9b0ed27 às05:52:45.103UTC (02:52BRT),
anterior0307bd47/d29a5a61. Ledger sem pendência. Health público às05:57:48UTC
confirmou200/ok/6ae947fe; acesso anônimo à página retorna307/login.

No site autenticado integrado,32cards receberam alinhamento. As seis colunas
iniciais ficaram com larguras iguais; sobra à direita menor que0,001px.
Primeira seta exibiu funil; depois evoluções existentes e linha inteira com
Previstos/Realizados, Semanal e Score. Três artigos apresentaram largura371,47px
e altura462,78px, com topo igual. Demais grupos conferidos: três rankings,
três conversões, três faixas de recência, dois empreendimentos e os gráficos/
tabelas individuais; todos iguais dentro de cada linha e contidos na tela.
Seta anterior conferida; retorno à visão geral confirmado pelo teclado.

Celular simulado390x844 manteve os três gráficos juntos. Em844x390 ficaram
com largura259,76px, altura272,47px e fundo382px, dentro da tela390px. Viewport
restaurado a1280x720. Após reload,32IDs/ordem/larguras/alturas/colunas salvos
continuam iguais ao baseline anterior à publicação. Nenhum perfil foi gravado;
aba temporária encerrada e abas do usuário preservadas. Não repetir logout.

Evidências locais ignoradas emtest-results/appointments-rows-live: receipt.json,
visao-geral.jpg, linha-completa.jpg, celular-visao-geral.jpg,
celular-linha-vertical.jpg, celular-linha-horizontal.jpg e apos-atualizar.jpg.
São capturas reais do integrado. Chrome e arraste por controle nativo Windows
não foram repetidos nesta entrega: esse caminho havia sido bloqueado por
identificação insuficiente da URL. Ponteiro real/resize/arraste foram validados
no Chromium isolado; celular foi simulado, não aparelho físico. Esses limites
não são convertidos em aprovações não executadas. Coletor, schema, permissões,
metas e dados preservados. Esta nota final é apenas documental; não requer
reinício nem nova imagem. Integração do registro deve respeitar a janela de
main em uso pela entrega CAIXA506, sem invalidar sua CI nem cancelar trabalho.
