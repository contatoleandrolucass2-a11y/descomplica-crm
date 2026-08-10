# Canário e observabilidade do relay Qlik

## Estado operacional

Este é um runbook preparatório. Nenhum monitor, alerta, credential, gate,
canário ou cutover remoto foi ativado por este incremento.

A ativação está bloqueada até existirem owner operacional e backup owner
formalmente nomeados, além de backup remoto com restauração isolada comprovada.
Metadado técnico de ownership não equivale a aceite operacional. Nenhuma
frequência observada deve ser promovida a SLA sem aprovação formal.

## Sinais disponíveis

### Evento estruturado da aplicação

O Route Handler emite um único JSON sanitizado por request:

| Campo                    | Uso                                                                |
| ------------------------ | ------------------------------------------------------------------ |
| `event`                  | constante `crm.qlik_relay`                                         |
| `correlationId`          | correlação interna gerada pelo relay                               |
| `outcome`                | resultado HTTP/operacional allowlisted                             |
| `httpStatus`             | status retornado                                                   |
| `mode`                   | `off`, `shadow`, `canary` ou `active`                              |
| `durationMs`             | duração total arredondada e não negativa                           |
| `requestId`              | ID do envelope validado, quando disponível                         |
| `keyFingerprint`         | primeiros 12 caracteres do SHA-256 do key ID; não é o key ID bruto |
| `recordCount`            | contagem de entries, quando disponível                             |
| `developmentRecordCount` | contagem de developments, quando disponível                        |
| `comparisonStatus`       | `matched`, `mismatch` ou `legacy_run_missing`                      |
| `idempotent`             | resultado idempotente ou replay exato                              |

Allowlist de `outcome`:

- `unavailable`;
- `invalid_content_type`;
- `payload_too_large`;
- `unauthorized`;
- `invalid_payload`;
- `shadow_compared`;
- `succeeded`;
- `rejected`;
- `rate_limited`;
- `database_unavailable`.

É proibido adicionar body, nomes, valores, headers, cookies, IP, user-agent,
segredo, assinatura, nonce, hash completo de credential, URL DB, stack trace ou
mensagem SQL. Access logs do gateway também não podem registrar
`Authorization` nem headers `X-CRM-Relay-*`.

### Ledger e health RPC

O ledger privado registra somente hashes do nonce/body, IDs técnicos,
timestamps, modo, status, comparação, contagens, duração e reason code
sanitizado. Não há `SELECT` direto para o relay, `anon`, `authenticated` ou
`service_role`.

`public.get_qlik_relay_health(p_since)` expõe agregados de no máximo sete dias
somente para usuário autenticado Master com `crm.ingest.manage`:

- requests totais;
- shadow matched e mismatch;
- sucessos e rejeições;
- timestamp do último request;
- timestamp do último sucesso;
- estado `LOGIN` do papel dedicado e resultado do helper de isolamento.

Essa RPC não expõe payload, segredo, nonce, key ID ou valores comerciais.

## Métricas e SLIs

Os nomes abaixo são contratos lógicos. Podem ser derivados dos eventos e da
health RPC sem criar endpoint público:

| Métrica                                               | Fonte/cálculo                            |
| ----------------------------------------------------- | ---------------------------------------- |
| `qlik_relay_requests_total{mode,outcome,http_status}` | contagem de eventos `crm.qlik_relay`     |
| `qlik_relay_duration_ms`                              | distribuição de `durationMs`             |
| `qlik_relay_shadow_total{comparison_status}`          | eventos `shadow_compared` por comparação |
| `qlik_relay_success_total`                            | `outcome=succeeded`                      |
| `qlik_relay_rejected_total`                           | `outcome=rejected`                       |
| `qlik_relay_auth_rejected_total`                      | `outcome=unauthorized`                   |
| `qlik_relay_rate_limited_total`                       | `outcome=rate_limited`                   |
| `qlik_relay_database_unavailable_total`               | `outcome=database_unavailable`           |
| `qlik_relay_last_request_timestamp`                   | `lastRequestAt` da health RPC            |
| `qlik_relay_last_success_timestamp`                   | `lastSuccessAt` da health RPC            |

SLIs de gate:

1. **Paridade shadow:** `matched / shadow_compared`. Exigência: `100%` em duas
   janelas consecutivas, com request IDs distintos. `mismatch` ou
   `legacy_run_missing` zera a sequência.
