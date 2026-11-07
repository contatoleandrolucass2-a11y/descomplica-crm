import { describe, expect, it } from "vitest";
import { plannedAppointmentsForMonth } from "../lib/crm/stages/appointments-monthly-target";
import { plannedAppointmentsForDate } from "../lib/crm/stages/appointments";
import { isAppointmentGoalHoliday } from "../lib/crm/stages/appointment-goal-calendar";

describe("calendar monthly appointment target", () => {
  it("uses the full October month: 22 weekdays + 5 Thursdays minus the Monday holiday", () => {
    expect(plannedAppointmentsForMonth("2026-10", 1)).toBe(26);
    expect(plannedAppointmentsForMonth("2026-10", 20)).toBe(520);
    expect(plannedAppointmentsForMonth("2026-10", 2)).toBe(52);
  });

  it("recalculates when month/year changes, including holidays on Thursdays", () => {
    // January 2026 has22 weekdays and5 Thursdays; New Year's Thursday removes2.
    expect(plannedAppointmentsForMonth("2026-01", 1)).toBe(25);
    // February 2028 has21 weekdays and4 Thursdays, including leap day.
    expect(plannedAppointmentsForMonth("2028-02", 1)).toBe(25);
    // November 2026 has21 weekdays +4 Thursdays minus Monday2 and Friday20.
    expect(plannedAppointmentsForMonth("2026-11", 1)).toBe(23);
  });

  it("preserves unavailable and an official empty roster as distinct states", () => {
    expect(plannedAppointmentsForMonth("2026-10", null)).toBeNull();
    expect(plannedAppointmentsForMonth("2026-10", 0)).toBe(0);
    expect(plannedAppointmentsForMonth("2026-13", 20)).toBeNull();
    expect(plannedAppointmentsForMonth("2026-10", -1)).toBeNull();
  });

  it("zeros national, municipal and state holidays applicable to São Paulo", () => {
    for (const date of [
      "2026-01-25",
      "2026-04-03",
      "2026-06-04",
      "2026-07-09",
      "2026-10-12",
      "2026-11-20",
    ]) {
      expect(isAppointmentGoalHoliday(date), date).toBe(true);
      expect(plannedAppointmentsForDate(date, 20), date).toBe(0);
    }
    // Thursday holiday removes both units; ordinary Thursday still counts twice.
    expect(plannedAppointmentsForDate("2026-06-11", 20)).toBe(40);
    expect(plannedAppointmentsForMonth("2026-06", 1)).toBe(24);
    expect(plannedAppointmentsForMonth("2026-07", 1)).toBe(26);
  });

  it("recalculates movable holidays and does not treat optional days as holidays", () => {
    expect(isAppointmentGoalHoliday("2027-03-26")).toBe(true);
    expect(isAppointmentGoalHoliday("2027-05-27")).toBe(true);
    expect(isAppointmentGoalHoliday("2026-02-17")).toBe(false);
    expect(isAppointmentGoalHoliday("2026-06-05")).toBe(false);
    expect(isAppointmentGoalHoliday("2026-02-30")).toBe(false);
    expect(plannedAppointmentsForDate("2026-06-04", null)).toBe(0);
  });
});
