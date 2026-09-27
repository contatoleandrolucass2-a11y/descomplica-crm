# Retirada do canário legado exclusivo da homologação

## Escopo e estado autorizado

Este runbook retira somente o canário legado que já existe no Supabase local e
sintético de `homolog.descomplicapro.com.br`. O estado inicial aceito é exato:

- 32 versões no histórico da homologação;
- 24 páginas no catálogo;
- migration canário `20260828135947` presente com nome, statement e SHA-256
  fixados na allowlist;
- migration de retirada `20260926120000` ausente;
- aplicação e banco exclusivos de homologação.

O estado final aceito também é exato: 33 versões e 17 páginas. A retirada
remove somente sete páginas do canário, o grant Master do Discador e a
permission `crm.dialer.view`. A candidata vive em
`deploy/homologation/migrations`, fora de `supabase/migrations`, e declara
`productionEligible=false`.

Produção permanece em 31 versões e 17 páginas. Não aplicar em produção a
migration canário `20260828135947`, a retirada `20260926120000`, a PR que
introduziu o canário legado (PR 50) ou qualquer artefato derivado desse
histórico exclusivo da homologação. A futura promoção de produção reutiliza
somente a imagem já aprovada, sem migration de banco.

## Proibições

Interromper a execução diante de qualquer divergência. Nunca usar para
contorná-la:

- `supabase db push`, `--include-all` ou SQL manual;
- `supabase migration repair` ou alteração equivalente;
- remoção, renomeação ou regravação de linha em
  `supabase_migrations.schema_migrations`;
- cherry-pick, merge ou reaplicação da PR 50 em produção;
- rebuild, retag ou troca de imagem entre homologação e promoção;
- reativação de `LEGACY_MIGRATION_RUNTIME_MODE` durante ou depois da retirada.

Não restaurar um dump sobre o banco ativo para desfazer uma retirada já
confirmada. Depois do commit, qualquer correção de banco é roll-forward.

## Pré-condições

Executar no checkout aprovado em `/srv/descomplica-crm`, com árvore limpa e
SHA completo. Os gates locais e a prova da imagem devem estar verdes:

```bash
cd /srv/descomplica-crm
git status --short
release_sha="$(git rev-parse HEAD)"
test "${#release_sha}" -eq 40
pnpm lint
pnpm typecheck
pnpm test
pnpm build
IMAGE_TAG="${release_sha}" pnpm image:build
IMAGE_TAG="${release_sha}" pnpm image:prove
homologated_image_id="$(
  sudo docker image inspect "descomplica-crm:${release_sha}" --format '{{.Id}}'
)"
test "${#homologated_image_id}" -eq 71
```

Registrar o SHA e o image ID sanitizados. Parar se a árvore estiver suja, se o
ID não for único, se produção não estiver saudável ou se o Supabase isolado de
homologação não estiver disponível. A execução das etapas de homologação não
autoriza produção; o bind da seção 6 exige autorização separada e explícita.

O Basic Auth da homologação deve permanecer legível apenas por root e pelo
worker Nginx. Corrigir o estado legado antes do backup e confirmar o contrato
exato; não aceitar `nogroup`, `0600` ou permissões para outros usuários:

```bash
sudo chown root:www-data /etc/nginx/.htpasswd-descomplica-homologation
sudo chmod 0640 /etc/nginx/.htpasswd-descomplica-homologation
sudo stat --format '%U:%G %a' /etc/nginx/.htpasswd-descomplica-homologation
```

A última saída deve ser exatamente `root:www-data 640`.

O checkout Git pode recriar o compose instalado com `0644` após atualização.
Reaplicar a proteção antes de vincular o runtime e confirmar o contrato exato:

```bash
sudo chown root:root /srv/descomplica-crm/deploy/homologation/compose.yaml
sudo chmod 0600 /srv/descomplica-crm/deploy/homologation/compose.yaml
sudo stat --format '%U:%G %a' /srv/descomplica-crm/deploy/homologation/compose.yaml
```

A última saída deve ser exatamente `root:root 600`; isso não altera o conteúdo
versionado nem autoriza qualquer mudança em produção.

## 1. Vincular o runtime ao SHA aprovado

Vincular atomicamente o manifesto privado ao mesmo SHA do checkout:

```bash
sudo pnpm homologation:bind-runtime-release --expected-sha "${release_sha}"
```

O binder exige root, checkout limpo, `HEAD` igual ao argumento, runtime
`root:root 0700` e manifesto `root:root 0600`. Ele preserva os demais campos e
altera somente `sourceSha`. O gate da migration e o QA hospedado exigem
posteriormente `manifest.sourceSha === HEAD`; um SHA apenas bem formatado não é
suficiente.

