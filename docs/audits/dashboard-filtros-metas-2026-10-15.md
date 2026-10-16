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

## Validacao

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

Concluir CI/matriz visual, revisar somente referencias afetadas, integrar PR e
exigir os quatro jobs no main exato. Em seguida conferir novamente drift,
backup e imagem; aplicar migration autorizada, publicar pelo coordenador unico,
atualizar somente o coletor e conferir dois ciclos reais distintos e conciliados.
Fonte indisponivel ou gate falho bloqueia a etapa dependente. Nao declarar
filtros/dados reais publicados apenas pela preview sintetica ou por healthok.
