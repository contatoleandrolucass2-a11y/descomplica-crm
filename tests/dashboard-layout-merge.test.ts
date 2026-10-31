import { describe, expect, it } from "vitest";

import { APPOINTMENTS_CARD_LAYOUT_POLICY } from "@/lib/dashboard-canvas/layout/limits";
import { mergeDashboardLayout } from "@/lib/dashboard-canvas/persistence/merge-layout";
import type { DashboardCard } from "@/lib/dashboard-canvas/types";

function cards(): DashboardCard[] {
  return ["visits-total", "appointments-weekly", "appointments-goal"].map((id, order) => ({
    id,
    type: "bars",
    metric: id,
    period: "month",
    groupBy: "entity",
    entityIds: null,
    layout: { order, columnSpan: 3, width: 378, height: 530 },
  }));
}

function reordered(source: DashboardCard[], ids: number[]): DashboardCard[] {
  return ids.map((index, order) => ({
    ...source[index]!,
    layout: { ...source[index]!.layout, order },
  }));
}

describe("three-way dashboard layout merge", () => {
  it("preserves remote card edits while saving local chart dimensions exactly", () => {
    const base = cards();
    const local = cards();
    const remote = cards();
    local[1]!.layout.width = 269;
    local[1]!.layout.height = 583;
    remote[0]!.layout.width = 267;
    remote[0]!.layout.height = 383;
    const result = mergeDashboardLayout(base, local, remote, APPOINTMENTS_CARD_LAYOUT_POLICY);
    expect(result?.[0]?.layout).toMatchObject({ width: 267, height: 383 });
    expect(result?.[1]?.layout).toMatchObject({ width: 269, height: 583 });
    expect(base).toEqual(cards());
    expect(local[0]!.layout.width).toBe(378);
    expect(remote[1]!.layout.width).toBe(378);
  });

  it("combines local reorder and remote resize", () => {
    const base = cards();
    const local = reordered(cards(), [1, 0, 2]);
    const remote = cards();
    remote[1]!.layout.width = 269;
    const result = mergeDashboardLayout(base, local, remote);
    expect(result?.map(({ id }) => id)).toEqual(local.map(({ id }) => id));
    expect(result?.[0]?.layout).toEqual({ order: 0, columnSpan: 3, width: 269, height: 530 });
  });

  it("combines remote reorder and local resize", () => {
    const local = cards();
    local[0]!.layout.height = 383;
    const remote = reordered(cards(), [2, 1, 0]);
    const result = mergeDashboardLayout(cards(), local, remote);
    expect(result?.map(({ id }) => id)).toEqual(remote.map(({ id }) => id));
    expect(result?.[2]?.layout.height).toBe(383);
  });

  it("merges width and height independently on the same chart", () => {
    const local = cards();
    const remote = cards();
    local[1]!.layout.width = 269;
    remote[1]!.layout.height = 583;
    expect(mergeDashboardLayout(cards(), local, remote)?.[1]?.layout).toMatchObject({
      width: 269,
      height: 583,
    });
  });

  it("accepts identical concurrent dimensions and order", () => {
    const changed = reordered(cards(), [1, 0, 2]);
    changed[0]!.layout.width = 269;
    expect(mergeDashboardLayout(cards(), changed, structuredClone(changed))).toEqual(changed);
  });

  it("refuses divergent edits of the same width", () => {
    const local = cards();
    const remote = cards();
    local[1]!.layout.width = 269;
    remote[1]!.layout.width = 450;
    expect(mergeDashboardLayout(cards(), local, remote)).toBeNull();
  });

  it("refuses divergent concurrent reorders", () => {
    expect(
      mergeDashboardLayout(cards(), reordered(cards(), [1, 0, 2]), reordered(cards(), [2, 1, 0])),
    ).toBeNull();
  });

  it("preserves an unchanged layout without mutating or sharing layout objects", () => {
    const remote = cards();
    const result = mergeDashboardLayout(cards(), cards(), remote);
    expect(result).toEqual(remote);
    expect(result?.[0]?.layout).not.toBe(remote[0]?.layout);
  });

  it("preserves optional width additions and removals", () => {
    const base = cards();
    delete base[1]!.layout.width;
    expect(mergeDashboardLayout(base, cards(), base)?.[1]?.layout.width).toBe(378);
    const remote = cards();
    delete remote[1]!.layout.width;
    expect(mergeDashboardLayout(cards(), cards(), remote)?.[1]?.layout).not.toHaveProperty("width");
  });

  it("refuses added, removed, replaced or duplicate IDs", () => {
    expect(mergeDashboardLayout(cards(), cards().slice(1), cards())).toBeNull();
    expect(mergeDashboardLayout(cards(), [...cards(), cards()[0]!], cards())).toBeNull();
    const changed = cards();
    changed[0]!.id = "replacement";
    expect(mergeDashboardLayout(cards(), changed, cards())).toBeNull();
    const duplicate = cards();
    duplicate[0]!.id = duplicate[1]!.id;
    expect(mergeDashboardLayout(duplicate, duplicate, duplicate)).toBeNull();
  });

  it("refuses changes outside layout, including remote content changes", () => {
    const changed = cards();
    changed[1]!.title = "Edited chart";
    expect(mergeDashboardLayout(cards(), changed, cards())).toBeNull();
    expect(mergeDashboardLayout(cards(), cards(), changed)).toBeNull();
  });

  it("treats equivalent content object property orders as unchanged", () => {
    const base = cards();
    base[0]!.options = { showGoal: true, showLegend: false };
    const local = structuredClone(base);
    local[0]!.options = { showLegend: false, showGoal: true };
    expect(mergeDashboardLayout(base, local, base)).toEqual(base);
  });
});
