# Agendamentos: quinze prints, metas e desempenho

## 2026-11-07 — Agendamentos: quinze prints, metas e desempenho

Abertura exclusiva de `/app/etapas/agendamentos`: inclinação dos indicadores,
calendário compacto, conversões, popup diário, controles e layouts de linhas,
metas por dia útil de São Paulo, nomes e atualização a cada dois minutos.
Git comum confirmado; checkout limpo inicialmente em HEAD destacado
9d8ad1cd01c1d2fd775283a4cb57bacc11ee583e, igual a origin/main após fetch.
GitHub consultado em 07/11/2026 às 04:41–04:48 UTC: default main; CI documental
42250061953 e CI funcional 42230895044 concluídas com sucesso. PR507/509 são
as últimas entregas pertinentes de alinhamento; PR510 documental CAIXA aberto
não amplia o escopo. Health público HTTP200/status ok/version
9ee2c0cf7fe11df21efeb58cc19c615d71058948. Local/integrado e runtime diferem
por documentação. Fontes: Git origin, API/conector GitHub do repositório
contatoleandrolucass2-a11y/descomplica-crm e
https://crm.descomplicapro.com.br/api/health. CLI gh ausente do PATH; consultas
públicas recuperadas via API, sem credenciais. Contexto e busca temática do
runtime Obsidian aprovados; notas antigas conferidas somente como contexto.
Implementação, validação e publicação desta demanda ainda pendentes.

## Implementação e validação local

Branch `codex/agendamentos-ajustes-prints`, base9d8ad1cd. Indicadores do canvas
usam limites de45° nos dois eixos e geometria inicial estável durante o gesto.
Calendário compacto, conversões realizadas inferiores à proporção esperada
com borda analytics-danger, popup diário compacto com fechamento por saída do
ponteiro e caminhos de teclado/toque preservados. Nomes usam as primeiras duas
palavras somente na apresentação; chaves e nomes completos são preservados.
Removidos os controles Torres/Altura e Ver valores e cobertura. Comparativo
mantém quatro séries, com linhas retas, suaves, degraus, pontos ou área;
ausência de cobertura continua quebrando a linha.

Cabeçalho da meta diária usa o dia civil atual SP e o elenco filtrado,
independentemente do intervalo histórico. Regra existente preservada:
1seg/ter/qua/sex,2quinta,0fins de semana e feriados. Corpus Christi/Paixão de
Cristo e aniversário municipal são feriados; pontos facultativos continuam
dias úteis. Feriado estadual09/07 preexistente preservado. Fonte conferida:
https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026. Nenhuma mudança de
meta comercial mensal, permissão, banco, migration ou workflow.

DashboardAutoRefresh recebe120000ms somente nesta rota; outras páginas
preservam30s. Consulta autorizada lê apenas versão do snapshot, sem escrita
ou coleta; pausa em aba oculta, evita sobreposição e atualiza a rota quando
versão/dia muda. São30sondagens/hora por aba ativa em regime periódico, além
de montagem/foco/reconexão. O intervalo não altera frequência da fonte externa.

Comparativo substitui análises mensais repetidas por uma agregação de toda
cobertura usando o mesmo analisador canônico. Teste diferencial em36cenários
v2/v3/v4 cobre filtros dimensionais e temporais. Benchmark pareado Windows,
Node24.19, mesmo processo/entradas, três pares por tamanho, JSON idêntico nos
seis pares: mediana1000registros920,69→167,18ms;5000registros5395,37→671,71ms.
Baseline gitHEAD9d8ad1cd e candidato workingtree em bundles de memória.
Ambiente compartilhado/concorrente; não mede latência total ou produção.

Validações até esta etapa: tipos aprovados;34testes dashboard/refresh/calendário,
28metas,21comparação e48módulos visuais aprovados. Browser sintético popup/linhas
passou desktop1280 e toque390, foco/teclado, cinco layouts/quatro séries,
fechamento ao sair e nomes; zero erroJS/rede externa. Diagnóstico Chromium
Shell+Dashboard: barras positivas antes de hover em baseline e candidato.
Sintoma original de gráficos visíveis apenas com hover não foi reproduzido;
o custo síncrono foi corrigido, sem atribuir causa não demonstrada.

resources:doctor pronto para dependências, runtime, Chromium e scanners; Docker
local indisponível/opcional. Gates completos, imagem, CI/PR e publicação ainda
pendentes. Scripts QA legados afetados foram adaptados aos controles removidos;
seed de altura salva é exclusivamente sintético, sem alegar edição pela UI
removida. Evidência de persistência/geométrica em andamento.

## Revisão independente e regressões

Revisão estática não identificou outros problemas nos filtros, quatro séries,
cinco layouts, null gaps,120s opt-in e movimento reduzido. Um P2 reproduzido:
popup aberto por hover recebia foco e reabria após auto-fechar, por restauração
do foco na barra. Guard síncrono corrigido; oito cenários browser desktop/toque
aprovados, incluindo fechamento e novo hover posterior.

