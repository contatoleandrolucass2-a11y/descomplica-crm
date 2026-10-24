import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const coreMigration = readFileSync("supabase/migrations/20261024055603_crm_leads_core.sql", "utf8");
const foreignKeyIndexesMigration = readFileSync(
  "supabase/migrations/20261024224500_crm_lead_foreign_key_indexes.sql",
  "utf8",
);

describe("Lead legacy database compatibility", () => {
  it("uses only the production profile contract for workspace eligibility", () => {
    expect(coreMigration).toContain("from public.profiles p where p.user_id = p_user_id");
    expect(coreMigration).toContain("and p.is_active)");
    expect(coreMigration).not.toContain("access_status");
  });

  it("keeps Lead scopes independent from unpublished organization tables", () => {
    expect(coreMigration).toContain("public.crm_lead_workspaces");
    expect(coreMigration).toContain("public.crm_lead_workspace_members");
    expect(coreMigration).not.toContain("public.crm_organizations");
  });

  it("covers every Lead foreign key reported by the production advisor", () => {
    expect(foreignKeyIndexesMigration.match(/create index if not exists/g)).toHaveLength(34);
    expect(foreignKeyIndexesMigration).toMatch(/^begin;/);
    expect(foreignKeyIndexesMigration).toMatch(/commit;\s*$/);
  });
});
