# Integrações encontradas

## Supabase

A base final usa Auth, PostgreSQL, RLS e SDK SSR. A configuração pública aceita somente URL e publishable key. Secret/service role fica fora do bundle.

## Cloudflare D1/Wrangler

Encontrados no CRM original: plugins Cloudflare/Vite, Wrangler, Vinext, binding D1, `cloudflare:workers` e image optimizer do worker. Classificação: incompatível e exclusiva da arquitetura anterior. Será substituída por Next.js nativo e Supabase.

## Salesforce

O CRM original possui endpoint de refresh que usa credenciais server-side, mas não exige sessão/permissão. Na migração ele deverá ter autenticação, permissão dedicada, timeout, erros sanitizados, rotação de segredo e auditoria. Nenhuma chamada real foi executada durante a preparação.

## Ingestão/n8n

O CRM original possui endpoint com Bearer `INGEST_SECRET`, validação superficial e URL fallback hard-coded. A migração exigirá schema Zod, limite de tamanho, proteção contra replay/rate limit, destino configurado somente por ambiente, timeout e trilha de auditoria.

## APIs internas do CRM

- `goals`: usava publishable/anon key sem validar sessão/permissão.
- `points`: usava D1 sem autenticação/permissão.
- `dashboard/status`: misturava Supabase e fallback D1/demo.
- autenticação própria: redundante em relação à base de login e não será mantida.

Nenhuma integração externa, conta, cobrança ou ambiente remoto foi alterado nesta etapa.
