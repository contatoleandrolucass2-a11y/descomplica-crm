# Homologação visual isolada

## Escopo e limites

Este runbook provisiona somente a homologação visual isolada em
`https://homolog.descomplicapro.com.br`. Ele não autoriza merge, cutover,
migration ou deploy de produção, alteração de dados/grants/flags de produção,
nem mudança em n8n, Qlik ou Salesforce. A homologação usa exclusivamente dados
sintéticos e pode ser removida sem alterar o container, a rede, os volumes, as
portas ou as credenciais de produção.

Toda credencial é criada ou lida em terminal privado e permanece fora do Git,
logs, screenshots e relatórios. Nunca copie `/etc/descomplica-crm/*.json`,
arquivos `.env`, hashes de senha, chaves Supabase ou cookies para evidências.

## Topologia exclusiva

| Recurso              | Identidade exclusiva de homologação                | Isolamento                                                               |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Origem HTTPS         | `homolog.descomplicapro.com.br`                    | Novo registro DNS; nenhum registro existente é alterado                  |
| Gate externo         | Nginx com Basic Auth                               | `/etc/nginx/.htpasswd-descomplica-homologation`, `root:www-data`, `0640` |
| Aplicação            | `descomplica-homologation-app`                     | `127.0.0.1:3100`, sem publicação pública direta                          |
| Projeto Compose      | `descomplica-homologation`                         | Não reutiliza projeto/container de produção                              |
| Cache                | `descomplica-homologation-next-cache`              | Não monta volume de produção                                             |
| Supabase             | projeto local `descomplica-homologation`           | PostgreSQL/Auth próprios; nenhum link com Supabase remoto                |
| Rede                 | `supabase_network_descomplica-homologation`        | Exclusiva do Supabase e app de homologação                               |
| Portas Supabase      | `55320`–`55329`, conforme configuração             | Firewall `DOCKER-USER`; externas bloqueadas; Mailpit só em loopback      |
| Runtime              | `/var/lib/descomplica-crm-homologation`            | `root`, sem montagem de dados de produção                                |
| Configuração privada | `/etc/descomplica-crm/homologation.env`            | `0600`; gerada sem imprimir valores                                      |
| Contas QA            | `/etc/descomplica-crm/homologation-accounts.json`  | Nove identidades sintéticas, `0600`                                      |
| Acesso externo       | `/etc/descomplica-crm/homologation-access.json`    | Credencial Basic privada, `0600`                                         |
| Logs Nginx           | `homolog.descomplicapro.com.br.{access,error}.log` | Separados dos logs de produção                                           |

O Compose de homologação está em
[`deploy/homologation/compose.yaml`](../../deploy/homologation/compose.yaml), o
Supabase isolado em
[`deploy/homologation/supabase.config.toml`](../../deploy/homologation/supabase.config.toml)
e os vhosts em [`deploy/nginx/`](../../deploy/nginx/).

## Estado seguro obrigatório

Somente a homologação usa:

```dotenv
HOMOLOGATION_MODE=true
PUBLIC_SIGNUP_ENABLED=false
CRM_READ_MODEL_V3_SHADOW_ENABLED=true
QLIK_RELAY_MODE=off
QLIK_RELAY_WRITE_ENABLED=false
COMMERCIAL_ENGINE_RUNTIME_MODE=off
COMMERCIAL_ENGINE_ENABLED_KEYS=
SALESFORCE_INGEST_ENABLED=false
SALESFORCE_REFRESH_ENABLED=false
```

O v3 fica ligado apenas para visualização no ambiente sintético. Relay Qlik e
motores comerciais permanecem desligados. Simuladores continuam visualmente
disponíveis, mas seus motores ficam bloqueados; nenhuma policy sintética ou
oficial é executada. A aplicação exibe o banner
`HOMOLOGAÇÃO — DADOS SINTÉTICOS`, desliga cadastro público e aplica `noindex`.
O Nginx acrescenta `X-Robots-Tag: noindex, nofollow, noarchive`, protege também
`/robots.txt` e não encaminha a credencial Basic ao Next.js.

O contrato Auth usa `APP_ORIGIN=https://homolog.descomplicapro.com.br` e aceita
somente o redirect exato `/auth/callback`. O Mailpit isolado escuta apenas em
`127.0.0.1:55324`, captura a entrega para contas `@local.invalid` e nunca
encaminha e-mail externo. O bloco Nginx exato de `/auth/callback` desliga access
e error log para que hashes de recuperação não entrem nos logs do proxy.

## Gate 0 — SHA, produção e capacidade

Execute antes de criar qualquer recurso:

