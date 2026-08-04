# Implantação

## Alvo

VPS Hostinger KVM 1, Ubuntu 24.04 LTS, aplicação Next.js `standalone`, Docker Compose e Nginx com HTTPS.

## Pré-requisitos da VPS

- Usuário de deploy sem login direto como root.
- Firewall permitindo somente SSH restrito, HTTP e HTTPS.
- Node 24.19.x, pnpm 11.20.x, Docker Engine e Docker Compose.
- Nginx, certificado TLS e rotação de logs.
- Variáveis de ambiente em arquivo com permissão restrita ou gerenciador de segredos.
- `APP_ORIGIN`, secret key Supabase e Bearers Salesforce distintos por ambiente, nunca presentes no artefato.
- Backup validado antes de cada alteração de banco.

## Artefato

```bash
pnpm install --frozen-lockfile
pnpm verify
```

O `Dockerfile` copia `.next/standalone`, `.next/static` e `public` para uma imagem
imutável identificada pelo SHA. `.env.local`, caches e artefatos de usuário são
excluídos do contexto.

## Homologação

1. Criar diretório versionado de release.
2. Instalar/configurar variáveis do ambiente de homologação.
3. Aplicar migrations somente após backup e revisão.
4. Iniciar a imagem pelo Compose, publicando somente em loopback.
5. Apontar Nginx para o processo e validar HTTPS.
6. Executar smoke tests de login, autorização, páginas, APIs e integrações.
7. Monitorar logs, memória, CPU e erros.
8. Validar o produtor primeiro com um snapshot de homologação e repetir o mesmo `requestId` para confirmar idempotência.

## Rollback

- Aplicação: selecionar a tag imutável anterior e executar `docker compose up -d --no-build`.
- Banco: preferir migrations aditivas e backward-compatible. Uma migration destrutiva exige backup, janela e rollback específico testado.
- Segredos: restaurar por gerenciador, nunca por Git.

## Produção

Produção não será publicada automaticamente. Exige autorização explícita após homologação e relatório de testes.

## VPS com Docker Compose

A implantação reproduzível usa `Dockerfile` multi-stage, `compose.yaml` e a saída
`standalone`. O processo Next.js publica somente em `127.0.0.1:3000`; Nginx é a
única entrada HTTP/HTTPS. O arquivo `/etc/descomplica-crm/production.env` deve
pertencer a `root:deploy`, modo `0640`, e nunca entrar no Git.

```bash
cd /srv/descomplica-crm
git fetch origin main
git switch main
git pull --ff-only origin main
export IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
docker compose --env-file /etc/descomplica-crm/production.env build --pull
docker compose --env-file /etc/descomplica-crm/production.env up -d --remove-orphans
docker compose ps
curl --fail --silent http://127.0.0.1:3000/api/health
```

Antes do primeiro `up`, preencha todas as variáveis exigidas pelo Compose. Os
valores `NEXT_PUBLIC_*` são fixados durante o build; qualquer alteração neles
exige uma nova imagem. Segredos server-side são fornecidos somente no runtime.
Use `deploy/production.env.example` como inventário, sem inserir valores no
arquivo versionado.

Na VPS, instale o assistente versionado e a autorização restrita do usuário de
deploy:

```bash
sudo install -o root -g root -m 0755 \
  deploy/system/descomplica-configure-env \
  /usr/local/sbin/descomplica-configure-env
sudo install -o root -g root -m 0440 \
  deploy/system/descomplica-configure-env.sudoers \
  /etc/sudoers.d/descomplica-configure-env
sudo visudo -cf /etc/sudoers.d/descomplica-configure-env
```

O operador `deploy` pode então executar
`sudo /usr/local/sbin/descomplica-configure-env`. O assistente lê chaves sem
eco, valida a URL e os prefixos atuais do Supabase, gera Bearers Salesforce com
entropia criptográfica, preserva valores válidos em reexecuções e substitui
`/etc/descomplica-crm/production.env` atomicamente com `root:deploy` e `0640`.
Ele não inicia containers nem mostra o arquivo final.

`SALESFORCE_REFRESH_URL` não é derivada pelo CRM: é a URL HTTPS publicada pela
automação externa que inicia a extração Salesforce (n8n ou seu substituto). A
URL deve ser obtida nesse serviço e não pode conter credenciais embutidas. O
`MASTER_USER_ID` só é solicitado quando o operador confirma que o bootstrap
manual documentado em `docs/runbooks/bootstrap-master.md` ainda é necessário.

Para rollback, selecione uma imagem imutável que permaneça no host e não faça
novo build:

```bash
export IMAGE_TAG=<sha-anterior>
docker compose --env-file /etc/descomplica-crm/production.env up -d --no-build
curl --fail --silent http://127.0.0.1:3000/api/health
```

Enquanto DNS e certificado não estiverem prontos, habilite somente
`deploy/nginx/crm.descomplicapro.com.br.http.conf`, que atende o desafio ACME e
retorna `503` para todo o restante. Depois da emissão do certificado, substitua
pela variante HTTPS, valide com `nginx -t` e recarregue o Nginx.