2. **Sucesso de escrita:** `succeeded / (succeeded + rejected +
database_unavailable)`. Exigência de canário: `100%` em duas janelas
   completas consecutivas.
3. **Integridade:** contagens e hashes do snapshot devem corresponder ao
   manifesto autenticado e ao resultado persistido em cada janela. Exigência:
   zero divergência.
4. **Latência:** p50 e p95 de `durationMs`, separadas por modo. Não existe SLA
   comercial aprovado; os limites técnicos de alerta abaixo evitam ocultar
   regressões.
5. **Freshness:** `agora - lastSuccessAt`, comparado à cadência oficial `C`.
   Esse SLI permanece desabilitado enquanto `C` não for formalmente aprovado.
6. **Conformidade de autenticação:** requests não autorizados, inválidos e
   rate-limited devem permanecer fora das janelas válidas de canário.

## Alertas e limiares

### Críticos: interromper promoção ou iniciar rollback

| Condição                                                     | Janela    | Ação                                                                    |
| ------------------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| Qualquer `comparisonStatus=mismatch` ou `legacy_run_missing` | 1 evento  | Zerar janelas, manter/retornar a `shadow`, reconciliar antes de repetir |
| Qualquer `database_unavailable` em `canary` ou `active`      | 1 evento  | Colocar aplicação em `off`; preservar ledger; investigar banco/ACL      |
| Qualquer HTTP `5xx` em `canary`                              | 1 evento  | Falhar a janela e não promover                                          |
| Qualquer HTTP `409` em `canary` ou `active`                  | 1 evento  | Suspender publisher; verificar nonce, request ID e idempotência         |
| Divergência de contagem ou hash contra o manifesto           | 1 janela  | Bloquear escrita seguinte e abrir incidente de integridade              |
| Sucesso observado com configuração declarada `off`           | 1 evento  | Tratar como bypass de controle; desabilitar credential e gate           |
| Duração individual acima de 30 segundos                      | 1 request | Bloquear promoção; investigar timeout, lock ou volume                   |
| Ausência de sucesso por mais de `3 × C` em `active`          | contínua  | Colocar relay em `off` e executar rollback aprovado                     |

### Altos: investigar sem promover

| Condição                                                                      | Janela                        | Ação                                                            |
| ----------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Cinco ou mais `unauthorized`                                                  | 5 minutos                     | Investigar credential inválida, relógio ou tentativa de abuso   |
| Três ou mais `invalid_payload`, `invalid_content_type` ou `payload_too_large` | 5 minutos                     | Verificar contrato do produtor; não ampliar limites             |
| Qualquer `rate_limited` em `canary` ou `active`                               | 1 evento                      | Suspender próxima janela e revisar cadência/credential aprovada |
| Sucesso de escrita abaixo de `99%`                                            | últimos 10 requests elegíveis | Manter gate atual; não promover                                 |
| p95 acima de 5 segundos                                                       | últimos 10 requests elegíveis | Investigar capacidade antes da próxima promoção                 |
| Ausência de sucesso por mais de `2 × C` em `active`                           | contínua                      | Alertar owner e backup owner; preparar rollback                 |

`C` é a cadência assinada pelo owner. O alerta de freshness não pode usar uma
média histórica ou valor presumido. Se não houver dez requests elegíveis, a
regra por evento continua valendo e a regra agregada permanece sem amostra
suficiente.

Nenhum alerta pode ser considerado operacional até possuir destino testado
para owner e backup owner. Sem os dois destinos, ativação é bloqueada.

## Gates antes de shadow

Todos os itens precisam estar concluídos:

- caller técnico correlacionado com a carga legada;
- owner operacional e backup owner distintos com aceite formal;
- approver, evidência e referência de rollback registrados;
- backup remoto identificado, íntegro e restaurado com sucesso em ambiente
  isolado;
- restore rehearsal comprova migrations, grants, RLS, contagens e rollback;
- papel dedicado ainda `NOLOGIN` até o provisionamento autorizado;
- credential M2M e credential DB produzidas por canal privado, distintas de
  qualquer segredo Supabase;
- limite por minuto e cadência `C` aprovados, sem derivação automática;
- dry-run de mappings com conflitos explícitos e zero associação presumida;
- testes Vitest, pgTAP, lint, typecheck, build e auditorias verdes;
- coletor de eventos e destino dos alertas testados sem headers sensíveis;
- nenhum hardening destrutivo aplicado.

