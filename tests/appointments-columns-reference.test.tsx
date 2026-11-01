import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  appointmentWeekendDay,
  AppointmentsColumns,
} from "@/app/(protected)/app/etapas/_components/AppointmentsColumns";

describe("appointments reference and calendar labels", () => {
  it.each([
    ["2026-10-03", "sábado"],
    ["2026-10-04", "domingo"],
    ["2026-10-31", "sábado"],
    ["2026-11-01", "domingo"],
    ["2026-11-03", null],
    ["2026-10-01", null],
    ["2026-02-29", null],
    ["2026-04-31", null],
    ["2026-11", null],
    ["invalid", null],
  ])("resolves %s as %s without local-time conversion", (date, weekend) => {
    expect(appointmentWeekendDay(date)).toBe(weekend);
  });

  it("uses the filtered broker reference in accessible labels and status", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        daily
        label="Agendamentos por dia"
        reference={{ value: 20, label: "Corretores" }}
        buckets={[
          { key: "2026-11-01", label: "01", total: 22, goal: 40 },
          { key: "2026-11-02", label: "02", total: 10, goal: 5 },
        ]}
      />,
    );
    expect(html).toContain("01/11/2026, domingo: 22 agendamentos; Corretores 20");
    expect(html).toContain('data-appointments-weekend="domingo"');
    expect(html).toContain('data-goal-status="positive"');
    expect(html).toContain('data-goal-status="negative"');
    expect(html).not.toContain("meta 40");
    expect(html).not.toContain("data-dashboard-bar-top-line");
    expect(html).not.toContain('role="slider"');
  });

  it("keeps missing broker coverage unavailable instead of using old per-day targets", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Agendamentos por dia"
        reference={{ value: null, label: "Corretores" }}
        buckets={[{ key: "2026-11-01", label: "01", total: 0, goal: 40 }]}
      />,
    );
    expect(html).toContain("Corretores indisponível para este recorte");
    expect(html).toContain('data-goal-status="unavailable"');
    expect(html).not.toContain("meta 40");
    expect(html).not.toContain("data-dashboard-goal-line");
  });

  it("retains a known zero reference and the real zero values", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Hoje"
        reference={{ value: 0, label: "Meta" }}
        buckets={[{ key: "today", label: "Hoje", total: 0 }]}
      />,
    );
    expect(html).toContain("Hoje: 0 agendamentos; Meta 0");
    expect(html).toContain('data-goal-status="positive"');
  });
});
