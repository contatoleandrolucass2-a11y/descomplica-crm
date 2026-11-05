import { calculateHousingSimulation, type HousingInput, type HousingResult } from "./caixa";

type HousingSuccess = Extract<HousingResult, { ok: true }>;
export type CaixaCommercialFunding = {
  baseValue: number;
  financing: number;
  rate: number;
  financingQuota: number;
  subsidy: number;
  firstPayment: number;
};
type Candidate = Omit<CaixaCommercialFunding, "firstPayment"> & {
  quotaCents: number;
  ceilingCents: number;
  middleClass: boolean;
};
const moneyCents = (value: number) => Math.round(value * 100);
const positiveMoney = (value: number | undefined): value is number =>
  value !== undefined &&
  Number.isFinite(value) &&
  value > 0 &&
  Number.isSafeInteger(moneyCents(value));

/** Commercial planning policy only; the chosen base never replaces the real sale or appraisal. */
export function optimizeCaixaCommercialFunding(
  input: HousingInput,
  housing: HousingSuccess,
): CaixaCommercialFunding | null {
  if (
    !positiveMoney(input.propertyValue) ||
    !positiveMoney(input.appraisalValue) ||
    moneyCents(housing.propertyValue) !== moneyCents(input.propertyValue) ||
    housing.subsidyEligibility === "eligible-review"
  )
    return null;
  const saleCents = moneyCents(input.propertyValue);
  const appraisalCents = moneyCents(input.appraisalValue);
  if (appraisalCents <= saleCents)
    return {
      baseValue: housing.quotaBaseValue,
      financing: housing.financing,
      rate: housing.rate,
      financingQuota: housing.financingQuota,
      subsidy: housing.subsidy,
      firstPayment: housing.financing > 0 ? housing.firstPayment : 0,
    };

  const upperCents = Math.min(
    appraisalCents,
    housing.product === "mcmv" ? 60000000 : appraisalCents,
  );
  if (saleCents > upperCents) return null;
  const cache = new Map<number, Candidate | null>();
  const realPropertyByBand = new Map<string, HousingResult>();
  const evaluate = (baseCents: number): Candidate | null => {
    if (cache.has(baseCents)) return cache.get(baseCents)!;
    const candidate = calculateHousingSimulation({ ...input, propertyValue: baseCents / 100 });
    if (!candidate.ok) {
      cache.set(baseCents, null);
      return null;
    }
    // Subsidy and the purchase balance always use the real property at this candidate's rate.
    const bandKey = `${candidate.rate}|${candidate.middleClass}`;
    let realProperty = realPropertyByBand.get(bandKey);
    if (!realProperty) {
      realProperty = calculateHousingSimulation({
        ...input,
        nominalRate: candidate.rate,
        middleClass: candidate.middleClass,
      });
      realPropertyByBand.set(bandKey, realProperty);
    }
    if (!realProperty.ok || realProperty.subsidyEligibility === "eligible-review") {
      cache.set(baseCents, null);
      return null;
    }
    const remainingCents =
      saleCents -
      moneyCents(realProperty.ownFunds) -
      moneyCents(realProperty.fgts) -
      moneyCents(realProperty.subsidy) -
      moneyCents(realProperty.publicContribution);
    const quotaCents = moneyCents(candidate.quotaFinancing);
    const ceilingCents = Math.max(
      0,
      Math.min(moneyCents(candidate.maximumFinancingByIncome), remainingCents),
    );
    const result: Candidate = {
      baseValue: baseCents / 100,
      financing: Math.min(quotaCents, ceilingCents) / 100,
      rate: candidate.rate,
      financingQuota: candidate.financingQuota,
      subsidy: realProperty.subsidy,
      quotaCents,
      ceilingCents,
      middleClass: candidate.middleClass,
    };
    cache.set(baseCents, result);
    return result;
  };

  const boundaries = [
    ...new Set([
      ...(housing.product === "mcmv"
        ? [
            ...(housing.municipalLimit === undefined ? [] : [moneyCents(housing.municipalLimit)]),
            40000000,
            60000000,
          ]
        : []),
      upperCents,
    ]),
  ]
    .filter((value) => value >= saleCents && value <= upperCents)
    .sort((a, b) => a - b);
  let best: Candidate | null = null;
  const consider = (candidate: Candidate | null) => {
    if (
      candidate &&
      (!best ||
        candidate.financing > best.financing ||
        (candidate.financing === best.financing &&
          (candidate.baseValue < best.baseValue ||
            (candidate.baseValue === best.baseValue && candidate.rate < best.rate))))
    )
      best = candidate;
  };
  let lower = saleCents;
  for (const boundary of boundaries) {
    let upper = boundary;
    const first = evaluate(lower);
    if (first) {
      // Each band has a nondecreasing quota and a nonincreasing income/purchase ceiling.
      const previousBest = best as Candidate | null;
      if (previousBest && first.ceilingCents < moneyCents(previousBest.financing)) {
        lower = boundary + 1;
        continue;
      }
      if (first.quotaCents >= first.ceilingCents) {
        consider(first);
        lower = boundary + 1;
        continue;
      }
      if (!evaluate(upper)) {
        let valid = lower;
        let invalid = upper;
        while (valid + 1 < invalid) {
          const middle = Math.floor((valid + invalid) / 2);
          if (evaluate(middle)) valid = middle;
          else invalid = middle;
        }
        upper = valid;
      }
      let left = lower;
      let right = upper;
      const last = evaluate(upper)!;
      if (last.quotaCents < last.ceilingCents) {
        left = upper;
      } else if (upper > lower + 1) {
        // Seed a smaller bracket from engine outputs only. Its signs are checked before
        // using it; a nonlinear/rounded segment still falls back to exact cent bisection.
        const lowDifference = first.quotaCents - first.ceilingCents;
        const highDifference = last.quotaCents - last.ceilingCents;
        const estimate = Math.floor(
          lower + ((upper - lower) * -lowDifference) / (highDifference - lowDifference),
        );
        const probeLow = Math.max(lower, estimate - 4);
        const probeHigh = Math.min(upper, estimate + 4);
        for (const probe of [probeLow, probeHigh]) {
          const candidate = evaluate(probe)!;
          if (candidate.quotaCents >= candidate.ceilingCents) right = Math.min(right, probe);
          else left = Math.max(left, probe + 1);
        }
      }
      while (left < right) {
        const middle = Math.floor((left + right) / 2);
        const candidate = evaluate(middle)!;
        if (candidate.quotaCents >= candidate.ceilingCents) right = middle;
        else left = middle + 1;
      }
      let intervalBest: Candidate | null = null;
      for (const value of new Set([lower, upper, left - 1, left, left + 1])) {
        if (value < lower || value > upper) continue;
        const candidate = evaluate(value);
        if (
          candidate &&
          (!intervalBest ||
            candidate.financing > intervalBest.financing ||
            (candidate.financing === intervalBest.financing &&
              candidate.baseValue < intervalBest.baseValue))
        )
          intervalBest = candidate;
      }
      if (intervalBest) {
        // Prefer the smallest cent-denominated base on a flat maximum.
        right = moneyCents(intervalBest.baseValue);
        const target = intervalBest.financing;
        left = right;
        for (let step = 1; left > lower; step *= 2) {
          const probe = Math.max(lower, right - step);
          if (evaluate(probe)!.financing < target) {
            left = probe + 1;
            break;
          }
          left = probe;
          if (left === lower) break;
        }
        while (left < right) {
          const middle = Math.floor((left + right) / 2);
          if (evaluate(middle)!.financing >= target) right = middle;
          else left = middle + 1;
        }
        consider(evaluate(left));
      }
    }
    lower = boundary + 1;
  }
  // The canonical engine also computes the payment for the chosen principal; no duplicate interest formula.
  const chosen = best as Candidate | null;
  if (!chosen) return null;
  const quote = calculateHousingSimulation({
    ...input,
    propertyValue: chosen.baseValue,
    nominalRate: chosen.rate,
    middleClass: chosen.middleClass,
    confirmedSubsidy: chosen.subsidy,
    ownFunds:
      (moneyCents(chosen.baseValue) -
        moneyCents(chosen.financing) -
        moneyCents(chosen.subsidy) -
        moneyCents(housing.fgts) -
        moneyCents(housing.publicContribution)) /
      100,
  });
  if (!quote.ok || moneyCents(quote.financing) !== moneyCents(chosen.financing)) return null;
  return {
    baseValue: chosen.baseValue,
    financing: chosen.financing,
    rate: chosen.rate,
    financingQuota: chosen.financingQuota,
    subsidy: chosen.subsidy,
    firstPayment: chosen.financing > 0 ? quote.firstPayment : 0,
  };
}
