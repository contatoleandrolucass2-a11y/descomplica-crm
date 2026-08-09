import { describe, expect, it } from "vitest";

import {
  buildReadModelV3Href,
  parseReadModelV3Filters,
  readModelV3FilterStateKey,
  toReadModelV3RpcFilters,
} from "@/lib/crm/read-model-v3/filters";
import { preserveSelectedFilterOption } from "@/app/(protected)/app/_components/ReadModelV3Filters";

const SCOPE = "10000000-0000-4000-8000-000000000001";
const ORGANIZATION = "20000000-0000-4000-8000-000000000001";
const TEAM = "30000000-0000-4000-8000-000000000001";

describe("read model v3 URL filters", () => {
  it("parses deterministic combined UUID filters", () => {
    const result = parseReadModelV3Filters({
      scope: SCOPE,
      period: "month",
      organizations: ORGANIZATION,
      teams: TEAM,
    });
    expect(result).toEqual({
      ok: true,
      selection: {
        scopeId: SCOPE,
        period: "month",
        from: null,
        to: null,
        dimensions: {
          organizations: [ORGANIZATION],
          teams: [TEAM],
          portfolios: [],
          coordinators: [],
          managers: [],
          brokers: [],
          origins: [],
          developments: [],
          locations: [],
        },
      },
    });
    if (!result.ok) throw new Error("expected valid filter");
    expect(toReadModelV3RpcFilters(result.selection)).toEqual({
      period: "month",
      organizationIds: [ORGANIZATION],
      teamIds: [TEAM],
    });
  });

  it("rejects malformed, repeated, duplicate and conflicting parameters", () => {
    expect(parseReadModelV3Filters({ scope: "global" }).ok).toBe(false);
    expect(parseReadModelV3Filters({ scope: [SCOPE, SCOPE] }).ok).toBe(false);
    expect(parseReadModelV3Filters({ scope: SCOPE, tenant: ORGANIZATION }).ok).toBe(false);
    expect(parseReadModelV3Filters({ organizations: `${ORGANIZATION},${TEAM}` }).ok).toBe(false);
    expect(parseReadModelV3Filters({ organizations: `${ORGANIZATION},${ORGANIZATION}` }).ok).toBe(
      false,
    );
    expect(parseReadModelV3Filters({ period: "month", from: "2026-08-01" }).ok).toBe(false);
    expect(
      parseReadModelV3Filters({ period: "custom", from: "2026-08-10", to: "2026-08-01" }).ok,
    ).toBe(false);
  });

  it("preserves scope and every selected dimension in generated links", () => {
    const parsed = parseReadModelV3Filters({
      scope: SCOPE,
      period: "week",
      organizations: ORGANIZATION,
      teams: TEAM,
    });
    if (!parsed.ok) throw new Error("expected valid filter");
    expect(buildReadModelV3Href("/app", parsed.selection, { period: "today" })).toBe(
      `/app?scope=${SCOPE}&period=today&organizations=${ORGANIZATION}&teams=${TEAM}`,
    );
  });

  it("encodes custom ranges only when both exclusive bounds are valid", () => {
    const parsed = parseReadModelV3Filters({
      scope: SCOPE,
      period: "custom",
      from: "2026-07-01",
      to: "2026-08-01",
    });
    if (!parsed.ok) throw new Error("expected valid filter");
    expect(toReadModelV3RpcFilters(parsed.selection)).toEqual({
      period: "custom",
      from: "2026-07-01",
      to: "2026-08-01",
    });
  });

  it("changes the client-form remount key whenever URL-backed state changes", () => {
    const month = parseReadModelV3Filters({
      scope: SCOPE,
      period: "month",
      organizations: ORGANIZATION,
    });
    const week = parseReadModelV3Filters({
      scope: SCOPE,
      period: "week",
      organizations: ORGANIZATION,
    });
    const cleared = parseReadModelV3Filters({ scope: SCOPE, period: "month" });
    if (!month.ok || !week.ok || !cleared.ok) throw new Error("expected valid filters");

    expect(readModelV3FilterStateKey(month.selection)).toBe(
      readModelV3FilterStateKey(month.selection),
    );
    expect(readModelV3FilterStateKey(week.selection)).not.toBe(
      readModelV3FilterStateKey(month.selection),
    );
    expect(readModelV3FilterStateKey(cleared.selection)).not.toBe(
      readModelV3FilterStateKey(month.selection),
    );
  });

  it("keeps a selected 101st option visible without exceeding the UI cap", () => {
    const options = Array.from({ length: 100 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      label: `Opção ${index}`,
    }));
    const selectedId = "00000000-0000-4000-8000-000000000100";
    const preserved = preserveSelectedFilterOption(options, selectedId);

    expect(preserved).toHaveLength(100);
    expect(preserved[0]).toEqual({ id: selectedId, label: "Seleção atual autorizada" });
    expect(preserved.some((option) => option.id === selectedId)).toBe(true);
  });
});