## 2. Criar backup fresco e ensaiar a retirada

```bash
sudo pnpm homologation:backup:legacy-canary-retirement
```

O comando cria um diretório novo `root:root 0700` sob
`/var/backups/descomplica-crm`, grava quatro cargas, a prova de restore e o
manifesto de checksums como `root:root 0600`, sincroniza todos os arquivos e os
diretórios no disco, restaura o dump em PostgreSQL isolado sem rede e ensaia a
transição completa `32/24 → 33/17`. O arquivo de configuração inclui o dump
de identidades globais do PostgreSQL, com verificadores de senha necessários
para recuperação de desastre; todo o diretório deve permanecer restrito a
root e nunca pode ser copiado para logs ou saída do comando. A prova compara
papéis, fingerprints dos verificadores, memberships, owners e ACLs de banco,
schemas, relações, colunas, rotinas, tipos, defaults e policies, além de
exercitar o tar de configuração e a imagem imutável do app. Copiar da saída
JSON sanitizada o caminho absoluto de
`checksumManifest` para a variável abaixo; não selecionar backup por glob nem
por “mais recente”:

```bash
backup_manifest="/var/backups/descomplica-crm/<backupId>/SHA256SUMS"
sudo pnpm homologation:migrate:legacy-canary-retirement dry-run \
  --expected-sha "${release_sha}"
```

O único `pendingVersions` aceito é `20260926120000`. Antes de `apply`, o backup
deve ter menos de 24 horas e a prova de restore menos de seis horas. Se a janela
expirar, criar outro backup e repetir o restore/rehearsal; nunca reutilizar a
prova vencida.

## 3. Desligar o runtime legado e parar a aplicação

Primeiro gravar exatamente `off` e vazio no arquivo privado, preservando o
restante. Em seguida parar a aplicação antes de qualquer mutação do banco:

```bash
sudo pnpm homologation:configure:legacy-canary-retirement disable
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation config --quiet
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation stop
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation ps
sudo docker inspect \
  --format '{{.State.Running}}' \
  descomplica-homologation-app
```

A última saída deve ser exatamente `false`. Não executar `apply` se o container
estiver ausente de forma inexplicada, reiniciando, saudável/running ou se a
configuração não contiver exatamente:

```dotenv
LEGACY_MIGRATION_RUNTIME_MODE=off
LEGACY_MIGRATION_ENABLED_MODULES=
```

O configurador exige cada chave uma única vez e grava de forma atômica. A
parada elimina a janela em que uma aplicação ainda ativa poderia consumir as
sete páginas enquanto a retirada é aplicada.

O binder do manifesto, o configurador geral e este configurador compartilham
um `flock` root-only. Cada gravação ainda compara o snapshot imediatamente
antes do rename e verifica o conteúdo persistido; execução concorrente não pode
restaurar flags antigas nem vincular silenciosamente um SHA obsoleto.

Essas duas chaves são controles operacionais exclusivos desta migration de
retirada e de seu rollback; não são feature flags de rota. A autorização HTTP
das páginas permanece definida por `PROTECTED_PAGE_GATES`, permissões e RLS.
As réplicas Tabela Direta, Tabela Investidor e Tabelão continuam
`releaseEnabled`; Calcular documentação e CAIXA continuam bloqueados pelo gate
de página, independentemente destas chaves.

## 4. Aplicar e verificar `32/24 → 33/17`

Com a aplicação parada e o backup ainda fresco:

```bash
sudo pnpm homologation:migrate:legacy-canary-retirement apply \
  --expected-sha "${release_sha}" \
  --backup-manifest "${backup_manifest}" \
  --confirm homologation-legacy-canary-retirement-only
sudo pnpm homologation:migrate:legacy-canary-retirement verify \
  --expected-sha "${release_sha}"
```

O `apply` aceita somente o histórico exato de 32 versões, os hashes fixados dos
dois predecessores Auth/MFA e do canário, o catálogo exato de 24 páginas e a
prova fresca do backup. A transação adiciona uma única versão e deve terminar
com 33 versões, 17 páginas, zero permission/grant/override legado e o hash exato
da candidata. O `verify` repete as pós-condições em transação somente leitura.

Não iniciar a aplicação se qualquer uma dessas provas falhar.

## 5. Subir a mesma imagem com as flags desligadas

O configurador geral preserva `off`/vazio e grava o mesmo SHA em `IMAGE_TAG`:

