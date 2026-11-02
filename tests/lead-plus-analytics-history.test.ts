import { describe, expect, it } from "vitest";
// @ts-expect-error Operational analytics ESM does not have TypeScript declarations.
import * as analytics from "../lib/crm/lead-plus/server/analytics.mjs";
const { analyticsHistoryScope, operationAnalytics } = analytics;

const users = [
  { id: "a", name: "Synthetic A", team: "A" },
  { id: "b", name: "Synthetic B", team: "B" },
];
const lead = (id: string, created_at: string, owner_id = "a", source = "manual") => ({
  id,
  created_at,
  owner_id,
  source,
  name: id,
  owner: owner_id,
  product: "Synthetic",
  stage: 3,
  archived: false,
  negotiation_type: "Compra",
  attribution: { queue_id: "queue" },
});
const leads = [
  lead("current-a", "2026-11-05T12:00:00.000Z"),
  lead("previous-a", "2026-10-15T12:00:00.000Z"),
  lead("old-a", "2026-09-01T12:00:00.000Z", "a", "old-source"),
  lead("current-b", "2026-11-05T12:00:00.000Z", "b"),
];
const activities = [
  { lead_id: "current-a", type: "note", created_at: "2026-11-05T12:00:00.000Z" },
  { lead_id: "current-a", type: "call", created_at: "2026-11-05T12:05:00.000Z" },
  { lead_id: "current-a", type: "whatsapp", created_at: "2026-11-05T12:06:00.000Z" },
  { lead_id: "previous-a", type: "call", created_at: "2026-10-15T12:10:00.000Z" },
  { lead_id: "old-a", type: "call", created_at: "2026-09-02T12:00:00.000Z" },
];
const events = [
  { entity_id: "current-a", detail: { from: 0, to: 1 }, created_at: "2026-11-05T13:00:00.000Z" },
  { entity_id: "current-a", detail: { from: 1, to: 3 }, created_at: "2026-11-06T12:00:00.000Z" },
  { entity_id: "previous-a", detail: { from: 0, to: 3 }, created_at: "2026-10-16T12:00:00.000Z" },
  { entity_id: "old-a", detail: { from: 0, to: 3 }, created_at: "2026-09-03T12:00:00.000Z" },
];

describe("analytics history cohort budget", () => {
  it.each(["", "a", "b"])(
    "keeps all output identical for owner %s with only relevant history",
    (owner) => {
      const filters = {
        from: "2026-11-01",
        to: "2026-11-30",
        team: "",
        owner,
        source: "",
        negotiation: "",
        queue: "",
      };
      const scope = analyticsHistoryScope({ leads, users, filters });
      expect(scope.ids).not.toContain("old-a");
      expect(scope.eventIds).not.toContain("previous-a");
      const firstContact = new Map();
      for (const activity of activities) {
        if (
          !scope.ids.includes(activity.lead_id) ||
          !["call", "whatsapp", "visit"].includes(activity.type)
        )
          continue;
        if (!firstContact.has(activity.lead_id)) firstContact.set(activity.lead_id, activity);
      }
      const common = {
        leads,
        users,
        filters,
        bucketIds: new Set(),
        now: Date.parse("2026-12-01T12:00:00.000Z"),
      };
      const baseline = operationAnalytics({ ...common, activities, events });
      const optimized = operationAnalytics({
        ...common,
        activities: [...firstContact.values()],
        events: events.filter((event) => scope.eventIds.includes(event.entity_id)),
      });
      expect(optimized).toEqual(baseline);
      expect(optimized.options.sources).toContain("old-source");
      if (owner !== "b") expect(scope.ids).toContain("previous-a");
    },
  );
});
