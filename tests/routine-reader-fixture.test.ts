import { describe, expect, it } from "vitest";

// @ts-expect-error -- JavaScript runner exports SQL generators for focused contract checks.
import * as routineFixture from "../scripts/qa/local-authenticated-visual.mjs";

const { routineReaderCleanupSql, routineReaderSetupSql } = routineFixture;

const readerId = "11111111-1111-4111-8111-111111111111";
const editorId = "22222222-2222-4222-8222-222222222222";

function expectOrder(sql: string, statements: string[]) {
  let previous = -1;
  for (const statement of statements) {
    const position = sql.indexOf(statement);
    expect(position, `SQL dependency order: ${statement}`).toBeGreaterThan(previous);
    previous = position;
  }
}

describe("Ephemeral routine reader SQL contract (not a database execution)", () => {
  it("establishes a self-owned person scope before activating the approved broker", () => {
    const sql = routineReaderSetupSql({ readerId, editorId });
    expectOrder(sql, [
      "insert into public.crm_people",
      "insert into public.crm_teams",
      "insert into public.crm_team_memberships",
      "insert into public.crm_reporting_scopes",
      "update public.user_roles",
      "insert into public.crm_user_reporting_scope_grants",
      "update public.profiles",
      "private.user_role_scope_is_valid(p.user_id, r.role_key)",
      "commit;",
    ]);
    expect(sql).toContain("display_name, auth_user_id)");
    expect(sql).toContain(`'Synthetic routine reader', '${readerId}'::uuid)`);
    expect(sql).toContain(`'person', '${readerId}'::uuid)`);
    expect(sql).toContain(`values ('${readerId}'::uuid, '${readerId}'::uuid, '${editorId}'::uuid,`);
    expect(sql).toContain("set role_key = 'broker_house'");
    expect(sql).toContain(
      "u.raw_app_meta_data->>'qa_ephemeral' = 'true' and r.role_key = 'pending'",
    );
    expect(sql).not.toMatch(
      /disable trigger|session_replication_role|insert into public.role_permissions/i,
    );
  });

  it("suspends the reader and removes only its topology before Auth deletion", () => {
    const sql = routineReaderCleanupSql({ readerId });
    expectOrder(sql, [
      "update public.profiles set is_active = false",
      "delete from private.crm_reporting_scope_grant_lineage",
      "delete from public.crm_user_reporting_scope_grants",
      "delete from public.crm_reporting_scopes",
      "delete from public.crm_team_memberships",
      "delete from public.crm_people",
      "delete from public.crm_teams",
      "commit;",
    ]);
    expect(sql).toContain(`where user_id = '${readerId}'::uuid`);
    expect(sql).toContain(
      `where person_id = '${readerId}'::uuid and team_id = '${readerId}'::uuid`,
    );
    expect(sql.match(/and (scope|person|team)_key = 'qa-reader-'/g)).toHaveLength(3);
    expect(sql).not.toMatch(/delete from public.crm_organizations|disable trigger|truncate/i);
  });

  it("rejects shared identity and invalid IDs before producing executable SQL", () => {
    expect(() => routineReaderSetupSql({ readerId, editorId: readerId })).toThrow(/separate/);
    expect(() => routineReaderSetupSql({ readerId: "invalid'", editorId })).toThrow();
    expect(() => routineReaderSetupSql({ readerId, editorId: "invalid'" })).toThrow();
    expect(() => routineReaderCleanupSql({ readerId: "invalid'" })).toThrow();
  });
});
