---
name: descomplica-dados-integracoes
description: Alterar ou diagnosticar backend, contratos, read models, Supabase, RLS, Qlik, Salesforce e n8n no DESCOMPLICA-CRM. Usar quando a origem, autorizacao ou conciliacao dos dados afeta o resultado.
---

# Dados e integracoes

- Consulte conhecimento por assunto e confirme a fonte atual em lib/crm,
  app/api, ops e supabase/migrations. Identifique leitura, ingestao e autoridade.
- Use as skills Supabase disponiveis antes de trabalho Supabase. Nao conecte um
  projeto remoto pelo nome apenas: confirme ambiente e identidade.
- Distinga indisponivel, nao configurado, vazio, bloqueado por politica e dado
  real. Verifique lib/crm/source-availability.ts; nao desbloqueie por suposicao.
- Para estoque, leia docs/runbooks/inventory-performance.md: autorizacao antes
  do cache, escopo dos dados, no-store, timeout e enriquecimento comercial.
- Para Qlik e Salesforce, leia apenas o runbook correspondente em docs/runbooks.
  Preserve RPC versionada, idempotencia, proveniencia e conciliacao de identidades.
- Migrations sao a fonte versionada. ACL/RLS exige pgTAP com papeis permitidos
  e negados; permissao visual nao autoriza acesso direto a tabelas.
- N8n existente: MCP exclusivamente, validate_workflow_code, update_workflow,
  releitura. Se MCP falhar ou faltar, pare essa mutacao; nao use REST como fallback.
- Nao execute refresh, ingestao, alteracao remota ou coleta de dados pessoais
  para diagnosticar sem autorizacao aplicavel. Use fixtures sinteticas.
- Entregue contratos afetados, compatibilidade, testes e lacunas operacionais.
