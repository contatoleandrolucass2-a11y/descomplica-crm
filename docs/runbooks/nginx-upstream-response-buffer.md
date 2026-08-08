# Nginx: buffer de resposta do upstream

## Escopo

Este runbook corrige exclusivamente o proxy HTTPS de
`crm.descomplicapro.com.br` quando o Nginx registra
`upstream sent too big header while reading response header from upstream`.

A resposta autenticada da Server Action de login foi medida diretamente no
upstream com Chromium, sem registrar valores de headers ou cookies. O bloco de
headers ocupou 4.260 bytes. Como o buffer padrão do host possui 4 KiB, o menor
patamar suficiente alinhado à página de memória é 8 KiB.

As diretivas devem permanecer dentro de `location /` do server HTTPS deste
domínio:

```nginx
proxy_buffer_size 8k;
proxy_buffers 8 8k;
proxy_busy_buffers_size 16k;
```

Não alterar `large_client_header_buffers`: esta falha ocorre na resposta do
upstream, não nos headers enviados pelo cliente.

## Backup

Execute como `root` antes de instalar a configuração:

```bash
install -d -o root -g root -m 0700 /var/backups/descomplica-crm/nginx
backup=/var/backups/descomplica-crm/nginx/crm.descomplicapro.com.br.$(date -u +%Y%m%dT%H%M%SZ).conf
install -o root -g root -m 0600 /etc/nginx/sites-available/crm.descomplicapro.com.br "$backup"
sha256sum "$backup" > "$backup.sha256"
chmod 0600 "$backup.sha256"
printf '%s\n' "$backup"
```

Guarde o caminho exato exibido pela variável `backup` na sessão operacional.

## Instalação e validação

Partindo da raiz limpa do repositório na `main` aprovada:

```bash
install -o root -g root -m 0644 \
  deploy/nginx/crm.descomplicapro.com.br.https.conf.example \
  /etc/nginx/sites-available/crm.descomplicapro.com.br
nginx -t
systemctl reload nginx
systemctl is-active nginx
```

Não usar `restart`. O reload somente deve ocorrer depois de `nginx -t`
concluir com sucesso.

Valide, sem capturar credenciais, cookies ou headers completos:

1. `GET /login` retorna `200`.
2. Login real cria sessão sem `502` ou `APP-500`.
3. Rota protegida autorizada carrega após o login.
4. Logout encerra a sessão e volta a proteger a rota.
5. `GET /api/health` retorna `200`.
6. Não há nova ocorrência de `upstream sent too big header` nem resposta `502`
   no intervalo posterior ao reload.
7. Os demais hosts e serviços Nginx mantêm o estado anterior.

## Rollback

Se qualquer gate falhar, restaure imediatamente o backup validado:

```bash
sha256sum -c "$backup.sha256"
install -o root -g root -m 0644 "$backup" /etc/nginx/sites-available/crm.descomplicapro.com.br
nginx -t
systemctl reload nginx
systemctl is-active nginx
```

Se `nginx -t` falhar durante o rollback, não execute reload. Corrija o caminho
do backup ou restaure a última cópia cujo checksum foi aprovado.
