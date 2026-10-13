# Conclusao da integracao Salesforce e n8n

Estado verificado em 13/10/2026. Este guia diferencia preparo, prova e ativacao.
Nao compartilhar senhas, tokens, dumps ou chave privada em chats/PRs.

## Acessos

- CRM: <https://crm.descomplicapro.com.br/app/configuracoes/conectar-sistemas>
- Novo n8n: <https://n8n-crm.descomplicapro.com.br>
- Projeto Supabase: `descomplica-crm-production` (`hnncxuerlcsaahdxoswb`).
- Bucket privado: `crm-private-backups`; sem links publicos.
- PR: <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/198>
- Agenda e credenciais systemd: PR203 e PR206, integrados e com CI aprovada.
- Evidencias operacionais: <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/209>.

## Concluido

- Novo n8n separado do antigo, com fluxo candidato autenticado e cinco nodes.
- Backup do banco restaurado em copia isolada, com 65 contagens conferidas.
- Backup atualizado do novo n8n restaurado em banco isolado, 148 tabelas.
- Ambos enviados criptografados ao Storage privado e baixados novamente.
- Recuperacao local dos arquivos baixados com SHA256 identico aos originais.
- Chave privada fora da VPS/Supabase, com ACL restrita no Windows.
- Ensaio de ingestao na copia isolada: 15 metricas e 144 participantes,
  com replay idempotente.
- PR198 integrado e CI de main38358420498 aprovada nos quatro jobs.
  Imagem15ddedd publicada pelo coordenador, com backup privado da configuracao.
- Conexao real VPS -> novo n8n -> CRM -> Supabase comprovada em13/10/2026:
  primeira carga HTTP201, replay HTTP200/idempotenttrue, sem duplicidade.
- Supabase atualizado para referencia13/10: 3 views, 15 metricas,
  15 empreendimentos e 144 participantes. Uma run e um evento de sucesso.
- Tela autenticada confirma Salesforce conectado, ingestao n8n e leitura
  Supabase. Evidencias completas no
  [relatorio da conexao](../audits/n8n-supabase-conexao-2026-10-13.md).
- Agenda VPS ativada e dois ciclos completos confirmados em13/10, com
  publicacoes14:10 e14:36BRT. Segundo inicio automatico14:30, sem comando manual.

## O que ainda depende do operador

1. Recomenda-se guardar uma segunda copia independente da chave. A pasta local protegida
   tem um LEIA-ME e recibo; nao e preciso comprar pendrive agora. Sem outra
   copia, perda do PC pode impedir recuperacao. Nao enviar a chave pelo chat.
   A custodia fora da VPS/Supabase e a recuperacao ja foram comprovadas;
   essa redundancia adicional nao impede a conexao solicitada pelo usuario.
2. Aprovar MFA no Salesforce se a sessao remota exigir nova autenticacao.
   Acesso local no navegador nao comprova sessao da VPS.

Credenciais tecnicas existentes devem ser reutilizadas sem nova exposicao;
nao e necessario enviar novamente senhas ou chaves ao assistente.

## Estado da operacao

- Novo workflow ativo: **CRM VPS - Salesforce - Ingestao CRM**, id
  `L90AYSBEat4vYHLz`. Webhook autenticado; sem agenda e sem salvar payloads.
- Ingestao do CRM habilitada; atualizacao manual/refresh continuam desligados.
- Agenda de30min ativada na VPS em13/10 as14:04BRT, SHA689bf174, depois dos
  quatro jobs CI aprovados. Duas cargas automaticas confirmadas14:10/14:36BRT.
- Tabela operacional ja mostra contagens dos sete relatorios, ultima publicacao
  e proxima execucao. Proximo horario agendado no aceite:15:00BRT.
- Replay da primeira carga retornou HTTP200/idempotenttrue, mantendo uma run
  e uma auditoria no banco. A agenda nao depende do computador local.
- Agendamento fica no servico da VPS, nas fronteiras de00 e30 minutos. O novo
  n8n recebe cada carga por webhook; nao existe segunda agenda dentro do workflow.

## Operacao

O [runbook do coletor VPS](salesforce-vps-collector.md) descreve a implantacao
reversivel, os limites e os criterios de aceite. Preparo nao significa ativacao.

1. Acompanhar na tela o ultimo horario publicado e a proxima execucao.
   Dois ciclos reais foram reconciliados com o banco e o segundo iniciou sozinho.
2. Preservar ultimo snapshot valido se a coleta falhar. Nunca apagar os dados
   antes de validar integralmente a nova carga; manter a RPC atomica existente.
3. Se houver pedido de autenticacao, usar Conectar Salesforce no CRM e aprovar
   MFA na sessao remota. Nao e necessario reenviar credenciais pelo chat.
4. Para interromper a rotina ou restaurar o monitor anterior, seguir a reversao
   do runbook, usando o SHA do coletor registrado, e nao o SHA mais novo do app.

Implantacao versionada nos PR203/206, com testes de lock, timeout, restart,
falha de coleta/publicacao, reautenticacao e reversao real. Evidencias na
[auditoria da agenda](../audits/salesforce-agenda-vps-2026-10-13.md).

## Limites

- Validacao local desta etapa: lint/typecheck/test/build aprovados, n8n23/23,
  Vitest2647/43skips, coletor138 e release113/11skips Linux. QA sintetico passou
  nove telas/temas, zoom200%, estados de leitura/ingestao e falha de consulta.
  CI do PR e main aprovadas; promocao e carga real confirmadas nesta entrega.
- N8n antigo nao foi alterado. Somente o webhook do novo n8n esta ativo.
- Backup offsite esta no mesmo projeto Supabase: exclusao do projeto e risco comum.
- Nao houve teste completo de boot das aplicacoes restauradas nem de
  descriptografia das credenciais n8n. Nao alegar recuperacao de desastre total.
- MFA e expiracao imposta pelo Salesforce nao podem ser eliminadas por agenda.
- Um ensaio anterior falhou antes da publicacao e foi revertido. A causa nao
  foi identificada; duas repeticoes automaticas posteriores passaram sem
  relaxar integridade. Recorrencia exige investigar o codigo seguro de erro.
- Consulte [backup](crm-backup-storage.md),
  [ingestao](salesforce-n8n-migration.md) e
  [release protegido](production-release-guard.md) para criterios e rollback.
