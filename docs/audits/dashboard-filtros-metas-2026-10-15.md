# Dashboard: filtros, meses fechados e metas

## Escopo e autoridade

Em16/10/2026 o usuario autorizou explicitamente coordenar tambem a atualizacao
aditiva do catalogo de paginas, preservando os acessos existentes. Isso resolve
a pendencia de autorizacao registrada anteriormente, sem dispensar os gates.
Conferencia10:55Z: main2eae903, PR238/2234298 aberto; health200/ok/b5458ff;
deployment e42363ec-0f81-4084-9ced-aa405c263b09, concluido03:59:23.023Z,
sem pendencia. CI38858636662: validate/restore verdes, release-gates cancelado
ao atingir o limite global; repeticao iniciada. Fonte: Git/gh, health anonimo,
coordenador status e metadados MCP Supabase.

Backup delimitado anterior ao catalogo:
`/srv/descomplica-backups/dashboard-catalog-20261016-BdFdKs/before.json`,
44313 bytes, SHA-256
`61092986a34a54dcd280b559da68727deeb0d37c9362b2b5f6af6b406625d627`.
Diretorio root0700, arquivo root0600, gravacao exclusiva/fsync e releitura
conferida; copia transitoria local removida. Contem configuracao de acesso,
rotinas, policies, ACL e historico, sem dados comerciais. O round-trip do
arquivo nao equivale a ensaio de restauracao SQL. Antes de cada mutacao,
revalidar o estado e abortar se houver divergencia administrativa concorrente.
Quatro RPCs de Rotina existem com owner postgres, EXECUTE authenticated e
sem EXECUTE anon/service_role; ingestao permanece exclusiva service_role.
Producao ainda tem17 paginas/25 permissoes e nenhuma tabela de analise.

Pedido de15/10/2026: filtros pelas colunas exportadas, meses integralmente
fechados com detalhes, metas por responsavel unico dos relatorios filtrados
e comparativos transpostos. O usuario autorizou explicitamente a atualizacao
aditiva do banco e coletor depois dos testes. A referencia externa permanece
somente leitura. Contrato e regras em [filtros dimensionais](../dashboard-dimensional-filters.md).

Branch `codex/dashboard-filtros-metas`, PR238:
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/238.
Main17ab106 integrado, incluindo alteracoes concorrentes de usuarios e Qlik.
Nenhuma permissao Qlik ou workflow n8n foi alterado.

Merge posterior4fa4c5d incorporou mainb9377a1 e sua integracao Qlik v2, sem
sobrescrever referencias do ranking. Inventario combinado56 migrations/1883
assercoes pgTAP. Revisao independente dos conflitos nao encontrou regressao.
Em03:27Z, mainb5458ff trouxe PR231. Merge estruturado do manifesto preservou
11 entradas de dashboard e231 da main, inclusive novas telas de planejamento.
Hashes das242 imagens conferidos;66 testes locais focais passaram. Essa
composicao requer CI completa; o resultado anterior nao valida o novo merge.

## Validacao

- CI38845696585/2014576: validate passou, QA sintetico falhou ao abrir o
  segundo historico. Reproducao local deterministica confirmou foco roubado
  pelo onClose atrasado, apos o fechamento nativo ja restaurar o foco.
  Callback redundante removido; teste regressivo falhou antes/passou depois.
  Quatro testes Node com Chromium passaram, incluindo foco/teclado/filtros.
- Merge4fa4c5d: pnpm lint, typecheck, test e build locais aprovados. Vitest3547
  aprovados/90 ignorados; Node1181 aprovados/19 ignorados; release703 aprovados/
  14 ignorados. Skips de plataforma continuam exigindo CI Linux. Lint sem erros,
  tres avisos: connected-systems preexistente e dois helpers locais ignorados.
  33 testes focais de inventario/paridade aprovados. CI38841091143 em andamento.
- Local: lint, tipos, build e formatacao aprovados; suites focadas e185 checks
  sinteticos de dashboard nos tres temas. Capturas incluem celular, desktop,
  filtros, metas e pop-ups. Dados sinteticos nao comprovam coleta real.
