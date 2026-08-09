# Supabase proof and RLS hardening package

Pacote produzido em 2026-08-09, exclusivamente com diagnóstico remoto de
leitura e validação local/isolada. Nenhuma migration, alteração de dados,
revogação, deploy ou mudança de integração foi executada no projeto remoto.

## Evidências

- [`REMOTE_PROOF.md`](./REMOTE_PROOF.md): inventário remoto, migrations,
  grants, policies e consumidores.
- [`REMOTE_DDL_SANITIZED.sql`](./REMOTE_DDL_SANITIZED.sql): DDL remoto
  sanitizado. É fotografia do estado observado, não histórico autoritativo.
- [`REMOTE_INVENTORY.json`](./REMOTE_INVENTORY.json): inventário canônico sem
  dados comerciais nem corpos sensíveis de funções.
- [`BACKUP_RESTORE_EVIDENCE.md`](./BACKUP_RESTORE_EVIDENCE.md): backup oficial,
  restore isolado, checksums, contagens e pgTAP.
- [`MIGRATION_DIFFERENCES.md`](./MIGRATION_DIFFERENCES.md): diferenças
  local/remoto e baseline proposta.
- [`RLS_HARDENING_MATRIX.md`](./RLS_HARDENING_MATRIX.md): modelo de onboarding,
  escopos e matriz de negação.
- [`SERVICE_ROLE_MIGRATION_PLAN.md`](./SERVICE_ROLE_MIGRATION_PLAN.md):
  consumidores privilegiados, cutover e rollback.
- [`QA_ACCOUNT_PLAN.md`](./QA_ACCOUNT_PLAN.md): contas e dados sintéticos.
- [`COMMERCIAL_DECISION_PACKAGE.md`](./COMMERCIAL_DECISION_PACKAGE.md):
  evidências, conflitos e decisões comerciais ainda bloqueantes.
- [`RISKS_ROLLBACK_NEXT_GATE.md`](./RISKS_ROLLBACK_NEXT_GATE.md): riscos,
  rollback e próximo gate.

## Artefatos versionados

As migrations deste incremento são somente propostas locais. Não devem ser
aplicadas remotamente sem novo gate, backup contemporâneo, reconciliação de
identidades, cutover do caller Qlik e autorização explícita.

- `20260809144137_pending_onboarding_scope_foundation.sql`
- `20260809144143_qlik_rls_contract_hardening.sql`
