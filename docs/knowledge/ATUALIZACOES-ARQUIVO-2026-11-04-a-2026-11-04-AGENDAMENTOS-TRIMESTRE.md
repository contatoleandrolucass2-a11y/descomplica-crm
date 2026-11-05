# Agendamentos: trimestre, meta e atualização

## Correção comprovada da página inicial — 04/11/2026

Na retomada autorizada, investigação local comprovou disputa entre
DashboardFilters.module.css `.filters p` e DashboardReport.module.css `.report p`.
Ambos tinham especificidade0,1,1. Ordem dos chunks fazia o aviso de disponibilidade
alternar margem superior10px/0px; o conteúdo seguinte alternava top101px/91px,
reproduzindo exatamente a redução de10px nas11capturas da CI anterior.

Correção mínima: classe statusNotice nos dois avisos de DashboardFilters,
com seletor `.filters > .statusNotice` (0,2,0). Mantidos conteúdo, valores
de margem, fonte, cores e referência; não foi necessário promover baseline.
O seletor original `.filters p` permanece, preservando avisos de opções vazias.
Teste novo tests/dashboard-filter-spacing.browser.mjs usa componentes e CSS
reais, adiciona reset original depois dos estilos para reproduzir ordem adversa.
Antes falhou; depois12/12aprovado em três temas e320/390/768/1440px, ambos
os status (pendente com useTransition real e indisponível), ambas
as ordens com margem10px e fluxo idêntico, sem overflow, errosJS ou rede externa.
Artefatos ignorados: test-results/dashboard-filter-spacing/before-fix.json,
result.json,before-fix.png,after-fix.png. Não são dados de produção.
As suítes anteriores dos comportamentos inalterados foram reutilizadas;
CI completa no novo SHA continua obrigatória antes de merge/publicação.

## Retomada autorizada — 04/11/2026, 14:02 America/Sao_Paulo

Usuário solicitou expressamente corrigir a diferença visual da página inicial
para liberar PR490, publicar e testar Chrome, integrado e celular simulado.
Esse comportamento agora integra o escopo; o diagnóstico deve provar a causa
dos10px antes de alterar produto ou referência. Demais páginas preservadas.
Git comum confirmado, checkout limpo antes da integração do registro491;
PR490 aberto no head2bb866f4, CI41853820787 concluída com falha apenas na
comparação visual /app; validate, imagem e restore aprovados. Mainad3fc34e
documental foi integrado localmente preservando ambas as notas históricas.
Health público às17:02:51UTC:200/ok,c97d5fd2, ainda sem novas funções.
Fontes atuais: Git/GitHub e /api/health. Registro/Obsidian consultados por assunto;
diagnóstico e publicação continuam dependentes de nova CI exata após correção.

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

Causa atual comprovada por metadados do lote automático14:30:31 instâncias
Success,16 folhas completas/contíguas, filtros e colunas idênticos. Root14:30:08
contou20645; folhas concluídas14:32:22 somaram20646. RamoJan–Jun13253 manteve
contagem; ramoJun–Nov7393 difere por1 do implícito7392. Guard final rejeitou
corretamente SALESFORCE_INVALID_REPORT. Não era agenda, login ou novo OOM.
Listagem/results emRAM foram necessárias para extrair somente contagens;
includeDetails=false no GET não remove rows quando a instância original contém
detalhes. Linhas/células não foram inspecionadas ou persistidas; somente
metadados sanitizados em test-results/collector-instance-counts.ndjson.

Correção mínima em report-collection.mjs: erro privado derivado mantém código
público existente e é emitido somente pelo compare final de contagem. Wrapper
permite no máximo duas gerações completas, captura só esse erro e não guarda
rows descartadas. Cada tentativa refaz describe/root/folhas. Guard de outros
erros, abort, lock e publicação preservados; orçamento25min é único e timeout
por instância não aumenta. Falha na segunda tentativa continua rejeitando.

41/41 testes Node24.19 aprovados na suíte integral de coleta e scheduler:
primeira divergência seguida de geração coerente usa apenas a segunda;
duas divergências rejeitam; erro diferente não repete; cancelamento impede
tentativa nova; prazo compartilhado expira sem reiniciar após24min na primeira.
Lint, Prettier e diffcheck aprovados. Nova CI obrigatória antes de aplicação.

