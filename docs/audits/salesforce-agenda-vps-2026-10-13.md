# Agenda Salesforce na VPS: evidencias

## Escopo

Rotina de 30 minutos autorizada depois da conexao real VPS -> novo n8n ->
CRM -> Supabase. N8n antigo fora do escopo, sem acesso ou alteracao.
Nenhuma migration, credencial nova, DNS ou reinicio da aplicacao CRM.

## Versoes separadas

- PR203: <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/203>.
- Tentativa inicial revertida: `1ace82d16ad3cdc117a96d36cd9f935657581bee`.
- CI do PR38400603988 aprovada; imagem pulada nesse evento conforme workflow.
- CI de main38408795856: quatro jobs aprovados antes do ensaio de ativacao.
- Correcao PR206: <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/206>,
  integrada em `554a9715c2f2528dafa08dcc3eccd4d552d783d7` depois da CI38418203102.
  CI push38425049893 passou nos quatro jobs antes da ativacao16:26Z.
- Main avancou para689bf174d3d59659222f0e22242323429fec51cd pelo PR208 externo.
  Codigo do coletor, lockfile e CI nao mudaram; preparo do SHA antigo foi
  bloqueado. Checkout atual/preflight passaram; CI38431108475 aprovada nos
  quatro jobs antes da ativacao17:04:52Z (14:04:52 America/Sao_Paulo).
- Aplicacao publicada por outra tarefa: `7d6341fed8bc1c13a1c9ef094c5a92695530c39b`;
  health/ledger reconferidos 13/10 as12:20 America/Sao_Paulo, 200/ok,
  deploymentId `b4e2c6bd-1b5a-4d7f-b324-8a580562eb0b`, sem transacao pendente.
  Substituiu08c3ae as15:16Z; o coletor nao reiniciou a aplicacao.
- Nova publicacao externa: app689bf174, deploymentId
  `fee876e4-5133-46db-93d6-8cc708a53e92`, as17:06:31Z. Health200/ok e ledger
  coerentes as17:12Z, sem transacao pendente. Nenhum restart de CRM por esta tarefa.
- Novo n8n: `L90AYSBEat4vYHLz`, versao `dcffaf09-354c-4a82-817c-5e6ca9da1dd5`.
  MCP confirmou cinco nodes, ativo igual ao draft, sem agenda interna,
  sem salvar execucoes manuais/sucesso/erro ou progresso com payload.

## Validacao

- Windows, Node24.19/pnpm11.20: lint sem erros (um aviso preexistente),
  typecheck/build e formato aprovados.
- Vitest completo com maxWorkers1 no conjunto integradoa7657a1: 136 arquivos,
  2647 testes aprovados,63 skips existentes. pnpm test completo exit0,
  incluindo as suites Node e release. Sem ampliar timeouts ou mudar assertions.
- Rodadas concorrentes tiveram timeouts devtools/Obsidian. Next MCP isolado
  passou em2,89s. Contencao de recursos e hipotese, nao diagnostico definitivo;
  recorrencia em execucao isolada exige nova investigacao.
- Suite inicial195/195 passou antes da correcao. Instalador corrigido69/69.
  CI Linux do PR206 confirmou coletor208/208 (incluindo bridge fisico) e
  release124/124, sem skips nessas suites. Windows reserva um caso do bridge
  e11 verificacoes POSIX a Linux; release113 aprovados.
- Uma repeticao Windows com build concorrente teve timeout30s Obsidian.
  Rodada completa sem build concorrente passou. Contencao e hipotese; nao
  generalizar a causa nem aceitar recorrencia em execucao isolada sem investigar.
- Testes cobrem lock, cancelamento, limpeza, recibo correto, dados incompletos,
  rejeicao de CI invalida, CAS, interrupcao de ativacao e repeticao de rollback.
- Systemd255 aceitou a unidade renderizada. Ensaio isolado com arquivo real
  de unidade confirmou ExecStartPre, expansao de caminhos, leitura privada
  e limpeza do runtime. Sem rede, coleta ou publicacao nesse ensaio.
- Checkout imutavel e preflight do usuario dedicado passaram na VPS.
- Nova rodada Windows no mergeb825c2e (inclui logo689bf174): pnpm verify exit0,
  lint/tipos/test/build passaram. Vitest136 arquivos/2647 aprovados/63 skips;
  release113 aprovados/11 casos POSIX reservados ao Linux, zero falhas.
- Probes sem credencial as17:22:40Z, corpo sintetico vazio: webhook do novo
  n8n rejeitou com403 e ingestao CRM com401. Sem dados comerciais ou segredo
  enviado nesses probes; nenhuma gravacao de teste no Supabase.

## Preparo Privado

Dependencias instaladas pelo lockfile com scripts de lifecycle desligados e
package-import-method=copy. Conferidas32439 copias regulares, sem hardlinks
compartilhados; links apontam somente para dentro do checkout. As23750 copias
sem leitura tiveram inode/owner conferidos antes de ajustar somente leitura
do codigo. Cache pnpm compartilhado e arquivos de credenciais intocados.

Backup privado adicional, com checksums e fsync:
`/srv/descomplica-backups/collector-before-1ace82d-m4obyc`.
Contem unidade/configuracao do monitor e candidato anterior; nao substitui
o backup de banco ja restaurado e recuperado do Storage criptografado.

O instalador registra fase, SHA, CI e estado anterior em
`/var/lib/descomplica-salesforce-collector-install/state.json`, root-only.
Credenciais sao montadas pelo systemd e nao aparecem em unidade, argumentos,
logs, relatorios publicos ou neste documento.

## Ativacao E Ciclos

