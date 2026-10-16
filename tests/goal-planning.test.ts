import { describe, expect, it } from "vitest";
import {
  buildGoalCalendar,
  distributeFunnelWeeks,
  distributeWeeklyGoal,
  projectGoalVolumes,
} from "../lib/crm/goals/planning";

describe("goal planning preview", () => {
  it("projects backwards without rounding intermediate stages", () => {
    expect(projectGoalVolumes(1, [896, 242, 135, 292, 126])).toEqual([108, 12, 5, 4, 1, 1]);
    expect(projectGoalVolumes(1, [150, 150, 150, 150, 150])).toEqual([8, 5, 3, 2, 2, 1]);
  });

  it("propagates unavailable stages and rejects nonfinite or negative values", () => {
    expect(projectGoalVolumes(1, [100, 100, null, 100, 100])).toEqual([null, null, null, 1, 1, 1]);
    expect(projectGoalVolumes(1, [100])).toEqual([null, null, null, null, null, 1]);
    for (const sales of [null, NaN, Infinity, -1]) {
      expect(projectGoalVolumes(sales, [100, 100, 100, 100, 100])).toEqual(Array(6).fill(null));
    }
    expect(projectGoalVolumes(Number.MAX_VALUE, [100, 100, 100, 100, 200])[4]).toBeNull();
    expect(projectGoalVolumes(0, [100, 100, 100, 100, 100])).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("builds Sunday to Saturday weeks with Monday to Friday workdays", () => {
    const calendar = buildGoalCalendar(2026, 9, "2026-10-15");
    expect(calendar.leadingDays).toBe(4);
    expect(calendar.days).toHaveLength(31);
    expect(calendar.workdays).toBe(22);
    expect(calendar.elapsedWorkdays).toBe(11);
    expect(calendar.weeks.map((week) => [week.start, week.end, week.workdays])).toEqual([
      [1, 3, 2],
      [4, 10, 5],
      [11, 17, 5],
      [18, 24, 5],
      [25, 31, 5],
    ]);
    expect(calendar.weeks.filter((week) => week.isCurrent).map((week) => week.start)).toEqual([11]);
    expect(calendar.days[2]?.workday).toBe(false);
    expect(calendar.days[3]?.workday).toBe(false);
  });

  it("handles past, future, leap months and invalid date-only inputs", () => {
    expect(buildGoalCalendar(2026, 8, "2026-10-15").elapsedWorkdays).toBe(22);
    expect(buildGoalCalendar(2026, 10, "2026-10-15").elapsedWorkdays).toBe(0);
    expect(buildGoalCalendar(2024, 1, "2024-02-29").days).toHaveLength(29);
    expect(buildGoalCalendar(2026, 10, "2026-11-01").leadingDays).toBe(0);
    expect(buildGoalCalendar(2026, 9, "2026-10-17").elapsedWorkdays).toBe(12);
    expect(() => buildGoalCalendar(2026, 12, "2026-10-15")).toThrow(RangeError);
    expect(() => buildGoalCalendar(2026, 9, "2026-02-30")).toThrow(RangeError);
    expect(() => buildGoalCalendar(2026, 9, "2026-10-15T00:00:00Z")).toThrow(RangeError);
  });

  it("uses largest remainders and preserves the monthly total", () => {
    const { weeks, workdays } = buildGoalCalendar(2026, 9, "2026-10-15");
    const result = distributeWeeklyGoal(108, weeks, workdays);
    expect(result.map((week) => week.cumulative)).toEqual([10, 35, 60, 84, 108]);
    expect(result.map((week) => week.increment)).toEqual([10, 25, 25, 24, 24]);
    expect(result.reduce((sum, week) => sum + week.increment!, 0)).toBe(108);
    expect(distributeWeeklyGoal(1, weeks, workdays).map((week) => week.cumulative)).toEqual([
      0, 1, 1, 1, 1,
    ]);
    expect(distributeWeeklyGoal(0, weeks, workdays).every((week) => week.cumulative === 0)).toBe(
      true,
    );
    expect(
      distributeWeeklyGoal(null, weeks, workdays).every((week) => week.cumulative === null),
    ).toBe(true);
    expect(
      distributeWeeklyGoal(Infinity, weeks, workdays).every((week) => week.cumulative === null),
    ).toBe(true);
    expect(distributeWeeklyGoal(108, weeks, 0).every((week) => week.cumulative === null)).toBe(
      true,
    );
    expect(distributeWeeklyGoal(108, [{ workdays: 2, cumulativeWorkdays: 5 }], 5)).toEqual([
      { cumulative: null, increment: null },
    ]);
  });

  it("matches the reference funnel weekly cumulative targets exactly", () => {
    const { weeks, workdays } = buildGoalCalendar(2026, 9, "2026-10-15");
    const volumes = projectGoalVolumes(1, [896, 242, 135, 292, 126]);
    const result = distributeFunnelWeeks(volumes, weeks, workdays);
    expect(result.map((stage) => stage.map((week) => week.cumulative))).toEqual([
      [10, 35, 60, 84, 108],
      [1, 3, 6, 9, 12],
      [0, 1, 2, 3, 5],
      [0, 0, 1, 2, 4],
      [0, 0, 0, 0, 1],
      [0, 0, 0, 0, 1],
    ]);
    result.forEach((stage, index) => {
      expect(stage.reduce((sum, week) => sum + week.increment!, 0)).toBe(volumes[index]);
      expect(stage.every((week) => week.increment! >= 0)).toBe(true);
    });
    expect(distributeFunnelWeeks([null, 0, 1], weeks, workdays)[0]).toEqual(
      weeks.map(() => ({ cumulative: null, increment: null })),
    );
    expect(
      distributeFunnelWeeks([0, 0], weeks, workdays)[1]?.every((week) => week.cumulative === 0),
    ).toBe(true);
  });
});