Confronto transitivo do coletor instalado322a4166:18 arquivos runtime,
zero imports sem resolver. Diferenças atuais limitadas a scheduler/logging,
report-collection/retry e transform histórico. Este último só muda diagnóstico
interno de metas ausentes; paridade de payload comprovada4/4 cenários sintéticos
com analysisEnabledfalse/true e goalsundefined/null, conforme uso do coletor.
Playwright1.62.1 eZod4.6.7 iguais. Pacotes adicionais não são importados nessa
árvore. Código novo ainda não aplicado ao serviço.

Conferência final de acessibilidade do novo popup reproduziu uma falha na
abertura explícita: Enter abria o portal, mas foco permanecia no botão fora
dele. Corrigido pedido de foco apenas nessa abertura; hover não rouba foco e
troca do dia não o retira do select. Escape/fechamento devolvem ao acionador.
Browser dedicado com componente real production, teclado e toque2/2 aprovado,
unitário9/9 e lint/format/diffcheck aprovados. Baseline da falha e resultado
em test-results/appointments-daily-team-focus/result-before.json/result-after.json.
A matriz9/9 anterior permanece evidência dos comportamentos inalterados;
os fluxos de foco afetados foram reexecutados isoladamente, sem repetir nove
combinações. Nova CI do SHA resultante é obrigatória.

Helper operacional específico preparado localmente, sem executar na VPS:
test-results/update-salesforce-collector-20261104.mjs,
sha2567d3c63fca78222404fc5fda53c3d9a94147dbd531dfa0ed558704a29f2691955.
Sintaxe e11 asserts isolados aprovados, sem acesso ao sistema/serviços.
Exige parâmetros do main/CI exatos e app já publicado, backup/CAS/installation.lock,
preserva demais configurações e verifica precedência/WorkingDirectory efetivo.
Operação Linux e dois ciclos posteriores continuam pendentes, não alegados.

## Encerramento da publicação do PR #490 — 04/11/2026

Estado histórico acima preservado. O usuário autorizou expressamente corrigir
a diferença da página inicial. Causa comprovada: empate de especificidade entre
`.filters p` e `.report p`; ordem dos módulos alternava margem10px/zero.
Classe própria e seletor específico estabilizam os dois avisos, preservando
valor e baseline. Componentes/CSS reais passaram 12/12 casos, três temas e
320/390/768/1440px, nas duas ordens de CSS, sem overflow ou consultas externas.

PR #490 integrado: candidato892ffb4ad101d68759e34815f4e019aad0da53b5,
CI41875106244; main 5da469643c2ac12d5f0582e30348f9fda7c8733f,
CI41882885306. Quatro gates aprovados em ambos os SHAs, incluindo matriz visual
completa; nenhuma referência visual alterada. Fontes:
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/490 e
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41882885306.

Aplicação publicada pelo release:production em2026-11-04T18:57:29.099Z
(15:57:29.099 America/Sao_Paulo), deployment302cbc32-6472-472d-9903-fb8ecf52042b,
com consulta ao vivo, locks/CAS, backup e ledger sem pendência. Anteriorc97d5fd2
preservado para rollback. Artefato13349114816, ZIP SHA256
684aa8422fff962bfff347441087f6dd7b652358d184211bb9ead4f2dc08f6c5;
arquivo de imagem3fd139175dbc64b8eeceda3cc5b5ab35dccf47f47e3433d42d64be30cb37bb12.
Imagem/manifest local5e272fb363892d62482612354366432a908a7da7eba3054f92b9977a8824d40d,
config3c48545b75aa32810d2de310bd95a37c6343a4ec1ea4769db07f910c64bf117b;
14 camadas, plataforma e identidade OCI comprovadas, sem rebuild/retag.
image:prove aprovado nos dois perfis. Health público18:58:10Z HTTP200/ok,
versão5da46964; acesso anônimo Agendamentos307 para login. Sem migration.

Coletor atualizado19:07:33Z pelo helper revisado de SHA256
7d3c63fca78222404fc5fda53c3d9a94147dbd531dfa0ed558704a29f2691955,
após CI main e app publicado. Árvore transitiva18 arquivos conferida, sandbox,
flags, memória, credenciais e agenda preservados. Drop-in específico altera
somente WorkingDirectory para a release5da46964. Backup operacional privado:
/var/lib/descomplica-salesforce-collector-install/appointments-consistent-retry-20261104-Ot9XNx.
Dependências da nova release precisaram de cópia com novos inodes: conteúdo e
symlinks idênticos, cache compartilhado inalterado, acesso apenas root/grupo do
serviço. Troca atômica e Git limpo; backup da árvore anterior em
/srv/descomplica-crm-releases/.collector-deps-5da46964-20261104-2yysowyt/node_modules.

