import type { DashboardPayload, DashboardView, DashboardViewKey } from "./types";

function metric(
  month: number,
  week: number,
  today: number,
  goalMonth: number,
  goalWeek: number,
  goalToday: number,
) {
  const last14Days = Math.max(week, Math.round(week * 1.75));
  return {
    current: { month, week, today },
    goal: { month: goalMonth, week: goalWeek, today: goalToday },
    previousMonth: Math.max(0, Math.round(month * 0.82)),
    yearClosedMonthsAverage: Math.max(0, Math.round(month * 0.84)),
    last3ClosedMonthsAverage: Math.max(0, Math.round(month * 0.88)),
    previous14Days: Math.max(0, Math.round(last14Days * 0.78)),
    last7Days: week,
    last14Days,
    previous7Days: Math.max(0, last14Days - week),
    previousWeek: Math.max(0, Math.round(week * 0.82)),
    currentWeek: week,
    yesterday: Math.max(0, Math.round(today * 0.6)),
  };
}

function realizedMetric(
  values: [number, number, number, number, number, number, number],
  goals: [number, number, number],
) {
  const [mesAnterior, mesAtual, ultimos14Dias, ultimos7Dias, estaSemana, ontem, hoje] =
    values;
  const [mes, semana, dia] = goals;
  return {
    mesAnterior,
    mesAtual,
    ultimos14DiasAnteriores: Math.max(0, Math.round(ultimos14Dias * 0.78)),
    ultimos14Dias,
    ultimos7DiasAnteriores: Math.max(0, ultimos14Dias - ultimos7Dias),
    ultimos7Dias,
    semanaPassada: Math.max(0, ultimos14Dias - ultimos7Dias),
    estaSemana,
    ontem,
    hoje,
    metas: { mes, semana, dia },
    realizado_meta_mes: mes ? mesAtual / mes : 0,
    realizado_meta_semana: semana ? estaSemana / semana : 0,
    realizado_meta_dia: dia ? hoje / dia : 0,
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
  monthComparisonMode: "same_day_mtd",
  timezone: "America/Sao_Paulo",
  source: "Prévia demonstrativa",
  realizedFunnel: {
    resumo: { corretores: 22, gerentes: 4 },
    agendamentos: realizedMetric(
      [137, 139, 107, 74, 60, 24, 7],
      [682, 154, 22],
    ),
    visitas: realizedMetric([55, 39, 34, 22, 9, 2, 0], [341, 77, 11]),
    pastas: realizedMetric([71, 30, 28, 16, 15, 3, 2], [307, 70, 10]),
    vendas: realizedMetric([19, 3, 2, 2, 2, 0, 1], [22, 4.97, 0.71]),
  },
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