```bash
sudo env IMAGE_TAG="${release_sha}" \
  node scripts/homologation/configure-app-env.mjs
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation config --quiet
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation up -d --no-build --remove-orphans
sudo node scripts/release/compose-with-runtime-secret.mjs \
  homologation ps
test "$(
  sudo docker image inspect "descomplica-crm:${release_sha}" --format '{{.Id}}'
)" = "${homologated_image_id}"
curl --fail --silent --show-error http://127.0.0.1:3100/api/health
```

O image ID deve ser idêntico ao registrado antes da retirada e o health deve
devolver o SHA completo. Não usar `build`, `pull` ou uma tag diferente.

## 6. QA hospedado e promoção posterior

```bash
sudo pnpm homologation:qa
```

O QA exige simultaneamente:

- manifesto privado com `sourceSha === HEAD`;
- arquivo privado e container efetivo com runtime legado `off`/vazio;
- `IMAGE_TAG`, referência da imagem, `DEPLOYMENT_VERSION` e health no mesmo SHA;
- gate de retirada em 33 versões e 17 páginas;
- container saudável, sem restart ou troca durante a execução;
- matriz funcional, visual, segurança, limpeza de contas efêmeras e logs
  sanitizados aprovados.

Somente após QA verde e autorização separada, capturar a tag e o image ID da
imagem anterior sem imprimir as demais variáveis privadas. O binder exige CAS
exato, checkout limpo no novo SHA, imagem local com o mesmo image ID homologado
e label OCI igual ao SHA; ele altera somente a única linha `IMAGE_TAG` e persiste
arquivo e diretório antes de retornar:

```bash
production_current_sha="$(
  sudo sed -n 's/^IMAGE_TAG=//p' /etc/descomplica-crm/production.env
)"
test "${#production_current_sha}" -eq 40
production_previous_image_id="$(
  sudo docker image inspect \
    "descomplica-crm:${production_current_sha}" --format '{{.Id}}'
)"
test "${#production_previous_image_id}" -eq 71

sudo pnpm release:bind-production-image \
  --expected-old-sha "${production_current_sha}" \
  --new-sha "${release_sha}" \
  --expected-image-id "${homologated_image_id}"
sudo node scripts/release/compose-with-runtime-secret.mjs \
  production config --quiet
sudo node scripts/release/compose-with-runtime-secret.mjs \
  production up -d --no-build --remove-orphans
curl --fail --silent --show-error \
  https://crm.descomplicapro.com.br/api/health
```

Produção deve continuar em 31 versões/17 páginas e com flags legadas
`off`/vazio. Não executar nenhuma migration deste runbook em produção. O wrapper
ignora variáveis do shell e lê somente `/etc/descomplica-crm/production.env`;
por isso omitir o binder acima não promove a imagem nova.

## Rollback e recuperação

Antes do commit da migration, falha de precondição ou do `apply` deixa a
transação sem efeito: confirmar novamente `32/24`, manter a aplicação parada e
investigar. Para restaurar serviço sem expor o canário, é permitido subir a
imagem anteriormente saudável somente com as flags legadas `off`/vazio.

Depois de `apply` confirmado, o banco permanece em `33/17`. Se a nova aplicação
falhar, reapontar apenas o app para a imagem anterior comprovadamente compatível
com as flags desligadas; preservar histórico, dados e evidências. Corrigir banco
somente por migration roll-forward allowlisted.

Se `production config`, `production up` ou o health falhar depois do bind, manter
o checkout limpo no `release_sha` e executar imediatamente o CAS reverso. Ele
somente aceita a tag nova como estado corrente e comprova o image ID e a label
OCI da imagem anterior antes de restaurar a linha `IMAGE_TAG`:

```bash
sudo pnpm release:bind-production-image rollback \
  --expected-current-sha "${release_sha}" \
  --rollback-sha "${production_current_sha}" \
  --expected-image-id "${production_previous_image_id}"
sudo node scripts/release/compose-with-runtime-secret.mjs \
  production config --quiet
sudo node scripts/release/compose-with-runtime-secret.mjs \
  production up -d --no-build --remove-orphans
curl --fail --silent --show-error \
  https://crm.descomplicapro.com.br/api/health
```

Não fazer checkout, rebuild, retag ou rollback de banco nesse procedimento. Se
o CAS reverso falhar, manter o serviço parado e escalar o incidente; não editar
`production.env` manualmente.

O backup fresco serve para recuperação de desastre da homologação isolada como
uma unidade completa, mediante decisão explícita de incidente. Não usar seu
dump para apagar a versão `20260926120000`, fabricar `32/24` depois do commit ou
alterar produção. Registrar SHA, image IDs, backup ID, horários, resultados
sanitizados e decisão de recuperação.
