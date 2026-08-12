import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  commercialConfigurationDraftPlanSchema,
  funnelGoalsDraftPayloadSchema,
  pointSettingsDraftPayloadSchema,
} from "@/lib/crm/commercial-engine/drafts";

const zeroGoalValues = {
  sales: "0",
  opportunitiesRate: "0",
  appointmentsRate: "0",
  visitsRate: "0",
  foldersRate: "0",
  approvedFoldersRate: "0",
  brokerMinimumMonth1: "0",
  brokerMinimumMonth2: "0",
  brokerMinimumMonth3: "0",
  brokerMinimumMonth4Plus: "0",
  brokerWeeklyAppointments: "0",
  brokerWeeklyVisits: "0",
  brokerWeeklyFolders: "0",
  productiveTeamAppointments: "0",
  productiveTeamVisits: "0",
  productiveTeamFolders: "0",
  productiveTeamSales: "0",
};

const zeroPointValues = {
  roulette: "0",
  roulette_saturday: "0",
  roulette_sunday: "0",
  schedule: "0",
  visit: "0",
  approved_folder: "0",
  sale: "0",
};

describe("inactive commercial configuration drafts", () => {
  it("accepts only the closed goals and points draft shapes", () => {
    expect(
      funnelGoalsDraftPayloadSchema.safeParse({
        schemaVersion: 1,
        kind: "funnel-goals",
        profile: "dv",
        effectiveMonth: "2026-08-01",
        values: zeroGoalValues,
      }).success,
    ).toBe(true);
    expect(
      pointSettingsDraftPayloadSchema.safeParse({
        schemaVersion: 1,
        kind: "point-settings",
        weights: zeroPointValues,
        targets: zeroPointValues,
        unofficialOverride: true,
      }).success,
    ).toBe(false);
  });

  it("requires every activation blocker in a valid preview response", () => {
    const parsed = commercialConfigurationDraftPlanSchema.parse({
      ok: true,
      mode: "preview",
      valid: true,
      activationReady: false,
      reasonCode: null,
      engineKey: "goals.dv",
      payloadHash: "a".repeat(64),
      planHash: "b".repeat(64),
      currentRevision: 0,
      nextRevision: 1,
      blockers: [
        "official_policy",
        "owner",
        "backup_owner",
        "golden_cases",
        "approval",
        "cohort_and_grant",
        "effective_date",
        "rollback",
      ],
    });
    expect(parsed.activationReady).toBe(false);
    expect(parsed.blockers).toHaveLength(8);
  });

  it("removes direct legacy writes from both configuration actions", () => {
    const goalsAction = readFileSync("app/(protected)/app/configuracoes/metas/actions.ts", "utf8");
    const pointsAction = readFileSync(
      "app/(protected)/app/configuracoes/metas/pontos/actions.ts",
      "utf8",
    );

    expect(goalsAction).not.toContain("upsert_crm_funnel_goals");
    expect(pointsAction).not.toContain("replace_crm_point_settings");
    expect(goalsAction).toContain("preview_crm_commercial_configuration_draft");
    expect(pointsAction).toContain("save_crm_commercial_configuration_draft");
  });

  it("keeps the production ranking fail-closed without policy authority", () => {
    const rankingData = readFileSync("lib/crm/ranking/data.ts", "utf8");
    expect(rankingData).toContain('status: "policy_pending"');
    expect(rankingData).toContain("return false");
    expect(rankingData).not.toContain("COMMERCIAL_ENGINE_RUNTIME_MODE=active");
  });

  it("keeps the app readable before the additive draft foundation exists", () => {
    const draftLoader = readFileSync("lib/crm/commercial-engine/draft-data.ts", "utf8");
    const usersPage = readFileSync("app/(protected)/admin/usuarios/page.tsx", "utf8");

    expect(draftLoader).toContain('error?.code === "PGRST202"');
    expect(draftLoader).not.toContain("if (error) return null");
    expect(usersPage).toContain("isMissingOnboardingFoundation");
    expect(usersPage).toContain('access_status: "legacy_review"');
    expect(usersPage).toContain("scopesResult.error && !isMissingOnboardingFoundation");
  });
});
