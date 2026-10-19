import { describe, expect, it } from "vitest";
import { getForecastCalendar } from "@/lib/crm/forecast-calendar";

describe("forecast validated-days calendar", () => {
  it("counts only Friday through Sunday in October 2026", () => {
    const calendar = getForecastCalendar(2026, 10, { year: 2026, month: 10, day: 18 });
    expect(calendar.validatedDays).toEqual([2, 3, 4, 9, 10, 11, 16, 17, 18, 23, 24, 25, 30, 31]);
    expect(calendar).toMatchObject({ total: 14, elapsed: 9, remaining: 5 });
  });

  it("treats today as elapsed and handles months before and after it", () => {
    const today = { year: 2026, month: 10, day: 18 };
    const current = getForecastCalendar(2026, 10, today);
    expect(current.validatedDays[current.elapsed - 1]).toBe(18);
    expect(getForecastCalendar(2026, 9, today).remaining).toBe(0);
    expect(getForecastCalendar(2026, 11, today).elapsed).toBe(0);
  });

  it("uses local Date parts while UTC keeps generated weekdays stable", () => {
    const local = new Date(2026, 9, 18, 23, 59, 59);
    expect(getForecastCalendar(2026, 10, local)).toMatchObject({ elapsed: 9, remaining: 5 });
  });

  it.each([
    [2026.5, 10],
    [2026, 0],
    [2026, 13],
  ])("rejects invalid month/year %s/%s", (year, month) => {
    expect(() => getForecastCalendar(year, month)).toThrow(RangeError);
  });
});
