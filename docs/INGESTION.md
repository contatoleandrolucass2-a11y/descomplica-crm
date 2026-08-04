# Ingestão e atualização Salesforce

## Fronteiras

O Gate 2 substitui os três endpoints legados sem copiar Cloudflare, D1 ou o fallback n8n fixo:

| Endpoint                       | Autenticação                           | Limites principais                                        |
| ------------------------------ | -------------------------------------- | --------------------------------------------------------- |
| `GET /api/dashboard/status`    | sessão + `crm.dashboard.view`          | resposta mínima, `no-store`, sem acesso direto à tabela   |
| `POST /api/refresh/salesforce` | sessão + `crm.salesforce.refresh`      | mesma origem, lock global, cooldown de 60 s, timeout 15 s |
| `POST /api/ingest/salesforce`  | Bearer M2M com no mínimo 32 caracteres | corpo de 1 MB, Zod, idempotência, 20 snapshots/minuto     |

Os Route Handlers nunca retornam tokens, URLs internas, resposta do provedor ou detalhes SQL. O refresh aceita somente URL configurada por ambiente; em produção ela deve usar HTTPS e não pode conter credenciais embutidas.

Ingestão e refresh são capacidades independentes. Ambas ficam desativadas por
padrão e exigem o valor literal `true` em sua flag server-side. Desativadas ou
mal configuradas, retornam `503` antes de criar clientes privilegiados, iniciar
runs ou fazer chamadas externas.

## Contrato de ingestão

O produtor envia JSON com `schemaVersion: 1`, `requestId` UUID, `workflow` e um snapshot normalizado de dashboard. Ranking é opcional, mas, quando presente, deve usar a mesma data de referência e instante de geração.

O dashboard exige:

- exatamente as três visões `all`, `with_canal_imob` e `without_canal_imob`;
- exatamente as 15 combinações entre três visões e cinco etapas;
- valores e contagens não negativos;
- no máximo cinco empreendimentos por visão;
- snapshot `global` ou outra chave no formato documentado.

O ranking aceita até 2.000 linhas únicas por período/corretor e os períodos `month`, `last_week`, `week` e `today`. O contrato TypeScript completo está em `lib/crm/ingestion/schema.ts`.

## Persistência

`ingest_crm_salesforce_snapshot` executa como uma única transação:

1. adquire lock de ingestão;
2. rejeita replay antigo e snapshot mais velho que o armazenado;
3. limita globalmente a 20 novos snapshots por minuto e cria `crm_ingestion_runs` por `requestId` único;
4. substitui os filhos normalizados do dashboard e, se enviado, do ranking;
5. conclui o run e grava evento de auditoria sem payload comercial.

Repetir o mesmo `requestId` não regrava dados. Falha de constraint desfaz todas as mudanças do read model e preserva somente um run `failed` com código sanitizado.

A secret key Supabase fica confinada a `lib/auth/supabase/privileged.ts` e chama somente a RPC de ingestão. Navegadores não recebem grant na tabela de runs nem execução nessa RPC.

## Refresh

O controle aparece apenas para quem possui `crm.salesforce.refresh`. Quando a
capacidade está desativada ou incompleta, ele fica desabilitado com mensagem
neutra. Ativado e configurado, o banco serializa pedidos concorrentes, encerra
runs presos após cinco minutos e aplica cooldown por usuário. O webhook recebe
somente `requestId` e `requestedAt`, mais o Bearer dedicado.

Status HTTP do provedor não é repassado livremente: sucesso retorna `202`, concorrência/cooldown retorna `409`/`429`, configuração ausente retorna `503` e falha do provedor retorna erro genérico `502`.

## Variáveis e rotação

```dotenv
APP_ORIGIN=https://homologacao.exemplo.com
SALESFORCE_INGEST_ENABLED=false
SALESFORCE_REFRESH_ENABLED=false
SUPABASE_SECRET_KEY=
SALESFORCE_INGEST_SECRET=
SALESFORCE_REFRESH_URL=
SALESFORCE_REFRESH_SECRET=
```

Com a flag de ingestão em `true`, `SUPABASE_SECRET_KEY` e
`SALESFORCE_INGEST_SECRET` tornam-se obrigatórias. Com a flag de refresh em
`true`, a URL HTTPS sem credenciais e `SALESFORCE_REFRESH_SECRET` tornam-se
obrigatórias. Configuração parcial falha fechada. Cada ambiente usa valores
distintos; a rotação ocorre no produtor/webhook e no runtime, seguida de restart
controlado e smoke test. Nenhum valor entra no Git, em logs ou em imagens.

## Validação local

- 34 testes pgTAP cobrem grants, RLS, RPCs, auditoria, locks/cotas, ingestão, replay e snapshot antigo.
- Vitest cobre schema completo, identidades duplicadas, alinhamento dashboard/ranking, segredo, origem e URL HTTPS.
- QA local verificou `401` sem sessão/segredo, `201` na ingestão, `200` no replay, `202` no refresh e `429` no segundo pedido.

Nenhuma URL, credencial ou base externa de produção foi usada nessa validação.
