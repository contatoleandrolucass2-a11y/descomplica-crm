# Gate operacional: acesso, backup, restore e domínio

## Restrições atuais

Este gate não executa migration remota, deploy, merge, workflow, DNS, Nginx ou
qualquer mutação na VPS/produção. O projeto remoto foi consultado somente por
uma sessão OAuth autorizada do conector Supabase.

A CLI local está vinculada ao projeto `hnncxuerlcsaahdxoswb`, mas não possui
sessão de plataforma válida. O comando somente leitura
`pnpm exec supabase migration list --linked` falhou com
`LegacyPlatformAuthRequiredError: Access token not provided`. Nenhum token,
senha ou connection string foi solicitado, lido ou impresso.

A CLI Supabase `2.111.0` conseguiu gerar dump do PostgreSQL local `17.6`. O
`pg_dump` do host é `16.14` e, chamado diretamente, rejeita corretamente o
servidor mais novo. Portanto a extração remota deve usar a CLI validada abaixo
ou um cliente PostgreSQL 17 compatível; nunca o `pg_dump` 16 do host.

Quando a extração for autorizada, a única instrução inicial de provisionamento é:

```bash
pnpm exec supabase login
```

Ela deve ser executada pelo operador em terminal privado autorizado, concluindo
o navegador/prompt seguro. Não enviar a credencial no chat, argumento de linha
de comando, arquivo do repositório ou log de CI. Se a conexão ao banco pedir
senha, o operador deve fornecê-la no prompt oculto ou por secret manager.

## Backup remoto exigido

Um backup só será aceito depois de extraído e restaurado. Antes da execução, o
operador deve confirmar se o plano Supabase já inclui backup físico/PITR e
informar qualquer custo de branch, clone ou ambiente isolado. Nenhum recurso
pago será provisionado por este gate.

### Artefatos lógicos

Criar diretório temporário fora do Git com permissão `0700`; gerar arquivos
`0600` para papéis, schema e dados. Com sessão segura e projeto vinculado:

```bash
umask 077
backup_dir="$(mktemp -d)"
pnpm exec supabase db dump --linked --role-only --file "$backup_dir/roles.sql"
pnpm exec supabase db dump --linked --file "$backup_dir/schema.sql"
pnpm exec supabase db dump --linked --data-only --use-copy --exclude storage.buckets_vectors --exclude storage.vector_indexes --file "$backup_dir/data.sql"
pnpm exec supabase db dump --linked --schema supabase_migrations --file "$backup_dir/history_schema.sql"
pnpm exec supabase db dump --linked --schema supabase_migrations --data-only --use-copy --file "$backup_dir/history_data.sql"
sha256sum "$backup_dir/roles.sql" "$backup_dir/schema.sql" "$backup_dir/data.sql" "$backup_dir/history_schema.sql" "$backup_dir/history_data.sql" > "$backup_dir/SHA256SUMS"
chmod 0600 "$backup_dir"/*
```

Não usar `set -x`; não imprimir URL ou variáveis secretas. O diretório precisa
ser transferido para armazenamento aprovado/criptografado ou removido pelo
operador depois da prova. Ele nunca entra no repositório.

O relatório deve registrar, sem segredos:

- projeto, UTC inicial/final, PostgreSQL e versão da CLI;
- tamanho e SHA-256 de cada arquivo;
- permissões Unix e responsável pela custódia;
- schemas incluídos/excluídos e contagem de tabelas/sequências/funções;
- contagens agregadas pré-restore, sem PII ou valores comerciais;
- existência e retenção do backup físico/PITR da plataforma;
- limitações: arquivos do Storage e configuração externa não são conteúdo de
  um dump PostgreSQL e exigem inventário separado.

### Restauração isolada

Usar um alvo Supabase/PostgreSQL 17 isolado e já provisionado com os schemas
gerenciados da plataforma, sem rede pública ou usuários reais. O dump de schema
da CLI exclui `auth`, `storage` e outros schemas mantidos pela plataforma,
enquanto o dump de dados pode contê-los. Por isso um `createdb` PostgreSQL vazio
não é alvo suficiente para restauração integral. Não criar branch/projeto pago
sem informar custo e obter autorização.

```bash
sha256sum --check "$backup_dir/SHA256SUMS"
psql \
  --host "$RESTORE_HOST" \
  --username "$RESTORE_USER" \
  --dbname "$RESTORE_DATABASE" \
  --single-transaction \
  --set ON_ERROR_STOP=1 \
  --file "$backup_dir/roles.sql" \
  --file "$backup_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$backup_dir/data.sql"
psql \
  --host "$RESTORE_HOST" \
  --username "$RESTORE_USER" \
  --dbname "$RESTORE_DATABASE" \
  --single-transaction \
  --set ON_ERROR_STOP=1 \
  --file "$backup_dir/history_schema.sql" \
  --file "$backup_dir/history_data.sql"
```

`RESTORE_HOST`, `RESTORE_USER` e `RESTORE_DATABASE` vêm do ambiente privado;
senha somente por prompt oculto/secret manager. Antes de executar, resolver e
confirmar que host/database são o alvo isolado, nunca produção. O checksum é
validado antes de qualquer escrita; a restauração principal é uma transação e
desabilita triggers somente durante a carga de dados, conforme o fluxo oficial.
A destruição
posterior do alvo é operação separada e exige confirmação explícita do
operador.