```bash
cd /srv/descomplica-crm
git status --short
git rev-parse HEAD
node --version
pnpm --version
free -h
df -h /
docker system df
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network ls --format 'table {{.Name}}\t{{.Driver}}'
docker volume ls --format 'table {{.Name}}\t{{.Driver}}'
ss -ltn
curl --fail --silent --show-error https://crm.descomplicapro.com.br/api/health
```

Registrar o SHA integral e saída sanitizada. Parar se a árvore estiver suja antes
do incremento, se produção não estiver saudável, se CPU/memória/disco forem
insuficientes, ou se qualquer nome/porta/rede/volume de homologação já existir
sem manifesto correspondente. Nunca remover recurso desconhecido para liberar
capacidade.

Confirmar explicitamente:

- `127.0.0.1:3100` e `55320`–`55329` estão livres;
- nenhum container se chama `descomplica-homologation-app`;
- rede e volume exclusivos ainda não existem, salvo retomada registrada;
- nenhum volume, dump, diretório ou arquivo de produção será montado;
- o registro `homolog.descomplicapro.com.br` está livre no DNS autoritativo e no
  painel privado do provedor;
- criar o registro e emitir TLS não gera custo novo.

## Gate 1 — backup root-only e runtime

Antes de instalar configuração Nginx, criar backup restrito:

```bash
sudo install -d -o root -g root -m 0700 /var/backups/descomplica-crm/homologation
sudo tar -C /etc/nginx -cpf /var/backups/descomplica-crm/homologation/nginx-sites-before.tar sites-available sites-enabled
sudo chmod 0600 /var/backups/descomplica-crm/homologation/nginx-sites-before.tar
sudo sha256sum /var/backups/descomplica-crm/homologation/nginx-sites-before.tar | sudo tee /var/backups/descomplica-crm/homologation/nginx-sites-before.tar.sha256 >/dev/null
sudo chmod 0600 /var/backups/descomplica-crm/homologation/nginx-sites-before.tar.sha256
sudo node scripts/homologation/prepare-runtime.mjs
```

`prepare-runtime.mjs` falha se algum alvo privado já existir, copia somente
migrations versionadas, gera o gate Basic e grava seu material em arquivos
root-only. Entregar acesso exclusivamente pelo mecanismo privado aprovado; não
usar chat, issue, PR, comentário, screenshot ou log.

## Gate 2 — Supabase isolado, nove perfis e fixtures

Instalar primeiro o firewall exclusivo. Ele é reaplicado por timer e bloqueia
as portas publicadas pelo CLI no caminho `DOCKER-USER`; somente loopback é
permitido. Parar se qualquer regra não puder ser comprovada:

```bash
sudo install -o root -g root -m 0755 deploy/homologation/firewall.sh \
  /usr/local/sbin/descomplica-homologation-firewall
sudo install -o root -g root -m 0644 deploy/homologation/firewall.service \
  /etc/systemd/system/descomplica-homologation-firewall.service
sudo install -o root -g root -m 0644 deploy/homologation/firewall.timer \
  /etc/systemd/system/descomplica-homologation-firewall.timer
sudo systemctl daemon-reload
sudo systemctl enable --now descomplica-homologation-firewall.timer
sudo /usr/local/sbin/descomplica-homologation-firewall apply
sudo /usr/local/sbin/descomplica-homologation-firewall check
```

Iniciar somente PostgreSQL, Auth, Kong e PostgREST do projeto preparado:

```bash
sudo pnpm exec supabase start \
  --workdir /var/lib/descomplica-crm-homologation \
  --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor \
  --yes
sudo /usr/local/sbin/descomplica-homologation-firewall check
sudo env \
  HOMOLOGATION_MODE=true \
  QA_SUPABASE_WORKDIR=/var/lib/descomplica-crm-homologation \
  QA_RELEASE_PERSIST_ACCOUNTS_FILE=/etc/descomplica-crm/homologation-accounts.json \
  pnpm qa:security:rls-api
sudo env \
  HOMOLOGATION_MODE=true \
  QA_SUPABASE_WORKDIR=/var/lib/descomplica-crm-homologation \
  node scripts/homologation/provision-visual.mjs
```

A matriz obrigatória contém exatamente: `master`, `admin`, `manager`, `broker`,
`coordinator`, `real_estate`, `house`, `partnership_channel` e `pending`. Os
e-mails terminam em `@local.invalid`; dados, organizações, equipes, carteiras,
grants e métricas são fixtures controladas. O provisionador deve recusar arquivo
permissivo, papel ausente, execução fora do runtime isolado ou segunda carga.

Não criar usuário no Supabase remoto. Não importar backup, mapping, policy ou
dado real. O read model v3 recebe apenas grants sintéticos de homologação.

## Gate 3 — imagem e aplicação

