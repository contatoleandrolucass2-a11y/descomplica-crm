export const POINT_METRICS = [
  { key: "roulette", formKey: "roulette", label: "Roleta de segunda a sexta" },
  { key: "roulette_saturday", formKey: "rouletteSaturday", label: "Roleta de sábado" },
  { key: "roulette_sunday", formKey: "rouletteSunday", label: "Roleta de domingo" },
  { key: "schedule", formKey: "schedule", label: "Agendamento" },
  { key: "visit", formKey: "visit", label: "Visita" },
  { key: "approved_folder", formKey: "approvedFolder", label: "Pasta aprovada" },
  { key: "sale", formKey: "sale", label: "Venda" },
] as const;

export type PointMetricKey = (typeof POINT_METRICS)[number]["key"];
export type PointMetricFormKey = (typeof POINT_METRICS)[number]["formKey"];
export type PointMetricValues = Record<PointMetricKey, number>;

export const DEFAULT_POINT_WEIGHTS: PointMetricValues = {
  roulette: 1,
  roulette_saturday: 2,
  roulette_sunday: 3,
  schedule: 1,
  visit: 7,
  approved_folder: 4,
  sale: 10,
};

export const EMPTY_POINT_TARGETS: PointMetricValues = {
  roulette: 0,
  roulette_saturday: 0,
  roulette_sunday: 0,
  schedule: 0,
  visit: 0,
  approved_folder: 0,
  sale: 0,
};
