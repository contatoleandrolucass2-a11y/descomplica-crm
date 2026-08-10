# Contrato e modelo de ameaças do relay Qlik

## Estado e escopo

Este documento define o contrato local do relay CRM-owned para snapshots Qlik.
A implementação permanece inerte: o modo padrão é `off`, o papel PostgreSQL é
`NOLOGIN`, não existe credential real cadastrada e nenhum gate de cutover foi
semeado.

A identidade técnica do caller foi confirmada no inventário sanitizado desta
pasta. Isso não substitui a nomeação formal de um owner operacional e de um
backup owner. A ativação também exige backup remoto com restauração isolada
comprovada. Enquanto essas aprovações e evidências não existirem, `shadow`,
`canary` e `active` permanecem bloqueados.

Este incremento não autoriza alteração de workflow, deploy, migration remota,
cutover, revogação do caminho legado ou hardening destrutivo.

## Endpoint

- Método: `POST`.
- Path exato: `/api/ingest/qlik`.
- Query string: proibida.
- `Content-Type`: `application/json`; parâmetro `charset` é aceito.
- `Content-Encoding`: deve estar ausente. Payload comprimido é rejeitado.
- Cookies, sessão Supabase e autenticação de usuário não participam do contrato.
- Respostas usam `Cache-Control: no-store`, `Pragma: no-cache` e os headers de
  segurança comuns da aplicação.

O path é excluído do Proxy do Next.js. Isso impede refresh de sessão e evita o
buffer intermediário do Proxy; autorização continua obrigatória dentro do
Route Handler.

## Headers autenticados

| Header                       | Formato obrigatório                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `Authorization`              | `HMAC-SHA256 <assinatura>`; assinatura SHA-256 em 64 caracteres hexadecimais minúsculos   |
| `X-CRM-Relay-Key-Id`         | chave lógica minúscula, formada por segmentos alfanuméricos separados por `.`, `_` ou `-` |
| `X-CRM-Relay-Timestamp`      | UTC ISO 8601 terminado em `Z`, com fração opcional de 1 a 6 dígitos                       |
| `X-CRM-Relay-Nonce`          | UUID v4 em caracteres minúsculos                                                          |
| `X-CRM-Relay-Content-SHA256` | SHA-256 dos bytes HTTP brutos, em 64 caracteres hexadecimais minúsculos                   |

Nomes de header são case-insensitive conforme HTTP. Valores e formatos acima
são estritos. O key ID identifica uma credential aprovada, mas não é segredo.

## Assinatura HMAC

O produtor calcula primeiro o SHA-256 dos bytes exatos enviados no body. Não
deve reserializar, reformatar ou normalizar o JSON entre o cálculo e o envio.

A string canônica contém seis linhas, sem linha vazia inicial ou newline
final:

```text
POST
/api/ingest/qlik
<key-id-exato-do-header>
<timestamp-exato-do-header>
<nonce-exato-do-header>
<sha256-hex-do-body-bruto>
```

A assinatura é:

```text
hex_lowercase(HMAC_SHA256(segredo_M2M, string_canônica_UTF8))
```

O segredo M2M deve ser gerado com ao menos 256 bits aleatórios, codificado como
string base64url de 43 a 128 caracteres e usado em UTF-8 exatamente como
provisionado. Ele deve ser exclusivo por ambiente, diferente de qualquer chave
Supabase e transmitido ao processo somente por mecanismo de segredos
autorizado. O valor nunca entra em Git, migration, documentação, payload,
argumento SQL ou log.

O relay recalcula o digest do body e a assinatura, comparando ambos em tempo
constante. Mudança de método, path canônico, key ID, timestamp, nonce ou
qualquer byte do body invalida a assinatura. Isso também impede trocar o key ID
depois de assinar um request com a chave de outra credential.

## Limites e validação

- Limite HTTP e PostgreSQL: `1.000.000` bytes.
- `Content-Length`, quando presente, deve ser inteiro decimal não negativo.
- O body é lido como stream e cancelado ao ultrapassar o limite, inclusive
  quando `Content-Length` estiver ausente ou subestimado.
