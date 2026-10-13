# Agenda Salesforce na VPS: evidencias

## Escopo

Rotina de 30 minutos autorizada depois da conexao real VPS -> novo n8n ->
CRM -> Supabase. N8n antigo fora do escopo, sem acesso ou alteracao.
Nenhuma migration, credencial nova, DNS ou reinicio da aplicacao CRM.

## Versoes separadas

- PR203: <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/203>.
- Coletor integrado: `1ace82d16ad3cdc117a96d36cd9f935657581bee`.
- CI do PR38400603988 aprovada; imagem pulada nesse evento conforme workflow.
- CI de main38408795856: quatro jobs aprovados antes do ensaio de ativacao.
- Aplicacao publicada: `08c3ae453ddfb225c3cb64971b53333c36d8932e`;
  health/ledger reconferidos 13/10 as11:00 America/Sao_Paulo, 200/ok.
- Novo n8n: `L90AYSBEat4vYHLz`, versao `dcffaf09-354c-4a82-817c-5e6ca9da1dd5`.
  MCP confirmou cinco nodes, ativo igual ao draft, sem agenda interna,
  sem salvar execucoes manuais/sucesso/erro ou progresso com payload.

## Validacao

- Windows, Node24.19/pnpm11.20: lint sem erros (um aviso preexistente),
  typecheck/build e formato aprovados.
- Vitest completo com maxWorkers1: 136 arquivos,2647 testes aprovados,
  56 skips existentes. Sem ampliar timeouts, pular casos ou mudar assertions.
- Rodadas concorrentes tiveram timeouts devtools/Obsidian. Next MCP isolado
  passou em2,89s. Contencao de recursos e hipotese, nao diagnostico definitivo;
  recorrencia em execucao isolada exige nova investigacao.
- Suite final do coletor195/195 passou, incluindo instalador57/57;
  release113 passou/11 verificacoes POSIX reservadas a CI Linux.
- Testes cobrem lock, cancelamento, limpeza, recibo correto, dados incompletos,
  rejeicao de CI invalida, CAS, interrupcao de ativacao e repeticao de rollback.
- Systemd255 aceitou a unidade renderizada em pasta temporaria, sem instalar.
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

Correcao versionada e nova CI pendentes. Dois ciclos reais ainda precisam
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
