# Evidência de backup e restore isolado

## Backup oficial

Backup lógico coletado em diretório temporário protegido (`0700`) entre
2026-08-09 14:19:35 UTC e 14:36:51 UTC. Cada arquivo foi criado com permissão
`0600`.

| Artefato bruto             |     Bytes | SHA-256                                                            |
| -------------------------- | --------: | ------------------------------------------------------------------ |
| `roles.sql`                |       370 | `168a95a9c745af5ed4679751f90419ac9dc434240a213b03e32a06d5664c2308` |
| `schema.sql`               |   111.860 | `920aaa39fe01a961482a4d3e22d19a0bb3602092eaeefdd777f03a0ea1bb7bd4` |
| `data.sql`                 | 1.454.581 | `f37239b02f4c077f75f6c8e56c69129a3d4f28a31ec9bf5027d64c0180074f3f` |
| `history-schema.sql`       |     1.116 | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| `history-data.sql`         |   141.809 | `c064aa0f44161012d0a4afc0f640b904e7fbfff3ae9f53fc402e0bdd5cb65aee` |
| `schema-with-comments.sql` |   170.674 | `aadc64dbeeca2356399377b3ffb9df0c74b630c292ac9ba6aa7a6ed66bcf8fec` |

Comandos reproduzíveis, sem credenciais:

```bash
supabase db dump --linked --role-only -f <protected-temp>/roles.sql
supabase db dump --linked -f <protected-temp>/schema.sql
supabase db dump --linked --data-only --use-copy -f <protected-temp>/data.sql
supabase db dump --linked --schema supabase_migrations -f <protected-temp>/history-schema.sql
supabase db dump --linked --schema supabase_migrations --data-only --use-copy -f <protected-temp>/history-data.sql
supabase db dump --linked --keep-comments -f <protected-temp>/schema-with-comments.sql
```

Os dumps brutos contêm metadados Auth e material de sessão/token criptografado;
por isso nunca entram no Git. Somente o DDL sanitizado e evidências agregadas
são versionados.

## Ambiente isolado

Restore feito no projeto local temporário `descomplica-restore-proof`, limitado
a `127.0.0.1`, API `55321` e banco `55322`. Não havia migrations ou seed do
repositório nesse projeto. O alvo foi validado como localhost antes de cada
operação.

| Serviço isolado | Versão       |
| --------------- | ------------ |
| PostgreSQL      | `17.6.1.156` |
| Auth            | `2.194.0`    |
| PostgREST       | `14.15`      |
| Storage         | `1.67.20`    |

A primeira tentativa falhou fechada, sem aplicar schema, porque o dump de roles
incluía `GRANT SET ON PARAMETER log_min_messages`, não permitido no container.
Uma cópia local de compatibilidade removeu somente essa linha; o backup bruto e
seu checksum não foram alterados.

Restore bem-sucedido:

```bash
psql <isolated-local-db> --single-transaction --variable ON_ERROR_STOP=1 \
  -f roles.restore.sql -f schema.sql \
  -c 'set session_replication_role = replica' -f data.sql
```

O histórico foi restaurado separadamente. O dump padrão não carregou o trigger
customizado de `auth.users`; sua definição foi obtida por leitura remota,
recriada somente no ambiente isolado e comparada por definição. Grants locais
gerenciados foram normalizados e os grants exatos do dump reaplicados para que
a prova comparasse o estado remoto, sem aceitar defaults mais amplos da stack
local.

## Resultado

- 48/48 tabelas no escopo do backup com contagens idênticas;
- checksum SHA-256 de multiconjunto idêntico nas 48 tabelas;
- inventário canônico de schema de aplicação, functions, hashes, triggers,
  policies e grants sem diff;
- 17 migrations remotas restauradas no histórico capturado;
- 3 usuários Auth restaurados;
- 0 buckets e 0 objetos Storage, iguais ao remoto;
- 5 extensões remotas disponíveis;
- Auth, Storage e PostgREST responderam HTTP 200;
- pgTAP de integridade: 28/28 testes aprovados;
- nenhum acesso ao host remoto durante o restore ou os testes.

A stack isolada possuía três tabelas gerenciadas novas e vazias
(`storage.iceberg_namespaces`, `storage.iceberg_tables` e
`supabase_functions.hooks`) e a extensão extra `pg_net 0.20.4`. São diferenças
de versão local, não perda de backup.

## Limites comprovados

O backup lógico preserva tabelas e metadados de Auth, mas não transporta a
configuração hospedada de JWT, SMTP, OAuth nem garante validade das sessões em
outro projeto. Storage lógico preserva metadados; os binários exigiriam cópia
separada. O projeto remoto tinha zero objetos, então não houve binário ausente.

Esses limites impedem classificar o restore como clone operacional completo de
produção. Ele é prova verificável de schema, dados permitidos, metadados,
integridade e autorização catalogada.

Depois da extração das evidências agregadas, a stack
`descomplica-restore-proof` foi parada sem backup local e os dois diretórios
temporários `0700` foram apagados. Os dumps brutos sensíveis não são
recuperáveis pelo repositório; permanecem somente tamanhos, checksums, método e
DDL sanitizado.
