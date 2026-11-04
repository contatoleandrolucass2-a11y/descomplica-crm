import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appointmentWeekdayLabel } from "@/app/(protected)/app/etapas/_components/appointment-day-label";
import { AppointmentsColumns } from "@/app/(protected)/app/etapas/_components/AppointmentsColumns";

describe("appointment weekday labels", () => {
  it.each([
    ["2026-11-01", "Dom"],
    ["2026-11-02", "Seg"],
    ["2026-11-03", "Ter"],
    ["2026-11-04", "Qua"],
    ["2026-11-05", "Qui"],
    ["2026-11-06", "Sex"],
    ["2026-11-07", "Sáb"],
  ])("uses exactly three letters for %s", (date, label) => {
    expect(appointmentWeekdayLabel(date)).toBe(label);
    expect(appointmentWeekdayLabel(date)).toHaveLength(3);
  });

  it.each(["2026-02-30", "invalid", "2026-13-01"])("rejects invalid civil dates %s", (date) => {
    expect(appointmentWeekdayLabel(date)).toBeNull();
  });

  it("adds weekday tooltips to every daily bar label and preserves holiday explanations", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Dias"
        daily
        buckets={[
          { key: "2026-10-01", label: "01", total: 2 },
          { key: "2026-10-03", label: "03", total: 0 },
          { key: "2026-10-12", label: "12", total: 1 },
        ]}
      />,
    );
    expect(html).toContain('title="Qui" aria-label="01: Qui"');
    expect(html).toContain('title="Sáb" aria-label="03: Sáb"');
    expect(html).toContain('title="Seg — Nossa Senhora Aparecida');
  });
});