Aceite literal sempre zero refinado: cálculo direto retorna0 em fim de semana
ou feriado mesmo com quantidade de corretores desconhecida; dia útil continua
indisponível sem elenco. Séries analíticas esparsas e cobertura sem elenco
permanecem preservadas. Após essa mudança,102testes em cinco arquivos de
metas/análise/comparação passaram. A expectativa antiga de null em Corpus
Christi foi substituída pelo zero explicitamente pedido, sem ocultar falha.

Tilt Chromium confirmou±45° nos quatro extremos e retorno0/0. Calendário passou
nos três temas em1280×900/390×844; falha844×390 exigiu variante de duas colunas
e densidade específica. A nova variante aguarda confirmação no mesmo cenário.
Lints focados e tipos aprovados; validação global permanece responsabilidade
da CI candidata, sem reutilizar sucesso de SHA anterior.

Confirmação final local: calendário844×390 nos três temas mede333px de conteúdo
e333px visíveis, entre27,625–362,359px da tela, sem rolagem. As bordas negativas
de conversão e card têm RGB idêntico:165,31,58 light/medium e220,38,38 dark.
Zero errosJS. Cenários já aprovados de1280×900 e390×844 não foram repetidos.
First-save-only passou22cenários de persistência/dimensões/concorrência, sem
rede externa. HTTP503/409/409 são falhas sintéticas injetadas no próprio QA.
Resultados ignorados peloGit: test-results/appointments-daily-team-focus/result-after.json
e test-results/appointments-first-save/prints-20261107/result.json.
Quatro outros QA legados tiveram apenas validação sintática; CI ainda pendente.

PR512/head05e05f41: CI42340849456 aprovou formatação/lint/tipos;5168testes
passaram, dois falharam em stages-page.test.tsx porque as chamadas esperadas
não incluíam a nova prop intervalMs120000. As duas asserções foram atualizadas
para exigir o intervalo solicitado, sem relaxar comparação ou alterar runtime.
Os demais jobs foram ignorados por dependência; não contam como aprovados.
Controle de navegador e node_repl indisponíveis nesta sessão com erro
sanitizado failed to write kernel assets / caminho não encontrado. Sem contorno
de login/configuração; validação autenticada real pós-publicação fica limitada
por essa ferramenta. Chromium sintético e gates isolados permanecem distintos.

CI42341206694/head7c6eca9c: validate e promotable-image aprovados. O browser
do detalhamento ainda esperava Conta sintética00271 como texto visível após o
pedido de abreviar nomes. Teste atualizado para conferir duas palavras visíveis
e identidade completa no title; contagem136linhas e ausência de novas requisições
em resize/drag/cópia continuam exigidas. Nenhuma alteração adicional de runtime.

Browser corrigido aprovado localmente:136linhas em cada cópia, drag/resize/cópia
sem requisições adicionais e zero errosJS. Revisão final preservou explicitamente
o gesto legado do TiltCard fora do canvas, pois Equipe Produtiva reutiliza esse
componente; limite45° e geometria estável aplicam-se somente ao canvas solicitado.

## Integração e aceite adicional de altura média

PR512/head6f7d339a aprovado em CI42341969606 nos quatro jobs, sem alterar
baselines. Merge7c0c8769869834de158d1e7b3ea64d499b6923e6 em07/11 às06:04:41UTC;
árvorec6536bf51ecd23743f429d5bcdf92ecaa3350293 idêntica à do PR. CI main42345394446
em andamento; aplicação ainda não publicada. Checkout remoto imutável preparado
e limpo, Node24.19/pnpm11.20, ledger sem pendência na versão9ee2c0cf.

Aceite adicional pela proporção do Print2: calendário1200×563 apresentou
client537/scroll540, excesso3px nos três temas. O painel natural540 excedia a
área permitida e media450 não ativava a compactação.1280×600 passou550/550 e
1280×900 com zoomCSS1,5 passou598/598/largura744px nos três temas, sem errosJS.
Breakpoint ampliado para600px, sem mudar a geometria já aprovada de duas colunas.
Revalidar apenas563/600, agora afetados. Pendência bloqueia a publicação desta
demanda até concluir o ajuste e seus gates, sem aceitar o excesso como baseline.

CSS600 aprovado em seis casos (563/600,três temas), dialog333/333 e painel333/333,
sem errosJS, dentro da tela. Regressão local com agosto de seis linhas passou
nove combinações (1200×563,1280×600,844×390,três temas), conteúdo359/359.
QA integral calendário/comparação:20checks/6capturas aprovados. O teste legado
parou inicialmente ao buscar label exato Modelo: o label contém também os textos
das opções. Seleção por combobox/nome acessível corrigiu a automação; modelo
line, quatro séries, transições de mês e dia bissexto passaram. Mesma correção
aplicada ao QA lazy que havia sido adaptado ao editor, sem mudar runtime.
Artefato local ignorado: test-results/appointments-calendar-comparison/result.json.

QA lazy complementar aprovado:13checks, contagens de comparação estáveis durante
arraste em1440×900 e390×844, sem falhas. Resultado ignorado em
test-results/appointments-comparison-lazy/after. Demais evidências do PR512
permanecem válidas para os comportamentos cujo código não mudou; gates da CI
continuam obrigatórios para o candidato complementar.
