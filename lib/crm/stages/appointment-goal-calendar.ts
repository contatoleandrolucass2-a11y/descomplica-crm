import { appointmentHoliday } from "./appointment-holidays.ts";

// Appointment target jurisdiction confirmed by the user: São Paulo capital.
// Only holidays, not public-sector recesses, optional days or bridge days.
// Municipal calendar: https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00Z`,
  );
}

export function isAppointmentGoalHoliday(date: string): boolean {
  if (appointmentHoliday(date)) return true;
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])-\d{2}$/u.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    return false;
  if (date.slice(5) === "01-25" || date.slice(5) === "07-09") return true;
  const easter = easterSunday(parsed.getUTCFullYear());
  const difference = Math.round((parsed.getTime() - easter.getTime()) / 86_400_000);
  // Good Friday and Corpus Christi, which is a municipal holiday in São Paulo.
  return difference === -2 || difference === 60;
}
