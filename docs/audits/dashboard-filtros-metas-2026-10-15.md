# Dashboard: filtros, meses fechados e metas

## Escopo e autoridade

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

Concluir CI/matriz visual, revisar somente referencias afetadas, integrar PR e
exigir os quatro jobs no main exato. Em seguida conferir novamente drift,
backup e imagem; aplicar migration autorizada, publicar pelo coordenador unico,
atualizar somente o coletor e conferir dois ciclos reais distintos e conciliados.
Fonte indisponivel ou gate falho bloqueia a etapa dependente. Nao declarar
filtros/dados reais publicados apenas pela preview sintetica ou por healthok.
