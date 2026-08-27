# Upgrade Auth/MFA exclusivo da homologação

## Contrato

Este gate aplica somente `20260824230058` e `20260824230100` ao Supabase
local e sintético de `homolog.descomplicapro.com.br`. O executor não aceita
URL de banco, senha, token, projeto linked ou container diferente de
`supabase_db_descomplica-homologation`.

A allowlist versionada está em
[`deploy/homologation/auth-mfa-migration-allowlist.json`](../../deploy/homologation/auth-mfa-migration-allowlist.json).
Ela fixa:

- as 29 versões que formam o baseline atual da homologação;
- as dez versões do repositório deliberadamente não promovíveis neste gate,
  cuja ausência na homologação já foi reconciliada no rehearsal;
- os nomes e hashes SHA-256 das duas candidatas;
- zero migration intermediária, predecessor local, `repair` ou aplicação em
  lote.

Qualquer versão ausente, excedente, parcialmente aplicada ou com hash
divergente encerra o gate. Um arquivo de migration novo no checkout também
encerra o gate até revisão explícita da allowlist. O baseline é específico da
homologação isolada; não é manifesto de produção.

## Preflight e dry-run

O checkout deve estar limpo e no SHA aprovado. O manifesto privado
`/var/lib/descomplica-crm-homologation/manifest.json` deve continuar
`root:root 0600`, com ambiente `isolated-homologation` e classificação
`synthetic-only`.

```bash
release_sha="$(git rev-parse HEAD)"
sudo pnpm homologation:migrate:auth-mfa dry-run --expected-sha "$release_sha"
```

O único resultado aceito em `pendingVersions` é:

```text
20260824230058
20260824230100
```

Não usar `supabase db push`, `--include-all`, `migration repair` ou arquivos SQL
manuais para contornar uma divergência.

## Backup obrigatório

Antes de cada `apply`, criar um diretório **novo e distinto** `root:root 0700`,
nomeado `<YYYYMMDDTHHMMSSZ>-<12 hex>`. Preservar exatamente quatro artefatos
tipados: banco, histórico de migrations, configuração/runtime/Nginx e imagem
anterior. Todos devem ser arquivos regulares `root:root 0600`, não symlinks,
com tamanho declarado dentro dos limites do executor. `SHA256SUMS` usa nomes
simples, sem caminhos, e também fica `0600`.

Validar os checksums e restaurar o banco em PostgreSQL isolado sem rede. Gravar
`restore-proof.json` root-only com o mesmo `backupId`, SHA candidato, horários,
quatro artefatos/tipos/tamanhos/hashes e prova `result=passed`, `isolated=true`,
`networkCount=0`, histórico 29 e candidatas zero. Incluir o próprio proof no
`SHA256SUMS`. O executor exige backup com menos de 24 horas e restore testado há
menos de seis horas, e repete modos, tamanhos e checksums antes da transação.

Contrato sanitizado do proof (valores de hash/tamanho vêm dos artefatos reais):

```json
{
  "schemaVersion": 1,
  "environment": "isolated-homologation",
  "sourceSha": "<SHA de 40 caracteres>",
  "backupId": "20260827T010203Z-0123456789ab",
  "createdAt": "2026-08-27T01:02:03.000Z",
  "artifacts": [
    { "file": "database.dump", "kind": "database", "bytes": 0, "sha256": "<sha256>" },
    {
      "file": "migration-history.sql",
      "kind": "migration-history",
      "bytes": 0,
      "sha256": "<sha256>"
    },
    {
      "file": "homologation-config.tar",
      "kind": "configuration",
      "bytes": 0,
      "sha256": "<sha256>"
    },
    { "file": "current-image.tar", "kind": "image", "bytes": 0, "sha256": "<sha256>" }
  ],
  "restore": {
    "result": "passed",
    "isolated": true,
    "networkCount": 0,
    "historyCount": 29,
    "candidateCount": 0,
    "databaseArtifact": "database.dump",
    "databaseSha256": "<mesmo sha256 do database.dump>",
    "testedAt": "2026-08-27T01:10:00.000Z"
  }
}
```

Os zeros são placeholders de documentação e seriam rejeitados pelo executor.

## Aplicação

Depois do restore isolado aprovado:

```bash
release_sha="$(git rev-parse HEAD)"
sudo pnpm homologation:migrate:auth-mfa apply \
  --expected-sha "$release_sha" \
  --backup-manifest /var/backups/descomplica-crm/<execucao>/SHA256SUMS \
  --confirm homologation-auth-mfa-only
```

O executor:

1. exige árvore limpa e SHA exato;
2. confirma runtime sintético e container exclusivo;
3. valida baseline, allowlist e hashes;
4. obtém lock advisory não bloqueante;
5. aplica cada migration e sua linha de histórico na mesma transação;
6. valida catálogo navegável (`is_navigation=true`) e conjuntos exatos
   `17/14/7/0`;
7. valida ledger legal privado, grants mínimos, RLS/MFA completa, Qlik sem
   leitura direta e funções/triggers Auth;
8. imprime somente versão, hashes, contagens e booleanos sanitizados.

Uma falha após a primeira transação exige correção por migration roll-forward;
nunca remover a linha do histórico nem executar rollback destrutivo do banco.

## Verificação pós-aplicação

```bash
release_sha="$(git rev-parse HEAD)"
sudo pnpm homologation:migrate:auth-mfa verify --expected-sha "$release_sha"
```

`verify` exige as 31 versões exatas, compara nome, quantidade de statements e
SHA-256 armazenado das duas candidatas, e repete todas as postcondições em
transação `READ ONLY`. Somente depois de comprovar a transição `29 → 31`, iniciar
o smoke:

```bash
sudo pnpm homologation:migrate:auth-mfa verify --expected-sha "$release_sha"
sudo pnpm homologation:qa
```

O QA deve limpar em `finally` as nove contas efêmeras, sessões, fatores e
mensagens, mascarar identidades nas evidências e revisar logs sanitizados.
Enrollment e challenge TOTP aguardam uma janela com pelo menos 12 segundos
úteis; os únicos checkpoints emitidos são nomes de fases sanitizados. Chaves e
códigos nunca podem entrar em logs ou evidências.

As duas confirmações TOTP passam por `POST /auth/mfa/verify`, nunca por Server
Action. O handler aceita somente a origem canônica de `APP_ORIGIN`, corpo
`application/x-www-form-urlencoded` de até 512 bytes e os campos exatos
`flow`, `factorId` e `code`. Cookies produzidos pelo Supabase SSR ficam
bufferizados até a verificação do usuário, AAL, ownership/status do fator e
claims AAL2 do token retornado; somente uma resposta `204` aplica o conjunto
final com a política de sessão vigente. O Proxy posterga seu próprio
`Set-Cookie` somente nesse POST, mas encaminha a rotação na requisição; o
handler preserva deleções e emite cada chunk uma única vez. O smoke deve
reprovar resposta RSC, timeout, `Location`, cookie duplicado/corrompido ou
qualquer ocorrência desses campos sensíveis em URL ou logs.

Produção, integrações e motores permanecem inalterados.
