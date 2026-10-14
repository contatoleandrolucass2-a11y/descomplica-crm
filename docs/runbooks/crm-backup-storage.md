# Backup privado fora da VPS

## Estado em 2026-10-13

Usuario autorizou o Supabase atual como destino, sem upgrade. Bucket
`crm-private-backups`, projeto `hnncxuerlcsaahdxoswb`, privado, limite por
arquivo 52428800 bytes e MIME `application/octet-stream`. Nao foram criadas
policies de leitura para anon/authenticated. N8n antigo permanece intocado.

Teste sintetico de 47 bytes: upload/download administrativo identico,
download anonimo negado e objeto removido; catalogo confirmou zero objetos.
Isso valida acesso, nao armazenamento ou restauracao de backups reais.

## Chave de recuperacao

Par RSA-4096 gerado fora do repositorio, no Windows do operador. Chave privada
somente local; pasta com heranca desabilitada, ACL exclusiva do usuario e
SYSTEM. Sem senha propria: ACL nao protege contra administrador, malware
executado como o usuario ou leitura offline do disco sem criptografia.
Recomenda-se uma segunda copia independente sob custodia do operador.
Em 13/10/2026, o usuario informou nao dispor de pendrive e pediu continuidade.
Custodia fora da VPS/Supabase e recuperacao local estao comprovadas; uma segunda
copia nao e requisito adicional para conectar o CRM. Perder o unico PC com a
chave pode tornar estes backups irrecuperaveis; esse risco permanece.
Nao enviar a chave ao chat, Git, VPS ou Supabase. Preservar chaves antigas.

Certificado publico SHA256:

```text
B8:33:6B:49:59:51:40:00:15:B6:7C:65:B0:99:E8:EC:DB:DF:73:19:38:0D:68:AC:8B:35:96:B5:89:EA:9D:03
```

Prova sintetica: OpenSSL 3.0.13 na VPS criptografou via CMS AES-256-GCM,
RSA-OAEP SHA256; OpenSSL 3.5.5 local recuperou os bytes esperados e rejeitou
ciphertext adulterado. Certificado temporario remoto removido. Nenhum dado
real ou chave privada transferido. GPG do Git foi descartado nesta etapa
por falha de inicializacao do agente no Windows; nao houve relaxamento da ACL.

## Gates restantes

- Em 13/10/2026, dois arquivos reais foram criptografados, enviados sem
  sobrescrita, baixados e recuperados localmente. SHA256 do arquivo recuperado
  identico ao empacotado na VPS. A chave privada nao saiu do Windows.
- Recibo privado: `/srv/descomplica-backups/offsite-20261013-HFynaO/receipt.json`.
  Copias criptografadas e recibo de recuperacao tambem estao na pasta protegida
  local da chave. Total: 881567 bytes. Nao foram criados links publicos.
- Origem Supabase: `supabase-pre-salesforce-20261013-h0umc6`, ja restaurada com
  65 contagens de tabelas coincidentes. Limites da auditoria original permanecem.
- Origem novo n8n: `local-20261013T051032Z-Xi29nV`, restore isolado148tabelas,
  checksums conferidos, sem teste de boot ou descriptografia das credenciais.
  A recuperacao externa comprovou igualdade dos arquivos; nao repetiu o boot.
- Corrigida prontidao do restore: consultar o banco real por TCP, evitando o
  servidor temporario Unix socket da inicializacao Postgres. Nova rodada exit0.

### Pendencias

- Providenciar segunda copia da chave quando houver destino privado disponivel;
  nao enviar a chave a VPS, Supabase, chat ou repositorio.
- Testar boot/restauracao completa em ambiente isolado antes de alegar DR total.
- Em proximos backups, manter nomes unicos, limite por objeto e criptografia;
  nunca enviar dumps em claro nem aceitar decrypt com exit code diferente de zero.
- Concluir PR/CI, configuracao e reconciliacao da carga real antes da agenda.

O bucket esta fora da VPS, mas no mesmo projeto Supabase. Exclusao ou perda
de acesso ao projeto continua um risco comum; nao e backup independente do
provedor. Backup nativo do banco nao substitui copia dos bytes do Storage.
O registro acima descreve a etapa de backup. Posteriormente, a ingestao real
foi habilitada e reconciliada; a agenda exige a ativacao separada documentada
no [coletor VPS](salesforce-vps-collector.md). Conferir o estado atualizado no
[guia de conclusao](conclusao-salesforce-n8n.md), sem inferir ativacao pelo backup.
