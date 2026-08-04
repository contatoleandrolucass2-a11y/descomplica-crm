import { describe, expect, it } from "vitest";

import {
  DEFAULT_POINT_WEIGHTS,
  EMPTY_POINT_TARGETS,
  POINT_METRICS,
} from "../lib/crm/points/catalog";

describe("point settings catalog", () => {
  it("preserves all seven metrics from the original CRM", () => {
    expect(POINT_METRICS).toHaveLength(7);
    expect(POINT_METRICS.map((metric) => metric.key)).toEqual([
      "roulette",
      "roulette_saturday",
      "roulette_sunday",
      "schedule",
      "visit",
      "approved_folder",
      "sale",
    ]);
  });

  it("preserves the original suggested weights without seeding the database", () => {
    expect(DEFAULT_POINT_WEIGHTS).toMatchObject({ roulette: 1, visit: 7, sale: 10 });
  });

  it("starts all comparison targets at zero", () => {
    expect(Object.values(EMPTY_POINT_TARGETS)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