- Suite Windows:3245 aprovados/88 ignorados, dois erros iniciais. Expectativa
  de texto removido corrigida; erro de symlink por O_NOFOLLOW exige Linux.
- CI38831855601/ac6e193: validate aprovado,3247 testes Vitest aprovados/88
  ignorados;658 testes Node aprovados/1 ignorado e544 do coordenador de release.
  QA dashboard185 aprovada. PgTAP interrompido por literal sem tipo na fixture.
- CI38832697093/fe728f3: literal corrigido;165 assertions da nova fixture
  passaram antes de um grant de teste proibido pelo trigger existente.
  Erro confirmado no log:23505/global commercial allow requires scoped v3
  read models. Nao alterar a regra do produto para satisfazer a fixture.
- Commit3f05de8 usa grant existente de manager_house e testa revogacao com
  deny. Resets de JWT isolam a preparacao de cada cenario. Revisao independente
  confirmou contagem188 e compatibilidade estatica dos overrides posteriores.
- CI38834121342/3f05de8: validate e isolated-restore aprovados. Release-gates
  passou dashboard185, banco, autorizacao compacta/presenca, advisors e build;
  navegador e matriz visual ainda em andamento na consulta01:31Z de16/10.
  Essa execucao ainda nao constitui CI completa nem autoriza publicacao.
- Conclusao da mesma CI: E2E falhou na expectativa de link de canal/periodo
  da raiz, removido expressamente pelo pedido. Atualizacao do teste verifica
  quatro filtros gerenciais, tres historicos, tabela transposta e ausencia dos
  links antigos; preserva selecao legada nas etapas e ranking. Matriz visual
  nao executou nessa rodada. Exigir nova CI, sem ignorar ou reduzir o gate.
- Seletores novos executados localmente com Playwright na preview sintetica:
  dois casos passaram, incluindo cabecalhos e linha Realizado. Typecheck passou.
  Essa prova de DOM nao substitui autenticacao, servidor e RLS da proxima CI.
- CI38836371948/270ccb3: validate, restore, banco e build passaram; E2E12
  aprovados,1 falho,7 nao executados. O cenario sem snapshot omite o atributo
  opcional data-dashboard-source; o seletor novo nao encontrava o painel.
  Corrigido para landmark main, mantendo contagens, rotulos e tabelas. Nenhuma
  alteracao de produto ou reducao de assertions. Nova CI completa necessaria.
- Reteste Playwright local: quatro casos, com e sem snapshot e entradas month/
  week, aprovados com os seletores finais. Prova sintetica, nao autenticacao.
- CI38838263880/01cea33: validate, restore, banco e E2E autenticado aprovados.
  Matriz interrompida no helper dashboard-auto-refresh, que ainda exigia link
  de periodo removido. Artefato12021440037 registra failure.stage correspondente;
  ainda nao ha captura completa elegivel para promover referencias. Helper
  passa a usar selecao canonica de canal; demais assercoes de RSC/estado mantidas.

## Estado remoto e recuperacao preparada

CI38841091143 concluiu gates funcionais, inclusive auto-refresh, banco1883,
restore e E2E. Matriz completa:242 auditorias de acessibilidade aprovadas,
rotas/temas/zoom/teclado aprovados,231 referencias iguais e11 diferencas apenas
em `/app`, compativeis com filtros, historicos e tabelas solicitados. Inspecao
visual incluiu tres temas desktop, tablet e celular. Artefato12022638666:
SHA256 `78e52ce30d8ec5ab03d2789bef1559ed8a7549fee37b4d6316963e977ad3566b`.
Capture5e712c62b0a7972db3359a8389f3d3b78ada7070 tem arvore Git identica ao
HEAD4fa4c5d; fingerprint recomputado confirmou apenas19 arquivos gerados de
connected-systems. Todos os hashes de imagens e baseline foram conferidos.
Promocao delimitada atualizou11 imagens e manteve231 imagens/entradas intactas,
incluindo ranking Qlik. Proveniencia adicionada ao manifesto. A CI original
continua falha por diferenca visual; nova CI verify completa ainda obrigatoria.

