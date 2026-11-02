import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppointmentsDashboard } from "@/app/(protected)/app/etapas/_components/AppointmentsDashboard";
import { analyzeAppointments } from "@/lib/crm/stages/appointments";
import { appointmentHoliday } from "@/lib/crm/stages/appointment-holidays";
import { appointmentModel } from "./fixtures/appointments-summary";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

describe("rankings de PDV e empreendimento", () => {
  it("separa dimensões em v4 e respeita canal, dia, equipe e indisponibilidade por ranking", () => {
    const analysis: DashboardAnalysisSlice = appointmentModel(4).analysis!;
    analysis.dimensions.stores = ["PDV A", "PDV B"];
    analysis.dimensions.developments = ["Projeto A", "Projeto B"];
    analysis.facts = [
      [1, "2026-10-19", 0, 0, 0, 1, 1, 3, 0, 0, 0],
      [1, "2026-10-19", 0, 0, 0, 1, 0, 2, 0, 0, 1],
      [1, "2026-10-20", 1, 1, 0, 0, 1, 9, 0, 0, 1],
    ];
    const read = (filters = {}) => analyzeAppointments(analysis, { month: "2026-10", filters });
    const result = read({ channel: 1 });
    expect(result.developmentRankings).toEqual({
      pdvs: [
        { key: "PDV A", label: "PDV A", total: 3 },
        { key: "PDV B", label: "PDV B", total: 2 },
      ],
      projects: [
        { key: "Projeto B", label: "Projeto B", total: 3 },
        { key: "Projeto A", label: "Projeto A", total: 2 },
      ],
      total: 5,
    });
    expect(read({ createdDate: "2026-10-20", channel: 1 }).developmentRankings?.total).toBe(0);
    expect(read({ manager: "Gerente B" }).developmentRankings?.total).toBe(9);
    expect(read({ accountRanking: "Ouro" }).developmentRankings).toBeNull();
  });

  it("inclui os três novos conteúdos e não duplica dados operacionais no resumo", () => {
    const model = appointmentModel(4);
    const html = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={model.analysis}
        calendarDate="2026-10-31"
        generatedAt={model.generatedAt}
        timezone="America/Sao_Paulo"
      />,
    );
    expect(html).toContain('data-dashboard-card-id="ranking-pdv"');
    expect(html).toContain('data-dashboard-card-id="ranking-development"');
    expect(html).toContain('data-dashboard-card-id="appointments-overdue"');
    expect(html).toContain("Agendamentos vencidos sem visita realizada");
  });
});

describe("feriados nacionais nos dias do calendário", () => {
  it("inclui nome e explicação e valida datas civis", () => {
    expect(appointmentHoliday("2026-10-12")?.name).toBe("Nossa Senhora Aparecida");
    expect(appointmentHoliday("2026-11-02")?.explanation).toContain("homenagem");
    expect(appointmentHoliday("2026-11-20")?.name).toContain("Consciência Negra");
    expect(appointmentHoliday("2023-11-20")).toBeNull();
    expect(appointmentHoliday("2026-02-30")).toBeNull();
    expect(appointmentHoliday("2026-10-31")).toBeNull();
    // Carnaval is not a nationwide statutory holiday.
    expect(appointmentHoliday("2026-02-17")).toBeNull();
  });
});