Depois dos gates locais no SHA aprovado:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
release_sha="$(git rev-parse HEAD)"
IMAGE_TAG="${release_sha}" pnpm image:build
IMAGE_TAG="${release_sha}" pnpm image:prove
sudo env IMAGE_TAG="${release_sha}" node scripts/homologation/configure-app-env.mjs
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation config --quiet
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation up -d --no-build --remove-orphans
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation ps
sudo docker image inspect "descomplica-crm:${release_sha}" --format '{{.Id}}'
curl --fail --silent --show-error http://127.0.0.1:3100/api/health
```

O `image:prove` exige que ambos os Compose resolvam a mesma referência e o mesmo
ID imutável, valida os dois perfis de runtime sem rede e não imprime o segredo.
Registrar esse ID após homologação e compará-lo, sem rebuild ou nova tag, ao ID
usado na promoção futura de produção. O healthcheck deve retornar o SHA
esperado. Confirmar `HOMOLOGATION_MODE=true`, banner visível, cadastro bloqueado,
endpoints de integração indisponíveis e ausência de chamadas externas antes de
publicar DNS.

## Gate 4 — DNS, Nginx e TLS

1. Repetir o healthcheck de produção.
2. Consultar DNS autoritativo e painel privado. Se o nome existir, parar; nunca
   editar registro existente.
3. Criar somente o novo `A` necessário para
   `homolog.descomplicapro.com.br`, apontando ao host aprovado. O token é lido
   do arquivo root-only e nunca é impresso; o script recusa nome preexistente,
   valida antes do `PUT` e confirma o registro depois:

```bash
sudo pnpm homologation:dns
```

4. Instalar primeiro o vhost HTTP fechado:

```bash
sudo install -o root -g root -m 0644 \
  deploy/nginx/homolog.descomplicapro.com.br.http.conf \
  /etc/nginx/sites-available/homolog.descomplicapro.com.br