Preflight Salesforce GET describe em16/10/2026 02:58:19Z, na sessao dedicada
existente: `Activity.Unidade_de_negocio__c` esta selecionada nos dois relatorios
de atividades e tem rotulo `Unidade de negocio`. Sem alteracao de relatorio,
execucao de export ou saida de registros privados. Confirma coluna, nao carga.

GET anonimo `https://crm.descomplicapro.com.br/api/health` em
2026-10-16T01:23:42.265Z: HTTP200, statusok,
versiond83c22d510478ee089f8c5cb5969a488451d433b. Main, PR e runtime sao
estados distintos. Nenhuma migration, troca de coletor ou deploy desta demanda
foi aplicada ate esta verificacao.

MCP Supabase, projeto hnncxuerlcsaahdxoswb, SELECT de metadados em
2026-10-16T01:25:18.648099Z: tabela de analise, reader e primitiva v2 privada
ainda ausentes. Funcao de ingestao publica com MD5
`6c83740e7eb9c79dc94ef88a829f5822`, ownerpostgres, execute somente postgres e
service_role. Definicao e ACL preservadas em copia privada, sem dados de clientes:

`/srv/descomplica-backups/dashboard-analysis-schema-20261016-A3sNeR/schema-before.json`

- Diretorio root:root0700, arquivo root:root0600,3438 bytes.
- SHA256 `c8bc31e229489ac30e446c22e85c85295bf35b4792f29689cb26833a296c2d2b`.
- Arquivo, diretorio e diretorio pai sincronizados com fsync.
- Trata-se de backup delimitado da funcao e ACL, nao de novo backup integral
  do banco nem de ensaio de recuperacao de dados reais. Backup integral anterior
  e limites constam em [backup privado](../runbooks/crm-backup-storage.md).
- Migration aditiva conserva a funcao v2 no schema private. Recuperacao normal
  do coletor desliga a extensao e preserva o wrapper compativel; nao remover
  dados/tabela/ledger nem restaurar snapshots antigos para simular sucesso.

Coletor observado ativo no checkout0fdbb80aa79d731bcd458ca4bc892ecc76be2918,
sem drop-ins. Atualizacao exige CI completa do main, CRM compativel e o
[procedimento delimitado](../runbooks/salesforce-vps-collector.md), mantendo
ledger inicial, credenciais, agenda, navegador e n8n. Configuracao Nginx atual
do CRM ainda1m; templates preparados elevam somente Salesforce para8m.
Nao aplicar templates sem confrontar hash/conteudo atual e guardar backup.

## Pendencias

### Resultado validado e bloqueio de publicacao

Em16/10/2026 05:54Z, PR238/cb3078f823a4dd8a0ae6fc424703499dd447e33b esta
CLEAN/MERGEABLE. CI38854933173 aprovou validate, release-gates e isolated-restore;
imagem ignorada conforme contrato de PR. Local: lint sem erros, tipos e build
aprovados. Vitest3614/90 skips com dois workers, Node1181/19 skips e release703/14
skips. Execucao local concorrente de Vitest teve dois timeouts e um timeout de
cleanup em Obsidian; repeticao completa com dois workers passou sem aumentar
limites. CI Linux passou normalmente. Logs locais ignorados dashboard-catalog-merge-\*.

Main2eae903175251e720ff22aec247182b764523f09 tem quatro jobs verdes na
CI38853488035, mas producao permanece em b5458ff5eef483d76ee58c9c14129d3872de8291.
GET anonimo05:53:58.936Z retornou200/ok. Coordenador status confirmou:
deploymentIde42363ec-0f81-4084-9ced-aa405c263b09,
deployedAt2026-10-16T03:59:23.023Z, sem pendencia,
imageIdsha256:9823bcf0a1b0306398059d451f35ecc7797d57c8e353a8cfbcb5246b3e635f2a.
Essa consulta nao substitui a verificacao protegida de ate60s no minuto do deploy.

MCP Supabase confirmou17 linhas no catalogo, nenhuma das quatro paginas de
preparacao consultadas e nenhuma das quatro permissoes independentes respectivas.
Historico posterior a20261015195915 contem somente master_all_permission_defaults.
O runbook page-catalog exige preparacao compativel antes da imagem nova. Como
os guards agora dependem exclusivamente do catalogo persistido, promover sem
essa conciliacao pode retirar acessos. Merge/publicacao deste PR ficam retidos
para nao impedir a publicacao pendente da main exata pelo responsavel do PR235.

