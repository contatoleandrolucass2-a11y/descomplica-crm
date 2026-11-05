import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  appointmentWeekendDay,
  appointmentsGoalPath,
  AppointmentsColumns,
} from "@/app/(protected)/app/etapas/_components/AppointmentsColumns";

describe("appointments reference and calendar labels", () => {
  it("uses each calendar bucket target and keeps a below-goal zero visibly classified", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        daily
        goalLabel="Meta diária"
        showGoalSummary
        label="Dias úteis"
        buckets={[
          { key: "2026-11-02", label: "02", total: 0, goal: 0 },
          { key: "2026-11-04", label: "04", total: 34, goal: 34 },
          { key: "2026-11-05", label: "05", total: 0, goal: 68 },
        ]}
      />,
    );
    expect(html).toContain("Meta diária 0–68");
    expect(html).toContain("05/11/2026: 0 agendamentos; meta 68; abaixo da referência");
    expect(html).toMatch(/data-appointments-value-status="negative"[^>]*>0<\/span>/u);
    expect(html).toContain('data-appointments-team-day="2026-11-05"');
    expect(html.match(/data-goal-status="negative"/gu)).toHaveLength(1);
    expect(html.match(/data-goal-status="positive"/gu)).toHaveLength(2);
  });
  it("draws a single horizontal target from the start to the end without steps", () => {
    expect(appointmentsGoalPath([60, 60, 60, 60, 60], 300, 4)).toBe("M0,60 H100");
    expect(appointmentsGoalPath([0, 0], 300, 4)).toBe("M0,300 H100");
    expect(appointmentsGoalPath([null, null], 300, 4)).toBe("");
    // Unknown periods still break the line rather than bridge unavailable data.
    expect(appointmentsGoalPath([20, null, 20], 300, 4)).toBe(
      "M0,220 H33.33333333333333 M66.66666666666666,220 H100",
    );
  });

  it("shows the selected target below the observed maximum only when requested", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Agendamentos por mês"
        monthly
        reference={{ value: 20, label: "Meta de agendamentos", showSummary: true }}
        buckets={[{ key: "2026-07", label: "Julho", total: 196, goal: 480 }]}
      />,
    );
    expect(html).toMatch(
      /Máximo 196[^]*data-appointments-reference-summary="true"[^]*Meta de agendamentos 20/u,
    );
    expect(html).toContain("Julho: 196 agendamentos; Meta de agendamentos 20");
    expect(html).not.toContain("meta 480");
  });

  it.each([
    [0, "0"],
    [null, "indisponível"],
  ] as const)("keeps target summary %s distinct from unavailable coverage", (value, expected) => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Agendamentos por mês"
        reference={{ value, label: "Meta de agendamentos", showSummary: true }}
        buckets={[{ key: "2026-07", label: "Julho", total: 0 }]}
      />,
    );
    expect(html).toContain(
      `data-appointments-reference-summary="true">Meta de agendamentos ${expected}</span>`,
    );
    if (value === null) expect(html).not.toContain("meta 0");
  });

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

  it("shows an observed maximum without turning it into a commercial target or recoloring bars", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Ranking Score"
        reference={{ value: 48, label: "Maior quantidade no recorte", classify: false }}
        buckets={[
          { key: "gold", label: "Ouro", total: 48, goal: 20 },
          { key: "silver", label: "Prata", total: 12, goal: 20 },
        ]}
      />,
    );
    expect(html).toContain("Ouro: 48 agendamentos; Maior quantidade no recorte 48");
    expect(html).toContain("Prata: 12 agendamentos; Maior quantidade no recorte 48");
    expect(html.match(/data-goal-status="neutral"/gu)).toHaveLength(2);
    expect(html).toContain("Pontilhado: Maior quantidade no recorte");
    expect(html).not.toMatch(/Vermelho:|Azul:|referência atingida|abaixo da referência|meta 20/u);
  });

  it("keeps an observed zero neutral", () => {
    const html = renderToStaticMarkup(
      <AppointmentsColumns
        label="Ranking Score"
        reference={{ value: 0, label: "Maior quantidade no recorte", classify: false }}
        buckets={[{ key: "empty-score", label: "Não informado", total: 0 }]}
      />,
    );
    expect(html).toContain('data-goal-status="neutral"');
    expect(html).toContain("Não informado: 0 agendamentos; Maior quantidade no recorte 0");
    expect(html).not.toMatch(/Vermelho:|Azul:|referência atingida|abaixo da referência/u);
  });
});
