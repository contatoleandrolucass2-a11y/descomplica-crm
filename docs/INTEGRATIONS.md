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

O produtor de produção usa a Analytics Reports API `v61.0` por uma sessão do
Chrome aprovada com MFA. A frequência de 30 minutos não renova nem contorna o
MFA: quando o cookie `sid` expirar, o exportador falha fechado e exige novo
login interativo. A candidata versionada em `ops/salesforce` consulta os sete
relatórios autorizados, preserva os `recordId` existentes somente em memória e
descarta CPF, CNPJ, banco, telefone, e-mail e endereço antes de criar o snapshot
agregado.

## Ingestão/n8n

O fallback fixo para n8n foi removido da aplicação. O endpoint recebe contrato
normalizado versionado, Bearer dedicado, limite de 1 MB e validação Zod estrita;
a RPC Supabase persiste em transação, aplica idempotência e rejeita snapshot
antigo. O workflow de migração permanece inativo até receber credenciais
dedicadas e passar pela reconciliação descrita em
`docs/runbooks/salesforce-n8n-migration.md`. Detalhes do contrato ficam em
`docs/INGESTION.md`.

## Qlik / ranking de imobiliárias

O projeto remoto contém três tabelas para histórico de ranking de imobiliárias:
`crm_imob_ranking_runs`, `crm_imob_ranking_entries` e
`crm_imob_ranking_developments`. A rota do Canal de Parcerias não consulta
diretamente esses dados.

A investigação do drift posterior identificou o executor exato: uma sessão interativa do conector Supabase/Codex executou `GRANT SELECT` e `ALTER POLICY` por `POST /mcp`. O exportador Qlik não possui cliente PostgreSQL/Supabase nem DDL; o workflow n8n observado não contém DDL, nunca iniciou uma execução e aponta ao projeto Supabase anterior.

`ingest_crm_imob_ranking_snapshot(jsonb)` é o contrato local pretendido: valida
e grava um snapshot completo em transação, aceita replay idêntico e rejeita
reutilização conflitante. A captura de 9 de agosto confirmou que essa RPC não
existe remotamente. Em seu lugar, o remoto mantém
`publish_crm_imob_ranking(jsonb,text)` com verifier embutido, `EXECUTE` para
`anon` e `service_role`, leitura anônima e CRUD direto de `service_role` nas três
tabelas. Nenhum desses grants é autoridade segura. O plano está em
[`docs/reconciliation/MIGRATION_MATRIX.md`](reconciliation/MIGRATION_MATRIX.md)
e o procedimento futuro continua em
[`docs/runbooks/qlik-ranking-ingestion.md`](runbooks/qlik-ranking-ingestion.md).

O mapa exaustivo de Salesforce, n8n, Qlik, dois escritores legados de estoque e
SLA está em
[`docs/reconciliation/INTEGRATION_CONTRACTS.md`](reconciliation/INTEGRATION_CONTRACTS.md).

## APIs internas do CRM

- `goals`: usava publishable/anon key sem validar sessão/permissão.
- `points`: usava D1 sem autenticação/permissão.
- `dashboard/status`: misturava Supabase e fallback D1/demo.
- autenticação própria: redundante em relação à base de login e não será mantida.

Nenhum usuário Auth, papel, grant, policy ou dado comercial é alterado pela
coleta candidata.