Revisao read-only encontrou ainda um limite operacional daquela outra entrega:
o trio de ativacao deve ser atomico, mas os arquivos SQL contem BEGIN/COMMIT
proprios. O responsavel precisa validar o executor atomico, sem simplesmente
aplicar os tres arquivos sequencialmente. Nenhuma dessas migrations foi aplicada
por esta tarefa. Usuario consultado sobre aguardar essa entrega ou autorizar
coordenacao aditiva do catalogo; resposta pendente nesta verificacao. Excecao
nao amplia autorizacao nem permite ignorar os gates. Reavaliar com evidencia
de catalogo/runtime conciliados ou autorizacao especifica e novo plano validado.

MCP n8n confirmou workflowL90AYSBEat4vYHLz ativo, cinco nodes, versao
dcffaf09-354c-4a82-817c-5e6ca9da1dd5 identica ao draft, alterado em13/10.
HTTP encaminha $json.payload integral; sucesso depende do recibo/requestId.
SaveManualExecutions/saveExecutionProgress false, dados de sucesso/erro none.
Nenhuma edicao. Consulta de metadados Supabase04:34Z confirmou funcao/ACL iguais
ao backup e extensao ausente. Provas preparadas nao substituem dois ciclos reais.

CI38851076367/f36f9fa terminou verde. Local: lint/tipos/test/build aprovados;
3556 Vitest/1181 operacionais/703 release, skips90/19/14. Dois timeouts Windows
na primeira repeticao passaram isolados e na repeticao completa sem relaxar gates.

Main2eae903/PR235 avancou durante essa CI. Merge preserva catalogo/permissoes,
loader de etapas sem analise/ranking/resumo financeiro, coerencia de snapshots
e188 assertions da analise. Inventario combinado61 migrations/33arquivos/1910
assertions,156 testes focais aprovados;11 entradas visuais de dashboard e231
da main com todos os hashes verificados. Novo CI obrigatorio. Health observado
05:07:33.837Z200/ok/b5458ff. Migrations de catalogo da outra entrega nao foram
aplicadas por esta tarefa; verificar compatibilidade/estado antes de promover.

CI38846827500/7804c73 concluida verde: validate, release-gates e isolated-restore.
Promotable-image ignorado por ser PR. Confirma matriz visual completa revisada;
nao valida automaticamente o merge posterior. Operador isolado executado no
Linux em /tmp/dashboard-operator-tests-Jv1QcebM:84 testes passaram,1 skip
exclusivo de Windows;167ms, sem executar adaptador real ou alterar servicos.

Retomada16/10/04:22Z: maincd004e4/PR237 integrado apos avancar. Merge JSON
preserva11 entradas do dashboard e231 da main, incluindo as quatro capturas
moveis dos simuladores;242 hashes verificados.62 testes focais passaram,
1 teste opcional de navegador ignorado. Health publico04:22:48.788Z200/ok
b5458ff, distinto de main e candidato. CI combinada nova continua obrigatoria.

Operador temporario de atualizacao delimitada preparado fora do Git:85 testes
isolados passaram em Windows, sintaxe/ESLint aprovados, sem execucao remota.
Recuperacao de primeiro ciclo falho exige conciliacao externa posterior ligada
ao PID, InvocationID, boot, cursores e hashes; log de falha nao prova ausencia
de publicacao. Scheduler antigo/candidato tem blob8d1de86e3a5ec3ed915e9ba12be6ad38af762c8b.
Pendente ensaio Linux e evidencias reais antes de qualquer uso operacional.

## Publicacao autorizada em16/10/2026

O estado abaixo substitui as pendencias de autorizacao/publicacao anteriores.
PR238 integrado12:38:53Z em66ed7360e5406129da20cde8983be4e51b7b83db.
CI38901994232 concluiu os quatro jobs com sucesso. Artefato imutavel SHA256
0f395a9017fc1782412a653d0989a05656e10638f5d4b885563aace1d938f1b6,
config da imagem e49e71c15ec77055acead06b6984e3b2e73d4bd32870231060094f6906c0b016.
Coordenador publicou deployment69796520-5afb-4136-a8dd-9ffe0b907e97
em13:24:00.784Z, sem pendencia. Health anonimo confirmou versao66ed7360/ok.