Primeiro ensaio14:36Z encontrou falha inicial de configuracao e foi revertido.
Systemd255 entrega LoadCredential0440/root, enquanto o coletor exige arquivo
sem acesso de grupo/outros. Prova transiente confirmou que copiar para runtime
privado0600 resolve o contrato sem alterar validacao global; nenhum dado foi
enviado nessa prova. A pasta transiente foi removida automaticamente.

Na reversao, systemd ja tinha descarregado o collector parado e reset-failed
retornou1. Recuperacao conferiu disabled/inactive e omitiu somente esse reset;
o instalador manteve CAS/lock e completou a restauracao. As14:44Z: rolled-back,
monitor enabled/active, collector ausente, navegador com mesmo PID2881480.
Banco e n8n permanecem na carga anterior, sem nova publicacao confirmada.

Segundo ensaio554a971 iniciou16:26:15Z com credenciais validas, PID1047599 e
zero reinicios. Primeiro ciclo falhou16:28:55Z antes de publicar, sem causa
detalhada no log. Rollback corrigido concluiu normalmente e restaurou monitor.
Nao atribuir a falha a memoria, timeout ou dados mutaveis sem evidencia.

Repeticao isolada sem publicacao terminou16:36:20Z, com sete relatorios
19973/1091/514/2605/767/36/7,15 metricas e144 participantes. Candidato privado
58cab7fb-8065-486b-8847-3b273eb940d1 nao enviado ao n8n/Supabase. Consulta MCP
16:35Z ainda confirmou somente a carga07:28:32Z. O sucesso isolado nao
comprova a causa da falha nem operacao automatica. Historicos rolled-back
preservados sob lock, com fsync, antes do novo preparo.

Terceiro ensaio689bf174, apos CI38431108475 aprovada: instalador prepared/active
as17:04:52Z, collector enabled/active PID1138878, zero reinicios; monitor
independente disabled/inactive e navegador preservado PID2881480.

Primeiro ciclo completo:

- Coleta dos sete relatorios entre17:08:01Z e17:08:37Z:
  19974/1092/515/2606/766/36/7 linhas na ordem dos relatorios da tela.
- Publicacao HTTP201 as17:10:59.787Z, request
  `cf334046-6c94-4898-a04c-17f85e6ca05e`.
- Supabase: run `6d4aaa43-1a8d-4db7-889b-00d46151700c`, succeeded,
  record_count159, uma auditoria crm.ingestion.succeeded.
- Snapshots referencia13/10, generated_at17:08:37.306Z: 3 views,15 metricas,
  15 empreendimentos e144 participantes. Consulta somente agregada via MCP.
- Replay limitado ao mesmo requestId as17:13:12Z retornou HTTP200 e
  idempotenttrue; releitura confirmou uma run e uma auditoria, sem duplicacao.
- CRM autenticado mostra coleta concluida, publicacao14:10, sete contagens e
  proxima execucao14:30. Salesforce conectado, n8n com ingestao confirmada,
  Supabase com leitura confirmada; sem inferir disponibilidade global do n8n.
- Pico de memoria inicial694132736 bytes, abaixo do limite768MiB. Zero
  reinicios no primeiro ciclo.

Segundo ciclo natural, sem comando manual:

- Inicio na fronteira17:30Z; sessao atualizada17:30:04.782Z. Sete relatorios
  concluidos entre17:33:16Z e17:33:45Z, com as mesmas contagens da carga anterior.
- Publicacao HTTP201 as17:36:10.811Z, request
  `3bdb5ff0-ee7a-4a32-974c-5947b50cd77a`.
- Supabase: run `392a3e84-bde8-46ea-afb3-e4fd6fa06484`, succeeded,
  record_count159 e uma auditoria de sucesso. MCP17:36:38Z confirmou os dois
  requestIds distintos, cada um com uma run/auditoria, sem duplicacao.
- Snapshots atuais avancaram para17:33:45.009Z, mantendo3views/15metricas/
  15empreendimentos/144participantes. A primeira versao nao acumulou filhos.
- Proxima execucao agendada18:00Z (15:00BRT). PID1138878 permanece ativo,
  zero reinicios e pico723681280 bytes, abaixo de768MiB. Browser preservado.
- Novo n8n relido via MCP: mesma versao dcffaf09, cinco nodes, ativo igual ao
  draft, sem persistir payloads. Nenhuma alteracao de workflow nesta operacao.
- Tela autenticada reconferida14:38BRT: Conectado, coleta Concluida,
  publicacao14:36, proxima15:00 e sete contagens. Captura de entrega somente
  local, sem incluir screenshot da conta ou dados pessoais no Git.

Aceite de dois ciclos reais concluido. A agenda permanece habilitada na VPS,
independente do PC. Isso nao elimina indisponibilidade externa, MFA ou riscos
de perda do host; os limites e a causa nao identificada do ensaio anterior
continuam documentados. Recorrencia exige diagnostico, nunca relaxar validacao.

## Reversao E Limites

- Rollback para o mesmo SHA restaura o estado anterior do monitor e remove
  apenas a unidade criada, sem remover candidato, perfil, segredos ou banco.
- Encerramento forcado pode deixar lock: inspecionar processo antes de retirar.
- Reinicio perde progresso em memoria, nao snapshots ja gravados.
- MFA e revogacao do Salesforce exigem reautenticacao manual no console do CRM.
- Nao ha garantia de sessao permanente ou de ausencia absoluta de falhas.
- Nao reiniciar a VPS compartilhada apenas para alegar um teste de boot.
- Backups offsite no mesmo projeto Supabase compartilham risco de perda do
  projeto; segunda copia independente da chave de recuperacao e recomendada.
- [Operacao e comandos](../runbooks/salesforce-vps-collector.md).
- [Conexao e primeira carga](n8n-supabase-conexao-2026-10-13.md).
- [Acessos e pendencias](../runbooks/conclusao-salesforce-n8n.md).