Primeiro ciclo19:17 falhou com PostgreSQL57014/statement_timeout no validador
base, preservando a última carga válida. Diagnóstico somente leitura confirmou
limite8s do authenticator; não alterados SQL, funções, roles, ACL, timeouts ou
n8n. Investigação sintética isolada não comprovou ganho na troca do predicado;
otimização descartada, sem mudança no produto. Retentativa agendada19:30
publicou comercial201 às19:39:27.883Z, requestIdedee4ab1-67ec-4c04-8e66-53c23fdc9104,
e estoque3498itens às19:40:02.816Z. RPC origin7315ms, margem pequena ao limite:
recorrência57014 exige reavaliar a evidência e preparar correção delimitada,
com autorização específica antes de qualquer migration remota.

Testes reais da versão publicada preservaram32 cards: Chrome→integrado,
integrado estreito→Chrome, paisagem→retrato com reload, saída/retorno pelo
Dashboard e atualização completa. Movimento/redimensionamento realizados pelos
controles reais de teclado; editor restaurou cada tamanho com um único Salvar.
Não alegado arraste nativo ou aparelho físico. Card194x194 e gráfico1205x500
restaurados, ordem inteira igual à abertura. Limite das torres128 px medido128 px,
persistiu nos dois navegadores sem mudar o card; restaurado automático e
confirmado por reload completo em ambos. Nenhuma cópia temporária criada.

Viewport390x844 e844x390 no Chrome e integrado: modelo persistido idêntico,
sem overflow horizontal da página. Integrado também1280x900. Comparação com
quatro séries, média inteira, trimestre julho/agosto/setembro, tooltip numérico22,
dias com três letras e explicação do feriado12/10 conferidos. Popup diário
tem foco/retorno/Escape corretos e cabe em390x844 com rolagem interna.
Dados novos16:36:34 corretores, outubro 884=26 × 34; popup29/10 com7 + 27 pessoas.
Contagens são retratos da carga, não constantes do cálculo. Tabelas de outubro
com136 detalhes/84 vencidos, sem paginação; rankings e tabelas alcançam o último
resultado pela rolagem interna. Capturas reais e modelos de comparação somente
em test-results/appointments-trimestre-live, ignorado pelo Git, sem exportar
dados pessoais ao registro ou Obsidian.

Refresh automático comprovado na aba Equipe Produtiva montada desde18:59:38Z,
sem reload, navegação ou mudança de filtros: aviso15:33 às19:01:23Z passou
para16:36 às20:00:21Z, visibilidade visible. Primeiro intervalo precedeu a carga
nova; intervalo seguinte a mostrou. Evidência local refresh-result.json e
produtiva-atualizacao-automatica-final.jpg. Reload final Chrome/integrado:
32 modelos de dimensões/ordem iguais à abertura, layouts-final-restaurados.json.
Capturas finais reais: chrome-pagina-inicial-final.jpg,
chrome-comparativo-final.jpg, integrado-comparativo-final.jpg,
integrado-meta-calendario-final.jpg, celular-equipe-dia-final.jpg e
celular-grafico-final.jpg. Teste móvel usa viewport simulado, não aparelho físico;
gráfico mantém rolagem interna para dias adicionais. Overrides restaurados,
duas abas intermediárias próprias fechadas, abas de Agendamentos preservadas.

O ciclo seguinte iniciou20:00:11.064Z, coletou os sete relatórios até20:03:34Z
e escreveu candidato20:06:52.301Z; publicação falhou20:07:12.793Z. Metadados
PostgreSQL20:07:11.732Z confirmaram57014/statement_timeout, não user_cancel,
agora emv3_base23→validator47→ingest21. RPC500/origin10637ms, CRM503 e n8n502.
Mudança da posição da interrupção reforça orçamento total esgotado, sem provar
um predicado isolado como causa. Último snapshot válido19:39 preservado; estoque
deste ciclo não publicado. PID2485058/restarts0; pico799813632 de805306368bytes,
semOOM e com margem pequena. Não houve alteração de memória ou limite global.
Dependências isoladas: digestf87bb9a908fd4cb47c1d1ae95f2024d8f17f7c57da7a5faba3705e2ce828d84a.

