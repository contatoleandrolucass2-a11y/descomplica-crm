import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GOAL_PROFILES,
  GOAL_RATE_FIELDS,
  GOAL_STAGES,
  getEffectiveMonth,
  getVisibleStageOffset,
} from "../lib/crm/goals/catalog";
import { getGoalsReferenceDate } from "../lib/crm/goals/reference";

afterEach(() => vi.unstubAllEnvs());

describe("funnel goal catalog", () => {
  it("keeps both migrated profile routes in the catalog", () => {
    expect(Object.keys(GOAL_PROFILES)).toEqual(["dv", "partnerships"]);
    expect(GOAL_PROFILES.partnerships.href).toBe("/app/configuracoes/metas/parcerias");
  });

  it("preserves the complete six-stage funnel and five conversion rates", () => {
    expect(GOAL_STAGES).toHaveLength(6);
    expect(GOAL_RATE_FIELDS).toHaveLength(5);
    expect(GOAL_STAGES.at(-1)?.key).toBe("sales");
  });

  it("starts partnerships at visits", () => {
    const offset = getVisibleStageOffset("partnerships");
    expect(GOAL_STAGES.slice(offset)[0]?.key).toBe("visits");
    expect(getVisibleStageOffset("dv")).toBe(0);
  });

  it("resolves the effective month in the application timezone", () => {
    expect(getEffectiveMonth(new Date("2026-09-01T01:30:00Z"))).toBe("2026-08-01");
    expect(getEffectiveMonth(new Date("2026-09-01T03:30:00Z"))).toBe("2026-09-01");
  });

  it("freezes visual goal fixtures only in explicit loopback QA", () => {
    const current = new Date("2026-09-01T12:00:00.000Z");
    expect(getGoalsReferenceDate(() => current)).toBe(current);

    vi.stubEnv("QA_VISUAL_GOALS_REFERENCE_TIME", "2026-08-27T01:21:00.000Z");
    expect(() => getGoalsReferenceDate()).toThrow(/QA local isolado/u);

    vi.stubEnv("AUTH_LOCAL_INSECURE_LOOPBACK_QA", "true");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:4173");
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    expect(getGoalsReferenceDate().toISOString()).toBe("2026-08-27T01:21:00.000Z");
  });
});