### Ensaio local comprovado

Em 9 de agosto de 2026, a CLI `2.111.0` gerou schema e dados do schema `public`
do Supabase local PostgreSQL `17.6`, com arquivos `0600` e SHA-256 verificados.
O restore ocorreu em banco isolado criado apenas para o ensaio:

- 20/20 tabelas públicas restauradas;
- inventário `20 tabelas : 27 funções public/private : 19 policies` igual;
- contagens de todas as tabelas iguais entre origem e cópia;
- checksums dos artefatos iguais antes do restore;
- banco isolado e dumps temporários removidos após a prova.

O ensaio inicial com data dump sem `--schema public` mostrou corretamente que a
CLI inclui dados de `auth`/`storage`, mas o schema dump não recria os schemas
gerenciados. A prova integral de Auth/Storage, portanto, exige alvo Supabase já
provisionado; o ensaio local comprova somente schema/dados da aplicação. Ele não
é backup remoto e não libera migration.

### Prova pós-restore

O restore só está comprovado com relatório contendo:

1. todos os comandos com exit code zero e sem segredo;
2. checksums iguais antes/depois da transferência;
3. migrations presentes e em ordem;
4. inventário de objetos igual ao remoto capturado;
5. contagens agregadas por tabela iguais;
6. FKs, índices e constraints válidos;
7. grants/RLS/policies comparados, inclusive os riscos Qlik conhecidos;
8. pgTAP local e testes da aplicação aprovados contra a cópia;
9. login QA isolado e verificações negativas de `anon`/escopo;
10. comando de rollback e responsável pela decisão.

O [inventário sanitizado](REMOTE_SCHEMA_SANITIZED.md) é evidência de metadados,
não dump DDL nem backup. Neste gate, a prova remota permanece bloqueada pela
sessão ausente da CLI e pela falta de um alvo isolado/custo aprovado.

## Baseline e convergência de migrations

Depois do restore, nunca antes:

1. reproduzir em cópia os quatro markers históricos no-op, sem verifier, fórmula
   ou grants legados;
2. aplicar, na ordem e estratégia aprovadas, as nove versões hoje somente
   locais inventariadas na [matriz](MIGRATION_MATRIX.md); três delas são mais
   antigas que `20260809031936` e bloqueiam `db push` normal;
3. comparar DDL, histórico, ACL, RLS e contagens com a matriz;
4. provar que a RPC Qlik legada e todo acesso `anon`/direto de `service_role`
   foram removidos na cópia;
5. provar que o caller Qlik tem contrato M2M novo e rotacionável;
6. executar rollback ensaiado ou restauração para o estado inicial;
7. produzir dry-run revisável antes de solicitar autorização remota.

Não usar `migration repair`, `db push --include-all` nem SQL ad hoc para
silenciar a divergência.

## Plano do domínio canônico

Produção permanece em `https://descomplicapro.com.br/`. O possível
`https://crm.descomplicapro.com.br/` só pode virar alias/redirecionamento num
gate posterior.

### Preflight somente leitura

- inventariar registros DNS, TTL, resolução IPv4/IPv6 e proxy/CDN;
- capturar cadeia/cobertura/expiração dos certificados de ambos os hosts;
- revisar `server_name`, upstream, headers e redirect atual do Nginx;
- revisar `NEXT_PUBLIC_SITE_URL`, URLs Supabase Auth permitidas, callback/logout,
  OAuth e links de e-mail;
- confirmar escopo, `Secure`, `HttpOnly`, `SameSite`, domínio e path dos cookies;
- confirmar CSP, HSTS, `X-Forwarded-Host`/`Proto`, canonical/metadata e CORS;
- identificar health check, imagem/digest e rollback atuais da VPS.

Nenhuma leitura deve imprimir cookies ou segredos.

### Mudança futura autorizada

1. baixar TTL com antecedência, se necessário;
2. emitir/validar certificado para os dois hosts;
3. manter o host canônico servindo a aplicação;
4. configurar o alias com redirecionamento permanente, preservando path e query,
   ou proxy temporário se autenticação exigir e isso for aprovado;
5. atualizar allowlists de Auth/callback antes de testar login;
6. validar cookies sem duplicidade de sessão e sem redirect loop;
7. executar smoke autenticado/anon, CSP, headers, teclado e dispositivos;
8. monitorar 4xx/5xx, login e latência; registrar UTC de ativação;
9. reverter DNS/Nginx/callbacks para a configuração capturada se qualquer gate
   falhar.

Redirecionar antes de alinhar Auth e cookies pode quebrar login. O subdomínio não
deve receber uma segunda aplicação nem acesso direto ao upstream.

## Próximo gate e bloqueios

O próximo pedido de autorização deve incluir:

- sessão CLI segura comprovada sem revelar credencial;
- custo zero ou custo aprovado do alvo isolado;
- backup restaurado e relatório de integridade;
- decisões de identidade/escopo e onboarding;
- identificação/rotação do caller Qlik;
- migrations de baseline/hardening com pgTAP verde;
- contratos de integração aprovados;
- plano de janela, rollback e responsáveis.

Até lá: PRs permanecem draft; produção, DNS, Nginx, workflows e banco remoto
permanecem inalterados.

## Referências oficiais

- [Supabase: migrations e deploy de banco](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: testes de banco](https://supabase.com/docs/guides/database/testing)
- [Supabase: backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase: backup e restore entre projetos](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