Resultado separado: aplicação publicada e interface/persistência aprovadas;
regularidade da fonte ainda bloqueada pela recorrência do timeout. Preparação
de correção restrita à RPC em andamento, com testes PostgreSQL17/PostgREST
isolados. Nenhuma migration remota autorizada ou aplicada nesta retomada.
Pendentes: CI/proposta concreta, autorização específica para aplicação remota,
dois ciclos completos consecutivos após correção e sincronização final.

### Proposta delimitada após recorrência

Migration20261104201024_salesforce_ingest_bounded_timeout.sql contém somente
ALTER FUNCTION para statement_timeout30s e recarga do schema PostgREST. Corpo
produtivo confirmado por MCP somente leitura: md548bcdeb5d43781cc7499b0a20e42d2fd,
ownerpostgres, SECURITY DEFINERtrue, search_path vazio e ACL somente postgres e
service_role. Configuração anterior não tinha override. Estado não alterado.

Três testes Node, lint, sintaxe e formatação aprovados no worktree isolado.
CI executa nove asserts pgTAP e prova REST PostgreSQL17 após migrations:
role artificial própria8s, sem alterar configurações de roles existentes;
espera9s sem override cancela57014, com override30s conclui; espera31s cancela;
cinco chamadas posteriores mostram8s; anon/auth sem execução, inclusive RPC
real; catálogo e configurações preservados, limpeza finally. Tempos registrados,
sem ceilings estreitos; cliente HTTP45s e redirects recusados. Não garante
reutilizar a mesma conexão do pool. Docker local ausente: banco depende da CI.

Helper operacional ignorado test-results/hold-ingest-migration-lock.mjs não
executa SQL. Valida CI/main exatos e app atual, mantém as três travas existentes,
exige snapshot compatível com CAS, grava backup privado com fsync/hash e compara
metadados posteriores. Onze testes locais de guards aprovados; SHA256
1b27ee802cef2be24975082831dda4be80c6574bd11563c4b8b4ed2e9aad0d25.
Uso remoto, migration e comprovação de ciclos continuam pendentes de gates e
autorização específica. Nenhum timeout global ou controle de acesso afrouxado.

PR493, primeiro candidato83b27b40: CI41905313680 interrompida no validate pelos
inventários dependentes da migration nova. Total passou103→104 migrations e
2436→2445 asserts pgTAP em49arquivos; allowlist de homologação também exigiu
entrada explícita. Correção delimitada desses inventários, preservando suas
asserções e os gates. REST/banco ainda não haviam sido executados nessa rodada.

### Retomada após publicação concorrente

Usuário autorizou expressamente a migration20261104201024 do PR493 somente
após todos os gates do PR e do main verdes. Não pedir essa autorização novamente
para o mesmo arquivo e condições. Ainda não aplicada nesta conferência.

Janela de integração da CAIXA respeitada, sem merges concorrentes ou mudanças
nessa página. Liberação recebida; conferência05/11 às00:02:28–33UTC
(04/11 às21:02 America/Sao_Paulo): origin/main e health HTTP200/ok em
fa068c439eacdd70f0c6d8cfc9bcba5394e1ef43. PR492 integrado22:20:53Z;
publicação informada23:55:41Z, deployment e349e769-a543-44ee-b60e-71196de356da,
CI main41924476763. Health confrontado ao vivo, sem confundir com a aplicação
anterior5da46964. AGENTS, contexto, ferramentas e regra de eficiência não mudaram.

PR493/candidato4eab64ee: CI41906251839 concluiu os quatro gates com sucesso,
incluindo prova REST delimitada e banco. Main avançou durante a espera;
conflitos de registro exigem integrar a base atual e nova CI do candidato,
preservando integralmente a CAIXA publicada. Helper operacional ainda não
executado: precondições serão atualizadas para a publicação real e novamente
conferidas sob trava, sem reutilizar identidade de deployment antiga.

Registro documental CAIXA do PR494 avançou main para e594bf70 enquanto a CI
316ca898 estava em andamento. Somente CHANGELOG, WORKLOG e índice de conhecimento
mudaram; runtime continuoufa068c43. Dois conflitos documentais resolvidos sem
alterar o registro financeiro da outra entrega. Novas entradas próprias foram
posicionadas junto do histórico de Agendamentos, para evitar colisões com novas
entradas de outras entregas no topo. Nova CI obrigatória; autorização da mesma
migration permanece válida, condicionada aos gates. Sem aplicação remota ainda.

