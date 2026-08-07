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

O projeto remoto recebeu diretamente duas tabelas para histórico de ranking de imobiliárias: `crm_imob_ranking_runs` e `crm_imob_ranking_entries`. Os metadados apontam para duas cargas Qlik concluídas em 6 de agosto de 2026, uma delas identificada como exportação histórica do Qlik Cloud. Não existe caller, função, view, trigger ou rota correspondente no repositório.

A migration de reconciliação versiona o DDL e a página `crm.partnerships`, preserva as linhas existentes e revoga os grants diretos de `anon`, `authenticated` e `service_role`. Nenhuma automação substituta é criada. Qualquer retomada dessa integração precisa de contrato de leitura/escrita próprio, RPC mínima, testes e autorização separada.

## APIs internas do CRM

- `goals`: usava publishable/anon key sem validar sessão/permissão.
- `points`: usava D1 sem autenticação/permissão.
- `dashboard/status`: misturava Supabase e fallback D1/demo.
- autenticação própria: redundante em relação à base de login e não será mantida.

Nenhum usuário Auth, papel, grant, policy ou dado comercial é alterado pela
coleta candidata.
