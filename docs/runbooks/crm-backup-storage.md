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
O operador ainda deve confirmar segunda copia offline sob sua custodia.
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

- Confirmar custodia independente da chave antes de depender deste destino.
- Empacotar e criptografar os backups reais, sem incluir a chave privada.
- Usar nomes unicos e upload sem sobrescrita; nunca enviar dumps em claro.
- Respeitar limite por objeto; nenhum aumento de plano foi autorizado.
- Baixar ciphertext, comparar SHA256 e testar recuperacao/restauracao real.
- Nao aceitar plaintext de decrypt com exit code diferente de zero.
- Registrar restauracao e limites antes de liberar ingestao e agenda.

O bucket esta fora da VPS, mas no mesmo projeto Supabase. Exclusao ou perda
de acesso ao projeto continua um risco comum; nao e backup independente do
provedor. Backup nativo do banco nao substitui copia dos bytes do Storage.
Agenda de 30 minutos e ingestao real permanecem desligadas nesta etapa.