### 04/11/2026 23:47 BRT — PR493 aplicado; recuperação do coletor aguarda autorização

Conferência de encerramento parcial em 05/11/2026 02:47 UTC. PR493 integrado
em b6dc189aba1d8070cbd7a8c7dc5d02fc6f6a80ef; CI do candidato41940957864 e do
main41947685242 concluíram os quatro gates obrigatórios com sucesso. O run
41947984319 pertence ao Dependabot dinâmico, não a esses gates; nenhuma
atualização de dependência ou mudança da CAIXA foi incluída.

A migration local20261104201024 foi aplicada uma vez via MCP, após a autorização
do usuário e os gates, com backup privado e comparação de identidade sob trava.
Histórico remoto:20261105021909, salesforce_ingest_bounded_timeout. Verificação
às02:19:25UTC confirmou statement_timeout=30s somente na função de ingestão;
corpo MD5 48bcdeb5d43781cc7499b0a20e42d2fd, owner, ACL, SECURITY DEFINER e
limites de roles/banco preservados. Backup:
/etc/descomplica-crm/config-backups/salesforce-ingest-timeout-59dlnk.
Esta operação não reiniciou aplicação nem coletor.

Os testes visuais e de persistência já registrados passaram; os 32 cards foram
restaurados e conferidos nos dois navegadores. As edições normais do usuário
foram liberadas: novas conferências devem ser somente leitura, sem sobrescrever
seus ajustes. Prints reais permanecem em test-results/appointments-trimestre-live.
Celular significa viewport simulado; não foi teste em aparelho físico.

Bloqueio operacional independente: o Node do coletor foi encerrado por falta de
memória às01:36:21UTC, sob limite768MiB, deixando uma trava pertencente ao PID
morto3300874. O processo reiniciado3384957 não consegue exportar enquanto a
trava existir. Não há prova de vazamento de memória; não atribuir autor ao
reinício de serviços anterior sem auditoria. O runbook do coletor proíbe limpar
locks automaticamente após encerramento forçado.

Recuperação proposta e verificada somente em leitura às02:37:19.902UTC:
backup protegido, parada apenas do coletor, quarentena atômica da trava morta
com CAS e elevação somente de MemoryMax para1,5GiB, mantendo as demais337
propriedades estáveis. Host disponível11.656.257.536bytes. Helper ignorado
recover-salesforce-collector-oom-20261105.mjs SHA256
f713e7592622a874d14da5f5adcc7e5f5a0796888e61e2cd836d651577bf733e:
39 testes locais, sintaxe, lint e formatação aprovados; plano remoto não alterou
serviços. A autorização específica foi solicitada e continua pendente nesta
conferência. Não executar --apply, mover a trava ou mudar memória sem a resposta.

Restam, após aprovação: aplicar o plano sob quatro travas e gates atuais,
observar duas cargas automáticas completas, medir pico de memória/reinícios,
conferir dados atuais em leitura, publicar um registro documental consolidado
e sincronizar novamente. Reavaliar se houver novo OOM, aproximação do limite,
crescimento entre ciclos, mudança de SHA/deployment ou falha de guarda; não
prometer ausência permanente de vazamento. A entrega completa permanece aberta.
Fontes: GitHub PR493/runs citados, catálogo do banco via MCP, health e ledger
observacionais, diagnóstico systemd/kernel e plano somente leitura da VPS.

### 04/11/2026 23:54 BRT — Recuperação autorizada e serviço retomado

O usuário autorizou expressamente o plano de recuperação apresentado: parada
somente do coletor, backup/quarentena da trava morta e MemoryMax de768MiB para
1,5GiB. A autorização da migration não foi reutilizada para essa operação.

Aplicação inicial preservou a trava e instalou somente o drop-in96 solicitado,
mas bloqueou antes do start por ordem de serialização de After. Diagnóstico em
leitura provou os mesmos11 itens, sem diferença em arquivos/credenciais ou
configuração efetiva. Também bloqueou o rollback automático; o serviço ficou
inativo até a retomada protegida. Corrigida somente a comparação da ordem dos
tokens de After, preservando todos, inclusive duplicados. Helper final SHA256
5f3985cf0fc0027872db254227bd15e3f3094279db4f663ad3b3a2aa75f7179d;
44 testes, sintaxe e lint aprovados. Sem relaxar outras propriedades.