- UTF-8 inválido, JSON inválido e campos desconhecidos são rejeitados.
- O schema Qlik limita `entries` e `developments` a 5.000 itens cada e valida
  UUID, ano, competência, chaves, decimais exatos, contagens, ranks e
  unicidade.
- `X-CRM-Relay-Timestamp` deve estar dentro de `±300` segundos do relógio do
  relay. A RPC repete a verificação contra o relógio do banco.
- `generatedAt` e `sourceUpdatedAt` não podem estar mais de cinco minutos no
  futuro.

O limite do relay é compatível com o limite atual de 1 MiB do gateway. Alterar
esse limite exige revisão conjunta da aplicação, gateway, memória e função SQL.

## Replay, idempotência e rate limit

Após HMAC válida, a aplicação envia à RPC somente key ID, timestamp, hash do
nonce, hash do body, modo e payload validado. Assinatura e nonce brutos não
chegam ao banco.

O ledger privado possui unicidade por `(key_id, nonce_hash)`:

- mesmo nonce, request ID e body retornam o resultado terminal já registrado;
- mesmo nonce com request ID ou body diferente retorna `replay_conflict`;
- mesmo request ID com nonce novo depende da idempotência transacional da RPC
  base; conteúdo diferente retorna `request_conflict`;
- nenhum conflito pode deixar fatos comerciais parciais.

O banco serializa requests da credential bloqueando sua linha com
`SELECT ... FOR UPDATE` dentro da transação. Cada credential deve ter um limite
explícito entre 1 e 60 requests por minuto. Não há valor padrão: o limite é
aprovado durante o provisionamento. Requests autenticados acima do limite
retornam `rate_limited`.

Falhas HMAC ocorrem antes do ledger e aparecem somente na telemetria
sanitizada da aplicação. Proteção distribuída de tráfego não autenticado no
gateway permanece controle futuro e não autoriza mudança de Nginx neste
incremento.

## Modos e feature flags

| `QLIK_RELAY_MODE`          | `QLIK_RELAY_WRITE_ENABLED` | Comportamento                                                                              |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| ausente, inválido ou `off` | qualquer valor             | Relay indisponível; retorna `503` antes de ler body ou acessar banco                       |
| `shadow`                   | `false`                    | Autentica e compara o snapshot com o run legado de mesmo request ID; não grava fatos Qlik  |
| `canary`                   | `true`                     | Permite escrita controlada somente quando credential e gate DB aprovados estiverem válidos |
| `active`                   | `true`                     | Permite escrita normal somente com gate DB em `cutover`, duas janelas shadow e duas canary |

Qualquer combinação inconsistente falha fechada. Configuração disponível também
exige `QLIK_RELAY_KEY_ID`, `QLIK_RELAY_HMAC_SECRET` e
`QLIK_RELAY_DATABASE_URL` válidos. Nenhum valor real é versionado. Em modo
`off`, o configurador remove os valores e nenhum segredo do relay fica montado
no runtime.

O banco acrescenta gates independentes:

- credential ativa, vigente, ligada a owner e backup owner ativos;
- aprovação e referência de evidência;
- gate `qlik_ranking` no estado correspondente;
- ao menos duas janelas shadow distintas e consecutivas com comparação
  `matched` antes de `canary`;
- ao menos duas janelas canary distintas e consecutivas antes de `active`;
- qualquer falha de paridade zera o progresso aplicável e fecha o gate.

## Respostas

