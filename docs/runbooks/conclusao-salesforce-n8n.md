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
  com replay idempotente. Isso ainda nao e ingestao HTTP em producao.

## O que ainda depende do operador

1. Guardar uma segunda copia independente da chave. A pasta local protegida
   tem um LEIA-ME e recibo; nao e preciso comprar pendrive agora. Sem outra
   copia, perda do PC pode impedir recuperacao. Nao enviar a chave pelo chat.
2. Aprovar MFA no Salesforce se a sessao remota exigir nova autenticacao.
   Acesso local no navegador nao comprova sessao da VPS.

Credenciais tecnicas existentes devem ser reutilizadas sem nova exposicao;
nao e necessario enviar novamente senhas ou chaves ao assistente.

## Sequencia tecnica obrigatoria

1. Concluir todos os checks do PR, integrar e validar CI push/main no SHA exato.
2. Preparar backup/rollback privado da configuracao; promover a imagem imutavel
   pelo coordenador de release, injetando os secrets existentes. Mesmo SHA
   retorna noop e nao aplica configuracao. Sem restart manual como atalho.
3. Habilitar apenas ingestao e comprovar runtime; refresh, publisher e agenda
   continuam desligados. Nao aplicar migrations Qlik/v3 neste cutover.
4. Validar snapshot completo e sessao da VPS; publicar somente webhook candidato
   via MCP e fazer uma carga unica. Exigir HTTP201/mesmo requestId, conferir banco
   e repetir a mesma carga esperando HTTP200/idempotenttrue.
5. Somente depois habilitar publisher/agenda de 30 minutos com lock, timeout,
   falha fechada e alerta de reautenticacao. Preservar ultimo snapshot valido
   quando a coleta falhar. Nunca apagar dados antes de validar a nova carga.

## Limites

- Validacao local desta etapa: lint/typecheck/test/build aprovados, n8n23/23.
  CI do PR ainda pendente na entrega; nao ha promocao automatica confirmada.
- N8n antigo nao foi alterado. A candidata nova continua inativa neste registro.
- Backup offsite esta no mesmo projeto Supabase: exclusao do projeto e risco comum.
- Nao houve teste completo de boot das aplicacoes restauradas nem de
  descriptografia das credenciais n8n. Nao alegar recuperacao de desastre total.
- MFA e expiracao imposta pelo Salesforce nao podem ser eliminadas por agenda.
- Consulte [backup](crm-backup-storage.md),
  [ingestao](salesforce-n8n-migration.md) e
  [release protegido](production-release-guard.md) para criterios e rollback.