Plano de retomada somente leitura aprovado02:53:32.907UTC. --resume-apply sob
quatro travas, CI/main/app/health recentes e CAS concluiu às02:53:55.200UTC:
PID3564057, NRestarts0, MemoryMax1610612736 confirmado no cgroup, estabilidade8s,
mesmos argv/runtime/proteções e serviços preservados. Backup privado protegido:
/var/lib/descomplica-salesforce-collector-install/collector-oom-20261105-rS4Z30.
Trava antiga em quarentena; não restaurada. Sem restaurar dados, credenciais,
candidate, snapshots ou ledger. Nenhuma exportação manual foi disparada.

Ciclo automático de startup iniciou02:53:47.908UTC. Observação somente leitura
em test-results/collector-after-oom-recovery-20261105.ndjson; aguarda dois ciclos
completos distintos comercial+estoque, sem sobreposição ou reinício. O primeiro
ciclo de startup é automático; o próximo será a fronteira00/30 posterior ao
seu término. Não afirmar intervalo de30min entre startup e próximo slot.

Chrome reconectado como browser4, na mesma aba do usuário. Comparação renderizada
em leitura confirmou32 IDs/ordem/largura/altura iguais ao integrado; nenhuma
personalização foi gravada. Integrado novo viewport1280x900: sem overflow de
página e fonte anterior22:04. Capturas finais adicionais aguardam a carga nova.

### 05/11/2026 00:06 BRT — Primeiro ciclo e reconferência real dos navegadores

Primeiro ciclo automático completo após recuperação: comercial HTTP201 às
03:00:36.137UTC, requestId c8db5e48-a4ed-4e05-bcf5-c175ad143e81;
estoque confirmado03:01:07.760UTC, generatedAt03:01:07.335UTC,3494unidades.
Agenda real calculou1733s para03:30UTC/00:30BRT. PID3564057/NRestarts0;
pico1206206464bytes, aproximadamente1,12GiB, acima do antigo768MiB e abaixo
do novo1,5GiB. Um ciclo não comprova estabilidade de longo prazo; segundo
ciclo automático ainda aguardado, sem disparo manual.

Após reload, Chrome e integrado exibiram Atualizado em04/11/26,23:57 e17
agendamentos de novembro, antes11 na aba integrada antiga. Comparação em leitura
confirmou os mesmos32 IDs, ordem e tamanhos nos dois navegadores e após reload.
Integrado1280x900 e celular simulado390x844/844x390: sem overflow horizontal do
documento; rotação, reload em paisagem e retorno ao retrato preservaram o modelo
integral. Gráfico salvo1205x500 permaneceu1205x500 no modelo e ajustou largura
visível para314,65625px no celular. Nenhum perfil/card foi gravado nesta retomada.
Filtro mensal continuou editável; reload abriu novembro vigente. Outubro foi
selecionado apenas nas abas temporárias para capturar quatro séries, incluindo
trimestre calendário julho/agosto/setembro e feriado12/10.

Prints reais adicionais inspecionados em test-results/appointments-trimestre-live:
chrome-recuperacao-final.jpg, integrado-recuperacao-final.jpg,
integrado-comparativo-recuperacao-final.jpg, celular-recuperacao-final.jpg e
celular-grafico-recuperacao-final.jpg. Captura longa do Chrome excedeu5s;
substituída por captura visível em aba própria, sem repetir a captura longa.
Chrome reconectado por extensão identificada no inventário; sem nova conta ou
mudança de permissões. Abas temporárias fechadas e override de viewport removido;
abas originais Chrome/integrado mantidas. Não repetir logout nem restaurar layouts
sobre edições normais do usuário. Fotografias anteriores dos testes completos
continuam válidas; esta reconferência mede a fonte nova sem refazer toda a matriz.

### 05/11/2026 00:39 BRT — Aceite final da fonte e da entrega

O observador encerrou com exit0 às03:39:26UTC. Dois ciclos automáticos
consecutivos completos, sem falhas desde a retomada02:53:

| Ciclo                         | Publicação comercial                                                    | Publicação de estoque                                              |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Startup automático02:53:47UTC | HTTP201,03:00:36.137UTC; requestId c8db5e48-a4ed-4e05-bcf5-c175ad143e81 | Confirmada03:01:07.760UTC; generatedAt03:01:07.335UTC;3494unidades |
| Agenda03:30:04.156UTC         | HTTP201,03:38:57.291UTC; requestId95d8c7ac-bede-4768-86e2-65c9aed06ede  | Confirmada03:39:24.278UTC; generatedAt03:39:23.967UTC;3494unidades |

PID3564057, NRestarts0, active/running e runtime5da46964 preservados. Lock de
exportação livre. Memória atual1205510144bytes; pico cumulativo1215733760bytes
(aproximadamente1,13GiB); limite1610612736bytes, folga400878976bytes. A observação
comprova esses dois ciclos, não ausência permanente de vazamento ou capacidade
para todo crescimento futuro. Reavaliar diante de novo OOM, aproximação do
limite ou aumento persistente dos picos; não elevar novamente sem nova análise
e autorização. Atualização futura do coletor deve conferir os overrides
90/95/96 existentes, preservar as proteções e respeitar os bloqueios do instalador.
Não restaurar a trava do processo morto nem sobrescrever dados/ledgers no rollback.

Fonte de evidência operacional: journal/systemd/lock, somente leitura, arquivo
ignorado test-results/collector-after-oom-recovery-20261105.ndjson. Não houve
exportação manual, carga sintética na VPS, mudança de n8n, permissão, credencial,
conta ou outra página. O aplicativo e o Chrome não foram reiniciados na recuperação.
A migration, a recuperação e o registro são operações distintas, cada uma com
suas evidências e autorizações; o parâmetro SQL permanece30s somente na RPC.

Conferência03:39:54UTC: origin/main b6dc189aba1d8070cbd7a8c7dc5d02fc6f6a80ef;
GET público de health HTTP200/ok com versãofa068c439eacdd70f0c6d8cfc9bcba5394e1ef43.
Main contém a migration e a aplicação servida contém a entrega490; não apresentar
b6 como imagem publicada. O encerramento corrente é somente documental, sem
novo deploy ou reinício. Os resultados funcionais solicitados e os dois ciclos
estão concluídos; publicação do registro segue o próprio PR documental e sua CI,
sem criar ciclos recursivos de documentação.

Fontes verificadas:

- [PR490 publicado](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/490).
- [PR493 integrado](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/493),
  [CI do candidato](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41940957864)
  e [CI do main exato](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41947685242):
  quatro gates aprovados em cada SHA, incluindo prova REST PostgreSQL17 e pgTAP.
- Histórico de migrations e metadados da função via MCP; backup privado e CAS
  antes/depois, sem copiar dados de clientes ou credenciais para este registro.
