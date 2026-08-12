# Ingestão do ranking Qlik

## Estado comprovado

O publisher ativo é o workflow n8n `r4DyPyOTDtoROXq0` (`ranking imobs`), com
agenda de 30 minutos. A versão ativa observada foi
`969edbee-d8ca-4a13-a91b-24bd7decbe59`. Entre 484 workflows inspecionados, foi
o único a referenciar simultaneamente o projeto CRM e a RPC legada. A amostra
correlacionou 27 de 27 execuções bem-sucedidas com runs `succeeded`; uma
execução com erro não criou run.

O node publisher usa autenticação `none` e headers literais equivalentes ao
papel `anon`. O owner técnico observado é Leandro Lucas (`global:owner`), mas
owner operacional e backup formal distintos ainda não foram nomeados. Leituras
`GET` residuais das tabelas Qlik seguem sem atribuição. Valores de credencial
não foram lidos para este documento.

O upstream `qlik-ranking-api.service` produz o snapshot, mas não possui cliente
Supabase nem acesso PostgreSQL; ele não é o caller do banco.

## Contratos durante a transição

O caminho legado remoto continua ativo até cutover aprovado:

```text
publish_crm_imob_ranking(jsonb, text)
```

Ele não é autoridade comercial e não deve ser copiado. A ponte aditiva preserva
essa função somente para evitar interrupção antes do relay.

O novo limite HTTP é:

```text
POST /api/ingest/qlik
```

O endpoint fica `off` por padrão. Quando configurado, exige HMAC-SHA256 sobre
método, path fixo, timestamp UTC, nonce UUID v4 e SHA-256 dos bytes exatos do
body. Ele valida 1 MB máximo, janela de cinco minutos, JSON/Zod estrito e replay
antes de usar uma URL PostgreSQL dedicada. O banco permite ao papel
`crm_qlik_relay` somente:

```text
qlik_relay.ingest_snapshot(jsonb, text, text, timestamptz, text, text)
```

O papel não recebe tabelas, sequências, `service_role`, `BYPASSRLS` ou outras
RPCs. A migration o cria `NOLOGIN`; senha/login são provisionamento privado e
separadamente autorizado.

## Modos

| Runtime  | Write flag | Gate privado | Efeito                                              |
| -------- | ---------- | ------------ | --------------------------------------------------- |
| `off`    | `false`    | qualquer     | `503` antes de ler body ou abrir banco              |
| `shadow` | `false`    | `shadow`     | compara hashes/contagens; não grava fatos           |
| `canary` | `true`     | `canary`     | escreve pela RPC existente após duas janelas iguais |
| `active` | `true`     | `cutover`    | publisher principal após aprovação                  |

Credencial habilitada, dois owners ativos, validade e rate cap são requisitos
independentes. Flag sem gate ou gate sem flag falha fechado.

## Payload

O contrato v1 contém `requestId`, ano, timestamps, `entries` e
`developments`. O relay reutiliza o schema estrito existente e não deriva
valores. No shadow, compara os fatos do body com o run legado do mesmo
`requestId`; replay idêntico é noop e conteúdo diferente com nonce/request ID
reutilizado é conflito.

## Troca segura

Não executar sem autorização de migration, n8n, canário e deploy:

1. aplicar a fundação com flags desligadas e confirmar que o legado continua;
2. nomear owner operacional e backup, provisionar credenciais privadas e gate
   inicialmente desabilitado;
3. preparar candidata n8n inativa que assina o body exato, sem guardar valores
   em node, export ou log;
4. em shadow, publicar primeiro no legado e depois comparar pelo relay;
5. exigir duas janelas agendadas distintas com `matched`;
6. executar um canário único somente pelo relay e reconciliar run, contagens,
   hashes e leituras autorizadas;
7. ampliar somente após aprovação; preservar o legado pausado para rollback;
8. rotacionar literais e limpar histórico apenas depois da estabilidade;
9. remover a RPC legada em migration destrutiva separada.

O procedimento detalhado está em
[`docs/qlik-relay-mapping-cutover/CUTOVER_AND_ROLLBACK.md`](../qlik-relay-mapping-cutover/CUTOVER_AND_ROLLBACK.md).

## Rollback

Desligar runtime e gate, desabilitar a credencial, pausar a candidata e retomar
o workflow legado verificado. Preservar runs, ledger e auditoria. Nunca conceder
CRUD direto, distribuir `service_role`, apagar fatos ou restaurar segredo
exposto como atalho.
