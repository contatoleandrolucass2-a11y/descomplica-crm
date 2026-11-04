# Agendamentos: trimestre, meta e atualização

## Abertura — 04/11/2026

Escopo explícito: dias da semana abreviados nos eixos diários de barras/linhas;
quarta série com média arredondada para cima do trimestre anterior completo;
meta mensal por corretor baseada em dias úteis (quinta vale dois), multiplicada
pelo elenco cadastrado filtrado; detalhes por coluna diária com equipe com/sem
agendamento e nomes abreviados; investigar/corrigir atualização de30min indicada
no cabeçalho de Equipe Produtiva. Sem autorização para mudar outras páginas,
permissões, fonte comercial ou contratos por conveniência.

Git comum confirmado; checkout inicialmente limpo49b0099f. Git origin/main
1356b4b583f89eb8b83446f0571d62d8ef8a2689 após fetch; nova branch
codex/agendamentos-trimestre-atualizacao parte desse main. CI main41835791942
concluída com sucesso. Health público em2026-11-04T13:23:12Z retornou200/ok,
versão c97d5fd212d2bd62bd4bd435f19d96d0e9b2bc6f, distinta do main documental.
Fontes: Git/GitHub gh e https://crm.descomplicapro.com.br/api/health.
Resultados anteriores não validam este novo candidato. Conhecimento pertinente
e skills locais consultados; notas históricas serão confrontadas com o código.

## Implementação e diagnóstico

Usuário confirmou que feriados não são dias úteis e incluiu os municipais de
São Paulo/SP. Implementado calendário nacional + São Paulo capital (25jan,
Paixão de Cristo, Corpus Christi e9jul estadual aplicável), sem pontos
facultativos/emendas/recessos. Fonte oficial consultada04/11:
https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026 e Decreto64862/2025.
Calendário móvel calculado por ano; outubro26×20=520, novembro23×20=460.
Linha mensal substitui a referência de20 corretores pela meta calculada;
configuração comercial do medidor/funil permanece distinta e preservada.
Daily policy também zera feriados, inclusive quinta, conforme pedido explícito.

Trimestre anterior completo, quarta série e tooltips dos eixos implementados.
Partição nominal por dia reaproveita analyzeProductiveTeam, cadastro oficial,
filtros e estados indisponíveis. Popup usa portal, controle explícito em toque,
foco e Escape. Só primeiro/último nome na apresentação; chaves completas
preservadas. Equipe Produtiva usa labels com/sem agendamento apenas nesse estágio.
Releitura local da própria rota a cada30min, suspensa em aba oculta e retomada
se vencida; não usa endpoint que exija permissão diferente.

Validação local Node24.19/pnpm11.20: comparação/dias/weekday/referência/lazy57/57;
partição diária e Equipe Produtiva33/33; calendário/análise58/58; refresh3/3 e
SSR4/4. Typecheck global aprovado após corrigir somente fixture readonly.
Dois asserts antigos de meta semanal foram atualizados para excluir12out;
não foram relaxados guards, contratos ou baselines. QA visual ainda em curso.

Diagnóstico por leitura sanitizada na VPS: agenda dispara00/30, mas candidato
parado desde01/11; lock criado20:05:58Z, PID786703 morto. Journal confirma
OOM/SIGKILL20:06:31Z na etapa de estoque após os sete relatórios e publicação
comercial201. finally não executou; ciclos seguintes falham imediatamente.
Coletor limitava768MiB; estar active não comprovava atualização.

Recuperação manual solicitada/autorizada no escopo de corrigir atualização:
04/11 às13:34:25Z/10:34:25SP, apenas coletor parado, MainPID0/cgroupvazio e
nenhum produtor/export concorrente comprovados. Backup root0700/arquivos0600,
CAS de inode/tamanho/hash e PID morto antes de mover atomicamente somente lock
residual; mesma unidade/release/configuração/ledger reiniciada. Fontes privadas
em /var/lib/descomplica-salesforce-collector-install/collector-lock-recovery-20261104-zfqsd2m7.
Guard inicialmente abortou por campos voláteis de ExecStart; comparação foi
corrigida para configuração estável/hash dos arquivos e CAS repetido. Nenhum
snapshot, candidato, credencial, n8n ou dado foi apagado/reescrito manualmente.
Primeiro ciclo e próxima fronteira14:00Z serão acompanhados antes de concluir.