MCP aplicou dashboard_analysis_catalog_preparation (20261016132314), uma
instrucao DO com CAS e fontes fixadas; depois da imagem compativel aplicou
dashboard_catalog_pr235_activation (20261016132447), trio atomico autorizado.
SQL preparado SHA25687ec2996e64cd41714fca19b08d064408afad831277113b974d8ee16c1fccb0e
e367f7a7fe3b3dfa1d03f0d3f3053c5c2f1d0df37d0216bd30ed4b6fcbcc983f9.
Backups privados Kt84Zh/before.json e gUo2Ma/before.json em
/srv/descomplica-backups/dashboard-catalog-20261016-\*, respectivamente SHA256
3e5ee173f38b425b9a1f0ae81424cc2576fe788ff1f3aa87a3141a1d6536a002 e
1e2b8e749f361c780f4b7f1a7566625b2e9c4b651f731c452dbc0410b89bfc20.
Diretorios0700/arquivos0600, fsync/releitura; somente configuracao/DDL/ACL,
sem dados comerciais. Verificacao13:25:23Z e nova comparacao13:58:54Z confirmam
27 paginas,38 permissoes,146 role_permissions,6 overrides,10 user_roles;
preservacao integral dos acessos existentes, ACL/owners das rotinas e policies
fora das cinco leituras previstas. Travas temporarias liberadas somente apos
conclusao SQL confirmada. Rollback para runtime pre-catalogo exige conciliacao.

Nginx atualizado13:25:41.596Z sob coordenacao/CAS: somente duas locations exatas
do ingest Salesforce com8m; nginx-t/reload/active aprovados. Config novo SHA256
ee0ca62d70c032c33fe41e2464c07bf2ac579b98c5fcf54262a371b8d930b135.
Recibo privado /var/backups/descomplica-crm/nginx/ed38812d-b258-4afe-ac09-a5c673bec1ea/result.json.

Coletor ainda0fdbb80: preflight identificou lock de exportacao orfao criado
12:00Z, ownerPID2231411 morto; schedulerPID2170274 reiniciado12:03Z.
Falhas13:00Z/13:30Z preexistentes, ultima ingestao confirmada11:36:04Z.
Sob installation.lock, cgroup/owner/fuser/journal/identidade/inode conferidos,
o lock foi movido intacto13:42:03.240Z para backup privado
/srv/descomplica-backups/dashboard-orphan-lock-20261016-FUOOtp/orphan-candidate.lock,
SHA25694278891109fe83e5b884274e0cd01517fda8c446f1c402c8512f23da4a541e5.
Sem stop, exclusao de dados ou mudanca de credenciais. Aguardar ciclo natural
14:00Z antes de atualizar; guard de publicacao completa permanece obrigatorio.
Operador temporario teve87 testes Linux aprovados e1 skip exclusivo de Windows.
Ledger inicial689bf174 permanece intacto; baseline atual0fdbb80 comprovada por
template exato. Listas systemd vazias exigem prova tipada D-Bus, nao inferencia.

CUA nao conseguiu selecionar a aba autenticada por timeout de foco; nao houve
contorno de login/perfil. Matriz visual CI verde, inspecao visual live pendente.
Dois ciclos novos e conciliacao dos agregados continuam obrigatorios antes de
declarar novos filtros alimentados por producao. N8n nao alterado.

Coleta antiga retomada: ingestao14:06:19.078798Z succeeded, seguida de
inventario confirmado e proximo ciclo14:30Z. Preflight de atualizacao passou.
Transacaof7eabd2e-9a2c-4869-a9b9-c9f0539ef263 preservou backup/ledger e
parou cooperativamente o coletor; reload alterou somente a ordem de dependencias
systemd. CAS bloqueou antes do start, fase reloading, processo ausente e exit0.
Diagnostico comprovou mesmos conjuntos Wants/Requires/After e identidades dos
servicos auxiliares. Comparacao canonica ordena somente as cinco propriedades
de dependencia; mudanca de conteudo/multiplicidade permanece bloqueada.
Retomada restrita a reloading, config nova carregada e processo limpo/inativo,
com gates/CAS novos, sem recriar transacao. Testes91 Windows e90 Linux/1skip
passaram. Coletor novo ativo14:10Z, PID2476563, zero restarts; flag de analise
habilitada, horario e credenciais preservados. Recibo de ativacao privado
/srv/descomplica-backups/dashboard-activation-20261016-lMbYAA/evidence.json,
SHA256cbc86946c6a2a24a62059675015e26d09469166593da695545c19a85e6d8a1e8.