| Resultado                                                                  |  HTTP | Corpo público                         |
| -------------------------------------------------------------------------- | ----: | ------------------------------------- |
| Relay desligado, configuração inválida, gate fechado ou banco indisponível | `503` | erro genérico de indisponibilidade    |
| HMAC, key ID, timestamp, nonce ou digest inválido                          | `401` | `unauthorized`                        |
| Query, encoding ou mídia não suportada                                     | `415` | `unsupported_media_type`              |
| Body acima do limite                                                       | `413` | `payload_too_large`                   |
| UTF-8, JSON ou schema inválido                                             | `400` | `invalid_payload`                     |
| Payload rejeitado pela defesa do banco                                     | `422` | `ingestion_rejected`                  |
| Replay conflitante ou request ID conflitante                               | `409` | `ingestion_conflict`                  |
| Rate limit                                                                 | `429` | `rate_limited`, com `Retry-After: 60` |
| Comparação shadow concluída                                                | `202` | status e contagens sanitizadas        |
| Snapshot novo persistido                                                   | `201` | status, request ID e contagens        |
| Snapshot idempotente                                                       | `200` | status, request ID e contagens        |

Respostas nunca incluem segredo, assinatura, nonce, URL do banco, stack trace,
mensagem SQL, nomes ou valores comerciais.

## Papel PostgreSQL e única RPC

O papel versionado `crm_qlik_relay` nasce com:

```text
NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2
```

Também possui limites de statement, lock e transação ociosa. Pelas ACLs
versionadas do CRM, ele recebe diretamente:

- grant explícito de `USAGE` no schema isolado `qlik_relay`;
- `EXECUTE` somente em
  `qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)`.

Não recebe grant direto em tabela, sequência, schema privado, RPC base, função
de health ou qualquer função `public/private`. Não usa `service_role`, chave
secret do Supabase ou acesso direto às três tabelas Qlik.

As ACLs do schema e da wrapper aceitam somente o owner `postgres` e o papel
dedicado; o grant deste último é exatamente `USAGE`/`EXECUTE`, sem `GRANT
OPTION`. O readiness também rejeita drift de atributos, membership, owner,
schema, função, tabela, sequência ou banco. Na chamada `SECURITY DEFINER`, toda
sessão não-owner precisa ter `session_user` exatamente igual a
`crm_qlik_relay`, o papel precisa estar com `LOGIN` autorizado e o helper de
isolamento precisa retornar `true`. Assim, grant acidental para terceiro,
`SET ROLE` e sessão antiga depois de `NOLOGIN` falham fechados. O endpoint
direto ou pooler escolhido deve comprovar essa identidade antes da ativação.

Isso ainda não torna o papel ativável. A plataforma Supabase local concede por
`PUBLIC` privilégios estruturais, inclusive `USAGE` no schema `net`/`pg_net` e
`CONNECT`/`TEMP` em bancos. A migration comum não tem autoridade para corrigir
ACLs pertencentes a `supabase_admin` ou ao owner do banco. Por isso
`private.crm_qlik_relay_role_isolated()` retorna `false` no estado atual, o
papel permanece `NOLOGIN` e a RPC falha fechada se houver tentativa de ativá-lo
sem isolamento.

A remediação futura exige primeiro inventário remoto somente leitura dos grants
efetivos e dependências da plataforma; depois, em janela separada e autorizada,
`supabase_admin` e o owner de cada banco devem remover o alcance herdado de
`PUBLIC` e conceder explicitamente apenas aos papéis de plataforma que de fato
precisam dele. O helper precisa retornar `true` antes de provisionar `LOGIN`.

`NOLOGIN` é deliberado. Habilitar login e definir senha é uma operação futura,
separada, explicitamente autorizada e executada por canal privado. Senha não
deve aparecer em migration, comando versionado, terminal gravado ou log. A URL
de conexão aceita somente o usuário dedicado, exige `sslmode=verify-full`,
mantém `rejectUnauthorized=true` no driver e, em
produção, host Supabase reconhecido.
O segredo HMAC entregue ao produtor e a senha PostgreSQL do papel dedicado são
credenciais independentes. Reutilizar qualquer valor faz o runtime e o
assistente de configuração falharem fechados. Uma rotação de key ID gera um
novo segredo HMAC; preservar o HMAC anterior exige o mesmo key ID e confirmação
explícita, cujo padrão é negar.

A função de health é outra superfície, mas não pertence ao relay: somente um
usuário autenticado que seja Master e possua `crm.ingest.manage` pode executá-la.

## Modelo de ameaças

