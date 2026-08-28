# Runbook de homologação isolada

Este runbook autoriza somente homologação. Produção, DNS, Nginx produtivo,
Supabase produtivo e integrações externas permanecem fora de escopo.

## Preflight

1. confirmar branch, SHA, CI verde e worktree limpa;
2. registrar `/api/health`, imagem/digest, containers e configuração anterior;
3. provar backup root-only e restore isolado;
4. confirmar dry-run com somente
   `20260828135947_legacy_simulators_discador_master_canary` pendente;
5. confirmar que o banco contém o conjunto exato de 17 páginas exigido pelo
   preflight da migration.

O gate usa somente o banco local `supabase_db_descomplica-homologation`. Não
aceita URL, projeto linked, `db push` ou `migration repair`.

```bash
release_sha="$(git rev-parse HEAD)"
test -z "$(git status --porcelain=v1 --untracked-files=all)"
sudo pnpm homologation:backup:legacy-canary
sudo pnpm homologation:sync:legacy-canary
sudo pnpm homologation:migrate:legacy-canary dry-run --expected-sha "$release_sha"
```

O JSON sanitizado do dry-run deve conter somente
`pendingVersions=["20260828135947"]`, histórico 31 e `mutation=false`. O backup
cria quatro artefatos `root:root 0600`, `SHA256SUMS` e `restore-proof.json` em
um diretório novo `0700`; o restore descartável usa `network=none` e precisa
comprovar 31 versões, zero candidata e 17 páginas.

## Configuração privada

Ativar somente na homologação:

```text
LEGACY_MIGRATION_RUNTIME_MODE=active
LEGACY_MIGRATION_ENABLED_MODULES=simulator.wf16,simulator.caixa,simulator.wf14,simulator.wf15,simulator.tabelao,dialer,dialer.weekend-forecast
OFFICIAL_SIMULATOR_RUNTIME_MODE=active
OFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13,simulator.wf16,simulator.caixa,simulator.wf14,simulator.wf15
```

Segredos de estoque, quando houver contrato aprovado, entram somente por
arquivo `_FILE` root-only. Sem fonte segura, o Tabelão e WF15 devem permanecer
indisponíveis.

Nesta validação, o configurador cria somente um placeholder vazio
`/etc/descomplica-crm/secrets/homologation-inventory-source-auth`, `root:root
0640`. O Compose o monta read-only; a fonte continua desligada e o valor nunca
entra no Git, env ou imagem.

## Aplicação e ativação

Depois de CI verde, imagem imutável construída e backup comprovado:

```bash
release_sha="$(git rev-parse HEAD)"
backup_manifest="/var/backups/descomplica-crm/<backup-id>/SHA256SUMS"
sudo node scripts/homologation/configure-legacy-canary.mjs enable
sudo env IMAGE_TAG="$release_sha" node scripts/homologation/configure-app-env.mjs
sudo node scripts/release/compose-with-runtime-secret.mjs homologation config --quiet
sudo pnpm homologation:migrate:legacy-canary apply \
  --expected-sha "$release_sha" \
  --backup-manifest "$backup_manifest" \
  --confirm homologation-legacy-canary-only
sudo node scripts/release/compose-with-runtime-secret.mjs homologation up -d --no-build --remove-orphans
sudo pnpm homologation:migrate:legacy-canary verify --expected-sha "$release_sha"
sudo pnpm homologation:qa
```

O `apply` registra migration e conteúdo com hash na mesma transação, exige a
matriz 24/14/7/0 e repete invariantes Auth/MFA. O QA exige imagem/health no SHA,
zero restart, secrets montados read-only, integrações/motores futuros off e
limpeza das identidades efêmeras.

## Smoke

- `/api/health` no SHA candidato;
- nove perfis × 24 rotas; matriz 24/14/7/0;
- APIs anônimas 401 e perfis não-Master 403;
- cinco motores: casos sintéticos, versões e memória; WF15 fail-closed;
- Tabelão: filtros, loading/vazio/erro e ausência de disponibilidade presumida;
- Discador/Previsão: “Página em desenvolvimento” e POST fechado com 404;
- sete viewports, três temas, zoom 80/100/125/150/200, teclado,
  reduced-motion, Axe e ausência de overflow/5xx/segredos.

## Rollback

Falha crítica exige restaurar imagem e configuração anteriores. Alterar apenas
o arquivo não afeta o processo: é obrigatório restaurar o env root-only do
backup e recriar o container pelo wrapper `up -d --no-build --remove-orphans`.
Se a imagem anterior tiver saído do daemon, carregar `current-image.tar` após
validar `SHA256SUMS`. Repetir health até estabilidade e confirmar zero restart.

A migration não é revertida destrutivamente. Com as flags restauradas em `off`,
as sete superfícies fecham no novo processo; qualquer ajuste de banco usa
migration roll-forward. Nenhuma leitura pública pode ser usada como rollback.
