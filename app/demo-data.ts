import type { DashboardPayload, DashboardView, DashboardViewKey } from "./types";

function metric(
  month: number,
  week: number,
  today: number,
  goalMonth: number,
  goalWeek: number,
  goalToday: number,
) {
  return {
    current: { month, week, today },
    goal: { month: goalMonth, week: goalWeek, today: goalToday },
    previousMonth: Math.max(0, Math.round(month * 0.82)),
    last7Days: week,
    last14Days: Math.max(week, Math.round(week * 1.75)),
  };
}

function view(
  key: DashboardViewKey,
  label: string,
  description: string,
  factor: number,
): DashboardView {
  const n = (value: number) => Math.round(value * factor);
  return {
    key,
    label,
    description,
    metrics: {
      opportunities: metric(n(84), n(23), n(5), n(100), n(25), n(4)),
      appointments: metric(n(31), n(9), n(2), n(40), n(10), n(2)),
      visits: metric(n(16), n(5), n(1), n(20), n(5), n(1)),
      folders: metric(n(9), n(3), n(1), n(12), n(3), n(1)),
      sales: metric(n(3), n(1), 0, n(4), n(1), n(1)),
    },
    salesValue: {
      month: n(742500),
      week: n(241000),
      today: 0,
    },
    topDevelopments: [
      { name: "Reserva Urban Clube", total: n(5) },
      { name: "Pátio Central", total: n(3) },
      { name: "Conquista Sacomã", total: n(2) },
    ],
  };
}

export const demoDashboard: DashboardPayload = {
  collaborator: {
    email: "leandro@descomplicapro.com.br",
    name: "Leandro Lucas",
    manager: "Gestão comercial",
    role: "Colaborador",
  },
  generatedAt: "2026-07-18T18:00:00.000Z",
  referenceDate: "2026-07-18",
  timezone: "America/Sao_Paulo",
  source: "Prévia demonstrativa",
  views: {
    with_canal_imob: view(
      "with_canal_imob",
      "Com CANAL IMOB",
      "Negócios associados a imobiliárias que contêm CANAL IMOB.",
      0.28,
    ),
    without_canal_imob: view(
      "without_canal_imob",
      "Sem CANAL IMOB",
      "Resultado próprio, removendo negócios identificados como CANAL IMOB.",
      0.72,
    ),
    all: view(
      "all",
      "Geral",
      "Visão consolidada com todas as informações disponíveis.",
      1,
    ),
  },
};
