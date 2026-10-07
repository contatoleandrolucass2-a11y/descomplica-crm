import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20261005234936_reconcile_roles_dashboard_views_and_bulk_overrides.sql";
const migration = readFileSync(migrationPath, "utf8");

describe("segurança da reconciliação de papéis", () => {
  it("preserva os grants existentes do Master sem herdar todo o catálogo", () => {
    const deleteBaseline = migration.match(
      /delete from public\.role_permissions[\s\S]*?where role_key in \(([\s\S]*?)\);/,
    )?.[1];
    const requestedBaseline = migration.match(
      /from \(\s*values([\s\S]*?)\) as requested\(role_key, permission_key\)/,
    )?.[1];

    expect(deleteBaseline).toBeDefined();
    expect(deleteBaseline).not.toMatch(/'master'/);
    expect(requestedBaseline).toBeDefined();
    expect(requestedBaseline?.match(/\('master',\s*'([^']+)'\)/g)).toEqual([
      "('master', 'crm.dashboard.all.view')",
      "('master', 'crm.dashboard.with_canal_imob.view')",
      "('master', 'crm.dashboard.without_canal_imob.view')",
      "('master', 'crm.partnerships.view')",
    ]);
    expect(migration).not.toMatch(
      /select\s+'master'\s*,\s*permission\.key\s+from\s+public\.permissions/i,
    );
  });

  it("não amplia o Master para permissões futuras ou motores comerciais", () => {
    const requestedBaseline = migration.match(
      /from \(\s*values([\s\S]*?)\) as requested\(role_key, permission_key\)/,
    )?.[1];

    expect(requestedBaseline).not.toMatch(
      /\('master',\s*'crm\.(?:read_model_v3|commercial_engine|commercial_policy)[^']*'\)/,
    );
  });

  it("revalida o escopo depois de bloquear o perfil alvo", () => {
    const functionBody = migration.match(
      /create or replace function public\.set_user_permission_overrides_bulk\([\s\S]*?\n\$\$;/,
    )?.[0];
    const targetLock = functionBody?.indexOf(
      "where profile.user_id = target_user_id\n  for update;",
    );
    const scopeChecks = [
      ...(functionBody?.matchAll(/execute 'select private\.can_manage_user\(\$1\)'/g) ?? []),
    ].map((match) => match.index);

    expect(functionBody).toBeDefined();
    expect(targetLock).toBeGreaterThan(-1);
    expect(scopeChecks).toHaveLength(2);
    expect(scopeChecks[0]).toBeLessThan(targetLock ?? -1);
    expect(scopeChecks[1]).toBeGreaterThan(targetLock ?? Number.MAX_SAFE_INTEGER);
  });
});