- [Health público](https://crm.descomplicapro.com.br/api/health), consultado na
  data acima; saúde não substitui identidade de versão nem provas funcionais.
- Capturas reais e comparação de DOM renderizado no Chrome/integrado, com
  viewport móvel simulado. Controle real usado para alterar layout nos testes
  anteriores: teclado acessível; não alegar arraste nativo por ponteiro nem
  aparelho físico. Demais evidências pertinentes da mesma versão foram
  reaproveitadas, sem novo teste global ou mudança de baseline.

### 05/11/2026 01:06 BRT — Abertura da prova de atualização automática nas três visualizações

Pedido adicional: observar Agendamentos no Chrome, integrado e celular simulado,
sem reload ou atualização manual, e registrar antes/depois em prints reais.
Git comum correto, HEAD/main e05846e965bb1e8744ae279ab73420f8bba62b8c, árvore limpa
na abertura. Health04:04:39UTC HTTP200/ok emfa068c43. CI main41963408120 já
aprovada na entrega anterior, reconferida em leitura; nenhum código será alterado
apenas para executar o teste.

Contrato atual conferido no DashboardAutoRefresh.tsx: consulta autenticada de
versão a cada30segundos enquanto a página está visível, atualização automática
quando o snapshot persistido muda e verificação ao voltar a foco/visibilidade.
A origem produz cargas nos slots00/30; esse contrato não significa reload do
documento a cada30min. Não alterar temporizadores, cookies, estado interno,
perfis, contas ou dados para simular aprovação. Critério: versões/horários novos
renderizados nas três visualizações após duas cargas reais consecutivas, com
zero comando de reload depois da montagem inicial; registrar quando uma aba
estiver oculta e a atualização ocorrer automaticamente ao voltar à visualização.
Celular é viewport simulado, não aparelho físico. Evidência e resultado pendentes.

### 05/11/2026 01:13 BRT — Regressão reproduzida e correção delimitada preparada

Primeiro ciclo observado nesta prova: startup agendado04:00:03.960UTC;
comercial HTTP20104:06:32.965UTC, requestIdbaf855fa-e62d-4b91-9af6-2606c4e3ee07;
estoque3494 confirmado04:06:59.833UTC, generatedAt04:06:59.544UTC. PID3564057,
zero reinícios; a fonte continuou funcional.

Três abas próprias de Agendamentos foram montadas04:06UTC com Atualizado em
05/11/26,00:35: Chrome1280x551, integrado1280x900 e celular simulado390x844.
Todas document.visibilityState=visible,32cards, sem reload/navegação/filtro após
montagem. Em04:07:35.952UTC, mais de60s após a publicação comercial, todas ainda
mostravam00:35. Uma quarta aba de controle, aberta apenas para confrontar a
versão persistida, mostrou01:03 às04:08:14.981UTC. Ela não integra a prova de
atualização das três abas antigas. Essa comparação comprova falha de atualização
na tela, não falha da origem nem sucesso por abertura de página nova.

Causa confirmada: DashboardAutoRefresh era montado apenas por DashboardReport;
a página dinâmica de etapas retorna um AppointmentsDashboard próprio antes desse
relatório. Portanto a validação anterior de30min em Equipe Produtiva não cobria
Agendamentos. Persistência de layouts e recebimento de duas cargas da origem
continuam comprovados, mas não substituem esta prova de tela aberta.

Correção preparada: endpoint opcional de DashboardAutoRefresh, com default
Dashboard preservado; montagem explícita no ramo próprio de Agendamentos;
par generatedAt/updatedAt obtido do mesmo header confirmado por CAS, sem query
adicional ou conversão de precisão; GET /api/appointments/status somente de
metadados, autorizado por crm.stage.appointments.view antes de acesso ao banco.
Não apontar usuários somente Agendamentos ao endpoint geral, que exige
crm.dashboard.view. RLS existente já permite o header à etapa autorizada;
sem migration, alteração de grant ou autorização remota adicional.

Retornos de análise vazia/RPC ausente preservam o par conhecido para evitar
refresh recorrente provocado por null/null contra snapshot existente. Snapshot
realmente ausente continua null/null. Erro de leitura não anuncia versão nova;
endpoint retorna503 e no-store. Permissões, metas, roster, CAS, layout e filtros
permanecem na camada existente. Guia Next instalado confirma que router.refresh
mescla a resposta RSC preservando estado de cliente e posição de rolagem; não
usar reload completo nem temporizador artificial para simular aprovação.

61 testes focados aprovados:26 cliente/SSR e35 API/reader; lint focado,
formatação e resources:check aprovados. Inventário:93rotas/11áreas. Revisão
independente em andamento; CI completa do candidato e do main continuam
obrigatórias antes de publicação. Prova pós-publicação deve começar em páginas
novas carregando a versão corrigida e permanecer sem reload manual nas três
visualizações. Não reutilizar as abas da regressão como se contivessem código
novo, nem apresentar capturas da aba de controle como aprovação automática.

Evidências locais ignoradas: auto-refresh-observacoes.json e prints
auto-refresh-chrome-antes.jpg, auto-refresh-integrado-antes.jpg,
auto-refresh-celular-antes.jpg, auto-refresh-controle-fonte-nova.jpg em
test-results/appointments-trimestre-live; recibos da origem em
test-results/collector-auto-refresh-three-views-20261105.ndjson.

Dependência adicional comprovada do listener: o teste isolado
appointments-initial-detail renderizava a página sem AppRouterContext. Falhou
com invariant expected app router to be mounted após o componente real passar
a montar useRouter. O teste recebeu o provider real com router de fixture;
todas as asserções sobre mês fora da cobertura, detalhe indisponível e ausência
de zeros fabricados foram preservadas e passaram. Não foi trocado por stub de
DashboardAutoRefresh, skip ou baseline nova. Os12 testes de dashboard-access
já possuíam ambiente de roteador e passaram sem mudança. Total local focado:
74 testes distintos aprovados. Essa é uma dependência da correção, não alteração
da página Dashboard ou de suas regras de acesso.
