import { isAppointmentGoalHoliday } from "./appointment-goal-calendar";

/** Full reference month, independent of source coverage or a selected day/week. */
export function plannedAppointmentsForMonth(
  month: string,
  brokerCount: number | null,
): number | null {
  if (
    brokerCount === null ||
    !Number.isSafeInteger(brokerCount) ||
    brokerCount < 0 ||
    !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/u.test(month)
  )
    return null;
  const first = new Date(`${month}-01T12:00:00Z`);
  let individualTarget = 0;
  for (
    let date = first;
    date.toISOString().startsWith(month);
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6 || isAppointmentGoalHoliday(date.toISOString().slice(0, 10)))
      continue;
    individualTarget += weekday === 4 ? 2 : 1;
  }
  return individualTarget * brokerCount;
}