Se qualquer item falhar, manter `QLIK_RELAY_MODE=off`,
`QLIK_RELAY_WRITE_ENABLED=false`, credential desabilitada e gate ausente ou
`disabled`.

## Execução shadow

Shadow é comparação, não escrita de fatos Qlik.

1. Confirmar novamente backup, owners, alertas e rollback.
2. Em mudança remota futura autorizada, provisionar credential e gate no estado
   `shadow`.
3. Configurar `QLIK_RELAY_MODE=shadow` e
   `QLIK_RELAY_WRITE_ENABLED=false`.
4. Encaminhar ao relay o mesmo envelope completo publicado pelo caminho legado,
   sem remover ou alterar ainda o publisher legado.
5. Para cada janela, comparar request ID, ano, timestamps, contagens e hashes
   ordenados de entries/developments.
6. Exigir `matched` para dois request IDs distintos e consecutivos.
7. Em qualquer mismatch, zerar evidência, retornar a `off` se houver dúvida e
   reconciliar a fonte; nunca corrigir fatos manualmente.

Uma janela corresponde a um snapshot completo na cadência oficial `C`. Reenvio
do mesmo request ID não conta como janela adicional.

## Execução canary

Canário opera por snapshot completo; não divide linhas de um snapshot atômico.

1. Confirmar duas janelas shadow `matched` e evidência anexada.
2. Executar dry-run final de mappings e confirmar zero conflito não resolvido.
3. Exercitar rollback antes de habilitar escrita.
4. Em mudança futura autorizada, mover gate para `canary`, configurar
   `QLIK_RELAY_MODE=canary` e `QLIK_RELAY_WRITE_ENABLED=true`.
5. Liberar uma única execução agendada completa; impedir disparo concorrente.
6. Validar HTTP, ledger, run, contagens, hashes, idempotência, escopo e ausência
   de acesso direto.
7. Observar a janela completa e todos os alertas antes da próxima execução.
8. Repetir para uma segunda janela consecutiva.

Critério de saída: duas janelas canário com sucesso de escrita `100%`, zero
divergência, zero `409`, zero `429`, zero `5xx` e rollback ainda executável.

## Promoção para active

Promoção exige nova autorização explícita:

1. anexar evidências das duas janelas shadow e duas canário;
2. registrar aceite de owner, backup owner e approver;
3. confirmar backup/restore e observabilidade ainda válidos;
4. mover o gate DB para `cutover`;
5. configurar `QLIK_RELAY_MODE=active` e
   `QLIK_RELAY_WRITE_ENABLED=true`;
6. observar as duas primeiras janelas active com os mesmos critérios do
   canário;
7. somente depois avaliar, em mudança separada, rotação dos literais antigos e
   hardening destrutivo.

O hardening final não faz parte do canário e nunca pode ser usado como teste de
rollback.

## Rollback

### Antes do hardening legado

1. Colocar a aplicação em `QLIK_RELAY_MODE=off`.
2. Mover o gate para `rolled_back` e desabilitar a credential, mediante
   autorização remota.
3. Preservar ledger, runs e evidências; não apagar nem editar fatos.
4. Restaurar o publisher legado somente conforme referência de rollback já
   aprovada e confirmar uma janela completa.
5. Corrigir relay ou mapping por mudança aditiva; repetir shadow desde zero.

### Depois do hardening legado

Não restaurar `anon`, verificador em argumento, grants de tabela ou
`service_role`. Colocar relay em `off`, aceitar indisponibilidade controlada,
preservar o último snapshot válido e corrigir por migration/versão revisada.

Alterar o papel para `NOLOGIN` impede novas conexões e faz a wrapper rejeitar
também uma sessão dedicada já aberta, porque ela revalida `rolcanlogin` a cada
request. Isso não encerra a sessão PostgreSQL; encerrá-la é operação remota
destrutiva separada e requer autorização explícita.

## Evidência mínima por janela

- SHA da aplicação e migrations;
- modo e estado do gate, sem valores de credential;
- timestamps UTC de início/fim;
- request ID e hashes sanitizados;
- contagens de entries/developments;
- resultado shadow/canary/active e idempotência;
- agregados da health RPC;
- alertas disparados ou confirmação de zero alerta;
- decisão assinada de avançar, repetir ou fazer rollback.

O pacote final também deve conter prova de restore, aceite de owner/backup owner
e resultado do exercício de rollback. Sem esse conjunto, nenhuma promoção é
válida.
