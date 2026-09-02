export const ASSOCIATIVE_COMMISSION_RATES = Object.freeze({
  House: Object.freeze({ Diamante: 0.03, Ouro: 0.026, Prata: 0.023, Bronze: 0.015, Aprendiz: 0.01 }),
  "Imobiliária": Object.freeze({ Ouro: 0.045, Prata: 0.04, Bronze: 0.035 }),
});

export const ASSOCIATIVE_HOUSE_AWARD_RATES = Object.freeze({
  Diamante: 0.2,
  Ouro: 0.2,
  Prata: 0.1,
  Bronze: 0.3,
  Aprendiz: 0.3,
});

function nonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function calculateAssociativeCommercialRemuneration({
  channel,
  classification,
  realSaleValue,
  propertyValue,
  cashBackSlack,
}) {
  const commissionBase = Math.min(nonNegativeNumber(realSaleValue), nonNegativeNumber(propertyValue));
  const commissionRate = ASSOCIATIVE_COMMISSION_RATES[channel]?.[classification] ?? 0;
  const ready = commissionRate > 0;
  const commissionValue = commissionBase * commissionRate;
  const awardBase = nonNegativeNumber(cashBackSlack);
  const awardRate = !ready || awardBase <= 0
    ? 0
    : channel === "Imobiliária"
      ? 0.4
      : ASSOCIATIVE_HOUSE_AWARD_RATES[classification] ?? 0;
  const awardValue = awardBase * awardRate;
  const totalValue = commissionValue + awardValue;
  const totalRate = ready && commissionBase > 0 ? totalValue / commissionBase : null;

  return {
    ready,
    commissionBase,
    commissionRate,
    commissionValue,
    awardBase,
    awardRate,
    awardValue,
    hasAward: ready && awardBase > 0,
    totalValue,
    totalRate,
  };
}