sudo ln -s \
  /etc/nginx/sites-available/homolog.descomplicapro.com.br \
  /etc/nginx/sites-enabled/homolog.descomplicapro.com.br
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl is-active nginx
```

5. Confirmar que HTTP retorna `503`, exceto o desafio ACME, e que produção segue
   saudável.
6. Emitir certificado somente depois da propagação DNS:

```bash
sudo certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --domain homolog.descomplicapro.com.br
sudo install -o root -g root -m 0644 \
  deploy/nginx/homolog.descomplicapro.com.br.https.conf.example \
  /etc/nginx/sites-available/homolog.descomplicapro.com.br
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl is-active nginx
```

Nunca usar `restart`. Se `nginx -t` falhar, não executar reload. Confirmar sem
credencial que `/login`, `/robots.txt` e `/api/health` retornam `401`, com
`X-Robots-Tag`; depois testar `200` usando credenciais obtidas pelo canal privado.
O conteúdo autenticado de `/robots.txt` deve ser exatamente `Disallow: /`.

## Checkpoint visual e QA

Liberar a URL para revisão humana somente após:

- Basic Auth válido antes do login;
- login/logout com conta QA dedicada;
- Dashboard e navegação principal saudáveis;
- 21 rotas da matriz de
  [`e2e/release-candidate.spec.ts`](../../e2e/release-candidate.spec.ts)
  percorríveis conforme o perfil;
- todas as páginas com banner sintético, sem dados pessoais reais;
- simuladores identificados como demonstração visual, com motores bloqueados;
- produção saudável depois da publicação.

Executar E2E e QA visual contra a URL HTTPS real usando somente os arquivos
privados. O runner aceita exclusivamente o host de homologação e mantém Basic,
contas e chaves fora de argumentos e artefatos:

```bash
sudo pnpm homologation:qa
```

Antes de abrir o navegador, o runner exige worktree limpa, vincula o HEAD
completo ao `IMAGE_TAG` privado, à imagem imutável do container e ao
`version` Basic-auth de `/api/health`. Também compara em memória o
`supabase/config.toml` efetivo com o arquivo versionado e confirma
`APP_ORIGIN`, URL interna do Supabase, flags de homologação e origem do segredo
montado. O `check` fail-closed do firewall deve provar que Mailpit e todas as
portas `55320`–`55329` continuam restritas ao loopback. Nenhum valor do ambiente
privado ou do `docker inspect` é emitido.
Os gates `OFFICIAL_SIMULATOR_RUNTIME_MODE` e
`OFFICIAL_SIMULATOR_ENABLED_KEYS` são lidos do container efetivo e repassados
ao E2E/visual; o configurador preserva somente valores válidos já existentes e
usa `off`/vazio quando ainda não houver configuração.

O mesmo runner usa o Mailpit apenas por loopback para provar entrega, origem e
uso único do link de recuperação. O teste altera temporariamente a senha e o
fator TOTP da identidade Master/QA sintética; um `finally` administrativo
restaura primeiro a senha original, remove somente fatores criados pelo gate,
revoga explicitamente todas as sessões QA no Supabase isolado e comprova a
credencial final mesmo quando o Playwright falha. Mensagens de recuperação da
identidade dedicada são eliminadas antes e em `finally`. O runner recusa uma
identidade que já tenha fator MFA e nunca imprime senha, chave manual, link,
token ou ID. Antes e depois do callback, valida exatamente os dois blocos Nginx
ativos e examina somente os bytes novos do access log e os logs do container
em memória: query de callback, HTTP 5xx, erro fatal, reinício, troca de imagem
ou mudança de SHA reprovam o gate sem ecoar conteúdo.

Esses comandos locais não substituem o smoke HTTPS. Na URL real, validar nove
perfis, 21 rotas, isolamento vertical/horizontal, guards, filtros, estados
`ready`, `empty`, `stale`, `unavailable`, `error` e bloqueado, desktop/celular,
três temas, zoom 200%, teclado, reduced motion, Axe, CSP, cookies, headers,
`robots`/`noindex` e ausência de escrita externa. Credenciais nunca entram em
argumentos, trace, storage state persistido ou artefatos.

## Evidências sanitizadas obrigatórias

Registrar sem segredo ou PII:

- SHA, digest da imagem, branch, CI e worktree;
- CPU, memória, disco, listeners e inventário de containers antes/depois;
- ausência de colisão e de mounts/volumes/networks de produção;
- health de produção antes, durante e depois de DNS/Nginx;
- consulta DNS antes/depois, cadeia TLS e validade do certificado;
- checksum do backup Nginx, `nginx -t` e reload bem-sucedidos;
- versão de `/api/health` da homologação e estados de containers;
- nove papéis presentes, sem e-mail/senha/UUID de usuário;
- contagens e marcador `synthetic-only`, sem métricas linha a linha;
- resultados E2E, RLS, 21 rotas, Axe, temas, viewports, zoom e screenshots;
- headers, cookies, CSP, `401` pré-gate, `robots` e `noindex`;
- zero chamadas/escritas em Supabase de produção, n8n, Qlik e Salesforce;
- logs sanitizados e resultado do ensaio de rollback.

O fechamento executado em 11/08/2026 está registrado em
[`docs/qa/homologation/RESULTS.md`](../qa/homologation/RESULTS.md), acompanhado
de manifesto de hashes e screenshots sintéticos. O gate aprovou nove perfis e
21 rotas no E2E HTTPS. No novo SHA, a matriz visual complementar cobre as 21
páginas protegidas em quatro viewports, três temas, zoom 200%, Axe e 99
comparações de baseline.

## Rollback sem cutover

A homologação não substitui tráfego de produção. Diante de qualquer degradação,
primeiro retirar a entrada externa e preservar evidências:

```bash
sudo rm /etc/nginx/sites-enabled/homolog.descomplicapro.com.br
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl is-active nginx
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation down --remove-orphans
sudo pnpm exec supabase stop --workdir /var/lib/descomplica-crm-homologation
sudo systemctl disable --now descomplica-homologation-firewall.timer
sudo /usr/local/sbin/descomplica-homologation-firewall remove
curl --fail --silent --show-error https://crm.descomplicapro.com.br/api/health
```

Remover somente o novo registro DNS criado por esta etapa. Nunca alterar domínio,
container, Nginx, volume ou certificado de produção. Se a configuração Nginx
precisar ser restaurada, validar o checksum root-only, restaurar o tar aprovado,
executar `nginx -t` e somente então fazer reload.

Depois de preservar evidências e obter confirmação de teardown, remover apenas
os alvos explícitos de homologação: container/rede/volume do projeto, certificado
do subdomínio, vhost, runtime e arquivos privados de homologação. Não usar glob,
`rm -rf` sobre diretório pai ou limpeza Docker global.

## Bloqueios que permanecem

Homologação visual não fecha nem autoriza:

- políticas oficiais e casos de ouro dos 14 motores;
- owners, backups e fontes oficiais por policy/dataset;
- mappings reais e reconciliação aprovada;
- credenciais HMAC/DB e grants reais por coorte;
- owner operacional/backup Qlik e leitores `GET` residuais;
- janelas de shadow, canário, cutover e rollback de produção;
- migrations remotas, relay real, motores ativos, hardening destrutivo;
- merge ou deploy de produção.

As perguntas e autoridades necessárias permanecem no
[`APPROVAL_PACKAGE.md`](APPROVAL_PACKAGE.md). Ausência de resposta formal mantém
o respectivo gate fechado.
