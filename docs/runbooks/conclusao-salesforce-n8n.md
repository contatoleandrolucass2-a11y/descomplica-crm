# Conclusao da integracao Salesforce e n8n

Estado verificado em 13/10/2026. Este guia diferencia preparo, prova e ativacao.
Nao compartilhar senhas, tokens, dumps ou chave privada em chats/PRs.

## Acessos

- CRM: <https://crm.descomplicapro.com.br/app/configuracoes/conectar-sistemas>
- Novo n8n: <https://n8n-crm.descomplicapro.com.br>
- Projeto Supabase: `descomplica-crm-production` (`hnncxuerlcsaahdxoswb`).
- Bucket privado: `crm-private-backups`; sem links publicos.
- PR: <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/198>

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
- A primeira carga foi pontual. **A agenda de30min ainda nao foi ativada.**
- A tabela operacional do coletor pode continuar sem contagens/publicacao:
  o monitor independente ainda nao recebe os recibos da carga pontual.
  Os cartoes n8n/Supabase usam evidencia consultada no banco.

## Proximo passo tecnico

1. Versionar a implantacao do agendador, integrando coleta e recibos ao monitor.
2. Validar lock, timeout, restart, falha de coleta/publicacao e reautenticacao.
3. Ativar a rotina aprovada de30min e comprovar dois ciclos completos na VPS,
   sem depender do PC. Conferir horarios e banco a cada ciclo.
4. Preservar ultimo snapshot valido se a coleta falhar. Nunca apagar os dados
   antes de validar integralmente a nova carga; manter a RPC atomica existente.

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
- Consulte [backup](crm-backup-storage.md),
  [ingestao](salesforce-n8n-migration.md) e
  [release protegido](production-release-guard.md) para criterios e rollback.