Primeira tentativa nova falhou14:13:37Z antes de publicar, mantendo carga14:06Z.
Diagnostico somente leitura do relatorio de oportunidades validou20230 linhas;
nenhuma linha exportada, gravada ou publicada pelo diagnostico. Nao comprova
causa transitoria nem substitui ciclo integral. Aguardar execucoes automaticas.
MCP n8n14:20Z confirmou mesma versao ativa/draft e payload integral, sem edicao.
GET anonimo14:24:31Z confirmou200/ok/66ed7360 e /app redirecionou para /login.

## Aceite do coletor em16/10/2026

Dois ciclos automaticos consecutivos concluidos, sem disparo manual de publicacao:

- Carga gerada14:33:17.597Z, ingestao14:36:04.49803Z succeeded, inventario
  confirmado14:36:33.997Z. Requestabbe56b1-fa09-495a-89f0-da1078be405d.
- Carga gerada15:03:39.874Z, ingestao15:06:30.629428Z succeeded, inventario
  confirmado15:07:02.942Z. Request76b9d71d-7a3c-4af8-bf6d-6183d02a7ab0.

Em ambas, tres visoes e cobertura2026-01-01/2026-10-16 presentes. Quantidade,
generatedAt e SHA256 de todos os fatos comparados entre arquivo privado do
coletor e banco via MCP, sem extrair nomes ou registros de clientes. Segunda
carga:9154/4939/4215 agregados all/with_canal_imob/without_canal_imob; hashes:
04aa55c9d84180f7fc9a76fd003abc52aec1b0e53edee1a3791cb637db7b14eb,
a2cfaf484d6c0d2226f6acc5c69e3d7df9b76bd2432c5f4bcaa24710b66491bb,
90284c66983e360c1f5f798fa34f76c5dbb2630d48c0773f79895a43fa161bed.
Oportunidades do mes incrementaram827 para828 entre ciclos, comprovando carga
nova e nao apenas releitura do mesmo candidato. Nenhum volume foi fixado na UI.

Conferencia limitada read-only no host com as funcoes atuais e carga real:
opcoes unicas/dependentes dos dois canais,315 responsaveis distintos no conjunto,
nove meses completos no ano, julho/agosto/setembro na media trimestral,
setembro anterior. Recorte de um responsavel em cada canal validou metas27/8/4/1
e esperado proporcional16/31, sem divulgar nomes. Nao equivale a captura de UI.
Teste pequeno de agregados, sem build/suite pesada na VPS. Causa da primeira
falha nao comprovada; dois ciclos subsequentes completos sem erro, reavaliar
em recorrencia/defasagem. Scheduler preservado, proxima execucao15:30Z.

Repeticao local Node24: lint zero erros/tres warnings preexistentes, tipos e
build verdes,3654 Vitest/1181 Node/703 release, skips90/19/14. Primeira chamada
de lint encontrou Node25 do PATH e foi descartada como evidencia de toolchain;
repeticao com runtime24.19 correto passou. Nenhum pacote/lockfile modificado.
Somente registros documentais seguem para Git; nao republicar runtime por isso.

Plano anterior a publicacao:
Concluir CI/matriz visual, revisar somente referencias afetadas, integrar PR e
exigir os quatro jobs no main exato. Em seguida conferir novamente drift,
backup e imagem; aplicar migration autorizada, publicar pelo coordenador unico,
atualizar somente o coletor e conferir dois ciclos reais distintos e conciliados.
Fonte indisponivel ou gate falho bloqueia a etapa dependente. Nao declarar
filtros/dados reais publicados apenas pela preview sintetica ou por healthok.
