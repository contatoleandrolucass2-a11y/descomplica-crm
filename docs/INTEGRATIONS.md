# Integrações encontradas

## Supabase

A base final usa Auth, PostgreSQL, RLS e SDK SSR. A configuração pública aceita somente URL e publishable key. Secret/service role fica fora do bundle.

## Cloudflare D1/Wrangler

Encontrados no CRM original: plugins Cloudflare/Vite, Wrangler, Vinext, binding D1, `cloudflare:workers` e image optimizer do worker. Classificação: incompatível e exclusiva da arquitetura anterior. Será substituída por Next.js nativo e Supabase.

## Salesforce

Ingestão e refresh possuem flags server-side independentes e desativadas por
padrão. O refresh mantém sessão, `crm.salesforce.refresh`, validação de origem,
proteção de URL, lock, cooldown, timeout, erros sanitizados e auditoria. A URL
não tem fallback: deve vir do ambiente e usar HTTPS fora do desenvolvimento.
Com a capacidade desativada ou incompleta, nenhuma chamada externa ocorre.
Nenhuma chamada real de produção foi executada.

## Ingestão/n8n

O encaminhamento para n8n foi removido. O endpoint recebe contrato normalizado versionado, Bearer dedicado, limite de 1 MB e validação Zod estrita; a RPC Supabase persiste em transação, aplica idempotência e rejeita snapshot antigo. Detalhes em `docs/INGESTION.md`.

## APIs internas do CRM

- `goals`: usava publishable/anon key sem validar sessão/permissão.
- `points`: usava D1 sem autenticação/permissão.
- `dashboard/status`: misturava Supabase e fallback D1/demo.
- autenticação própria: redundante em relação à base de login e não será mantida.

Nenhuma integração externa, conta, cobrança ou ambiente remoto foi alterado nesta etapa.
