export interface AppointmentHoliday {
  name: string;
  explanation: string;
}

// National holidays only. Local religious/civic holidays and optional days
// require a configured jurisdiction; a calendar marker never changes targets.
// Sources: Lei 662/1949 (redação Lei 10.607/2002), Lei 6.802/1980,
// Lei 14.759/2023. Historical coverage follows the current analytical dataset.
const national: Record<string, AppointmentHoliday> = {
  "01-01": {
    name: "Confraternização Universal",
    explanation: "Marca o início do ano e celebra a paz e a convivência entre os povos.",
  },
  "04-21": {
    name: "Tiradentes",
    explanation:
      "Homenageia Joaquim José da Silva Xavier, participante da Inconfidência Mineira, executado em 21 de abril de 1792.",
  },
  "05-01": {
    name: "Dia do Trabalho",
    explanation:
      "Homenageia os trabalhadores e a luta por direitos e melhores condições de trabalho.",
  },
  "09-07": {
    name: "Independência do Brasil",
    explanation: "Recorda a declaração de independência do Brasil em relação a Portugal, em 1822.",
  },
  "10-12": {
    name: "Nossa Senhora Aparecida",
    explanation:
      "Celebra Nossa Senhora Aparecida, padroeira do Brasil, conforme a tradição católica.",
  },
  "11-02": {
    name: "Finados",
    explanation:
      "É uma data de memória e homenagem às pessoas que morreram, ligada à tradição cristã.",
  },
  "11-15": {
    name: "Proclamação da República",
    explanation:
      "Recorda a mudança da monarquia para a República no Brasil, em 15 de novembro de 1889.",
  },
  "11-20": {
    name: "Dia Nacional de Zumbi e da Consciência Negra",
    explanation:
      "Homenageia Zumbi dos Palmares e promove a reflexão sobre a história da população negra e o enfrentamento ao racismo.",
  },
  "12-25": {
    name: "Natal",
    explanation: "Celebra o nascimento de Jesus Cristo na tradição cristã.",
  },
};

export function appointmentHoliday(date: string): AppointmentHoliday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  if (date.slice(5) === "11-20" && date < "2024-01-01") return null;
  return national[date.slice(5)] ?? null;
}

export function appointmentHolidayDescription(holiday: AppointmentHoliday): string {
  return `${holiday.name} — ${holiday.explanation}`;
}