Primeiro ciclo recuperado refrescou a sessão13:34:30Z, mas falhou13:37:13Z
antes do primeiro relatório; PID estável e pico301MB, portanto a falha atual
não é novo OOM. A trava residual e o problema original foram recuperados;
isso ainda não comprova atualização comercial. Ensaio diagnóstico único,
sem publicação, autorizado no mesmo escopo, usa código já aprovado e erro
sanitizado, unidade efêmera limitada ao mesmo usuário/proteções/768MiB e8min,
com exclusão dos produtores e retorno à agenda original antes14:00Z.
Não alterar definições de relatórios, credenciais ou contornar login/MFA.

QA sintético concluído9/9 (três temas×1440×1000,390×844,844×390). Evidência
combinada em test-results/appointments-metas/result-combined.json: oito casos
aprovados do mesmo código e último dark844 reexecutado isoladamente após
corrigir apenas a escolha do controle visível no harness híbrido mouse/toque.
Proveniência dos arquivos parciais preservada; não repetir oito aprovações.
Bug real de recorte do popup em390 corrigido por limite de altura total à
viewport, incluindo cabeçalho/seletor e corpo flex com rolagem independente.
Asserções de limites e ausência de sobreposição foram preservadas.
Metas96/52 no fixture, quatro séries, anual5/trimestre3, tooltip numérico,
weekdays3letras/feriado, popup com/sem, foco/ArrowDown/Escape, toque/seleção e
rolagem final aprovados. Tabelas136/84, contagem visível, sem overflow do
documento, errosJS ou requests externos. Imagens identificadas como sintéticas;
não comprovam o site publicado. Artefatos locais ignorados pelo Git.

## Retomada observacional — 04/11 às14:28Z

Após intervalo inesperado das ferramentas, fontes reconferidas: origin/main
permanece1356b4b5, PR490 aberto no head8cfe5015e20e6360e267f3cb95c043d159111ce9,
árvore limpa antes desta nota. Health200/ok ainda na versão c97d5fd2. CI
41840653369 aprovou validate, isolated-restore e promotable-image; release-gates
falhou na matriz visual autenticada completa. Diagnóstico do artefato será
consultado antes de qualquer correção; não dispensar gate ou alterar outra área.
Publicação do novo código ainda não ocorreu. Registro reservado ao fechamento,
sem criar novo candidato funcional apenas por esta atualização documental.

Causa da CI visual confirmada no artifact13330776626: etapa
details:light:390:Agendamentos da própria página Equipe Produtiva ainda exigia
nome antigo do diálogo/captions. Alinhadas somente expectativas de Agendamentos
em scripts/qa/authenticated-visual.mjs, preservando outros três estágios,
geometria, foco, contagens, a11y e baselines. Testes49/49 das suítes de escopo
visual e SSR aprovados; syntax/lint/format/diffcheck aprovados. Nova CI real
necessária. captureCommit09bc6ffc pertence ao merge sintético do PR, distinto
do head8cfe5015; fonte exata do artefato registrada, sem confundir os SHAs.

Ensaio diagnóstico13:40:33–13:46:19Z terminou exit0, sem publicação; pico355MiB.
Coletor original restaurado13:46:20Z. Publicação comercial13:52:24Z, HTTP201,
requestId705b07c8-8925-47db-9d2e-2e2ad4a8584f; estoque13:52:57Z/3500itens.
Contagens agregadas20645/1266/620/2739/793/21/7. Ciclo automático14:00 falhou
14:02:31 antes do primeiro relatório, semOOM/restart, lockliberado. Isso prova
uma carga nova, não regularidade resolvida. Próximo ciclo14:30 acompanhado.

Para identificar a causa sem expor mensagem/payload privado, scheduler agora
registra safeSalesforceError(error), que só permite códigos e textos fixos já
validados. Teste específico verifica mensagem sensível/response não chegam aos
logs;9/9 testes Node aprovados. Cadência e regras de publicação não mudam.
Código local não será aplicado ao serviço sem CI main exata, backup/CAS e
confronto da árvore transitiva com a release do coletor322a4166.