| Ameaça                                 | Controle implementado                                                                                              | Risco residual/gate                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Roubo ou reutilização do segredo M2M   | Segredo exclusivo, HMAC, key ID, validade DB, comparação constante e proibição de log                              | Rotação exige operação autorizada; o processo compartilhado ainda não oferece isolamento de memória entre capacidades server-side             |
| Alteração do payload em trânsito       | TLS, digest do body bruto e HMAC sobre key ID, digest, timestamp e nonce                                           | Comprometimento do produtor ou do segredo permite assinar payloads; schema e RPC continuam como defesa independente                           |
| Replay capturado                       | Janela de 300 segundos, nonce UUID v4 e ledger único por credential                                                | Falhas anteriores à autenticação não entram no ledger; gateway ainda não possui rate limit distribuído dedicado                               |
| Body comprimido ou excessivo           | Encoding proibido, limite streaming de 1.000.000 bytes e limite repetido no banco                                  | Ataques distribuídos ainda consomem conexão HTTP até o limite                                                                                 |
| Escalada via credencial DB             | Papel `NOLOGIN`, helper de isolamento fail-closed e uma única RPC direta do CRM                                    | `PUBLIC` ainda transmite `pg_net` e privilégios de banco; owner `supabase_admin`/DB precisa remediar antes de qualquer `LOGIN`                |
| Uso de credencial DB pelo caller       | Relay usa papel dedicado; configuração recusa usuário amplo e segredo HMAC igual ao segredo Supabase ou à senha DB | O container principal ainda pode hospedar outras capacidades privilegiadas; isolamento por processo/container exige etapa autorizada separada |
| Owner, credential ou mapping presumido | Registry vazio, dois owners distintos, evidência obrigatória, mappings reconciliados e gates fail-closed           | Owner operacional e backup owner ainda precisam aceitar formalmente a responsabilidade                                                        |
| Cutover antes da paridade              | Shadow não escreve fatos; duas janelas shadow e duas canary; cada transição exige gate explícito                   | Alterar workflow ou grants fora do runbook pode contornar o processo operacional, embora não os gates DB                                      |
| Hardening quebra publisher legado      | Ponte e hardening permanecem separados; legado só é removido após canário aprovado                                 | Cadeia de migrations precisa de backup restaurável e ensaio formal antes de qualquer aplicação remota                                         |
| Vazamento em logs                      | Evento allowlisted, fingerprint do key ID e erros públicos genéricos                                               | Logs de gateway/plataforma precisam de revisão antes da ativação; headers de autenticação nunca podem ser habilitados em access logs          |
| Métrica falsa ou janela duplicada      | Request ID distinto, hashes, contagens, ledger e contador que não incrementa para o mesmo request                  | Cadência e definição de janela dependem do owner formal; frequência observada não é SLA                                                       |

## Bloqueios para ativação

Ativação permanece proibida até todos os itens existirem como evidência
revisável:

1. owner operacional primário e backup owner distintos, ativos e formalmente
   responsáveis;
2. approver autorizado, referência de evidência e rollback aceito;
3. backup remoto identificado e restauração isolada concluída com sucesso;
4. inventário remoto somente leitura das ACLs estruturais e remediação
   autorizada por `supabase_admin`/owner do banco de `pg_net`, `CONNECT` e
   `TEMP`, até `private.crm_qlik_relay_role_isolated()` retornar `true`;
5. conexão direta/pooler comprovando `session_user = 'crm_qlik_relay'`;
6. credential dedicada provisionada fora do Git, sem reutilização de segredo;
7. dry-run de mappings sem associação presumida e conflitos resolvidos por
   autoridade oficial;
8. duas janelas shadow consecutivas e distintas com `matched`, seguidas de duas
   janelas canary consecutivas e distintas;
9. telemetria, alertas e rollback exercitados;
10. autorização explícita posterior para qualquer mudança remota.

Até lá: `QLIK_RELAY_MODE=off`, `QLIK_RELAY_WRITE_ENABLED=false`, papel
`NOLOGIN`, registries vazios e zero alteração remota.
