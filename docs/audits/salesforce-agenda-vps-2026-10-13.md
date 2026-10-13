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
  bloqueado. Checkout atual/preflight passaram; CI38431108475 ainda em curso.
- Aplicacao publicada por outra tarefa: `7d6341fed8bc1c13a1c9ef094c5a92695530c39b`;
  health/ledger reconferidos 13/10 as12:20 America/Sao_Paulo, 200/ok,
  deploymentId `b4e2c6bd-1b5a-4d7f-b324-8a580562eb0b`, sem transacao pendente.
  Substituiu08c3ae as15:16Z; o coletor nao reiniciou a aplicacao.
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

Nova CI de main689bf174 pendente. Dois ciclos reais ainda precisam
registrar requestId, horario, contagens agregadas e run/auditoria no Supabase,
sem dados identificaveis de clientes. Preflight nao comprova agenda ativa.

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
