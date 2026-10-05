export const MARKETING_DISTRIBUTION = [
  { role: "Corretor", percent: 40, destination: "Anúncio exclusivo quem vendeu" },
  { role: "Gerente", percent: 30, destination: "Anúncio distribuído equipe" },
  { role: "Regional", percent: 20, destination: "Anúncio plano de ação improdutivo" },
  { role: "Diretor", percent: 10, destination: "Anúncio campeão:" },
] as const;

export const MARKETING_CHAMPION_CONVERSIONS = [
  "Melhor Conversão: Agendamento x Visita",
  "Melhor Conversão: Visita x Pasta",
  "Melhor Conversão: Pasta x Pasta Aprovada",
  "Melhor Conversão: Pasta Aprovada x Venda",
  "Melhor Conversão: Oportunidade x Venda",
] as const;

export function parseMarketingMoney(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.replaceAll(".", "").split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 100_000_000_000 ? cents : null;
}

export function calculateMarketingResources(
  fundCents: number | null,
  saleCostCents: number | null,
) {
  const validFund =
    fundCents !== null &&
    Number.isSafeInteger(fundCents) &&
    fundCents >= 0 &&
    fundCents <= 100_000_000_000;
  const validCost =
    saleCostCents !== null && Number.isSafeInteger(saleCostCents) && saleCostCents > 0;
  if (!validFund) return { allocations: null, expectedSales: null };

  const allocations = MARKETING_DISTRIBUTION.map(({ percent }) =>
    Math.floor((fundCents * percent) / 100),
  );
  const remainder = fundCents - allocations.reduce((total, amount) => total + amount, 0);
  // Allocate residual cents by largest fractional share, preserving the exact fund total.
  const order = MARKETING_DISTRIBUTION.map(({ percent }, index) => ({
    index,
    fraction: (fundCents * percent) % 100,
  })).sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const { index } of order.slice(0, remainder)) {
    allocations[index] = (allocations[index] ?? 0) + 1;
  }

  return { allocations, expectedSales: validCost ? Math.floor(fundCents / saleCostCents) : null };
}
