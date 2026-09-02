const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizedDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
};

const addCalendarDays = (value, days) => {
  const validDate = normalizedDate(value);
  if (!validDate) return null;
  const parsed = new Date(`${validDate}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export function validateAssociativeSignalSequence(signals = []) {
  const values = signals.slice(0, 3).map((signal) => Math.max(0, roundMoney(signal?.value ?? signal ?? 0)));
  while (values.length < 3) values.push(0);

  if (values[1] > 0 && values[0] <= 0) {
    return { valid: false, reason: "Sinal 2 exige o preenchimento do Sinal 1." };
  }
  if (values[2] > 0 && values[1] <= 0) {
    return { valid: false, reason: "Sinal 3 exige o preenchimento do Sinal 2." };
  }
  if (values[1] > values[0]) {
    return { valid: false, reason: "Sinal 2 deve ser menor ou igual ao Sinal 1." };
  }
  if (values[2] > values[1]) {
    return { valid: false, reason: "Sinal 3 deve ser menor ou igual ao Sinal 2." };
  }

  return { valid: true, reason: null };
}

function signalReleaseDate(signals, releaseThreshold) {
  let outstanding = roundMoney(signals.reduce((total, signal) => total + Math.max(0, Number(signal.value) || 0), 0));
  const scheduled = signals
    .map((signal) => ({ value: Math.max(0, roundMoney(signal.value)), date: normalizedDate(signal.date) }))
    .filter((signal) => signal.value > 0 && signal.date)
    .sort((left, right) => left.date.localeCompare(right.date));

  for (const signal of scheduled) {
    outstanding = roundMoney(Math.max(0, outstanding - signal.value));
    if (outstanding <= releaseThreshold) return signal.date;
  }
  return null;
}

export function calculateAssociativeReleaseStatus({
  vgv,
  entryValue = 0,
  entryDate,
  signals = [],
  referenceDate,
} = {}) {
  const base = Math.max(0, roundMoney(vgv));
  const entry = Math.max(0, roundMoney(entryValue));
  const normalizedSignals = signals.slice(0, 3).map((signal) => ({
    value: Math.max(0, roundMoney(signal?.value ?? 0)),
    date: normalizedDate(signal?.date),
  }));
  const sequence = validateAssociativeSignalSequence(normalizedSignals);
  const signalTotal = roundMoney(normalizedSignals.reduce((total, signal) => total + signal.value, 0));
  const signalTotalRate = base > 0 ? signalTotal / base : 0;
  const entryRate = base > 0 ? entry / base : 0;
  const signalBlockThreshold = roundMoney(base * 0.05);
  const signalReleaseThreshold = roundMoney(base * 0.03);
  const commissionEntryThreshold = roundMoney(base * 0.06);
  const reference = normalizedDate(referenceDate);

  if (base <= 0 || !sequence.valid) {
    const reason = base <= 0 ? "Informe o VGV para calcular a liberação." : sequence.reason;
    return {
      ready: false,
      sequence,
      signalTotal,
      signalTotalRate,
      entryRate,
      signalBlockThreshold,
      signalReleaseThreshold,
      commissionEntryThreshold,
      commission: { status: "pending", releaseDate: null, reason },
      repasse: { status: "pending", releaseDate: null, reason },
    };
  }

  const signalBlocked = signalTotal >= signalBlockThreshold;
  const repasseReleaseDate = signalBlocked ? signalReleaseDate(normalizedSignals, signalReleaseThreshold) : null;
  const repasseReleased = !signalBlocked || Boolean(reference && repasseReleaseDate && reference >= repasseReleaseDate);
  const entryUnlockDate = entry >= commissionEntryThreshold ? addCalendarDays(entryDate, 7) : null;
  const commissionReleasedByEntry = Boolean(entryUnlockDate && reference && reference >= entryUnlockDate);
  const commissionReleaseDate = entryUnlockDate || (signalBlocked ? repasseReleaseDate : null);
  const commissionReleased = entryUnlockDate
    ? commissionReleasedByEntry
    : signalBlocked
      ? Boolean(reference && repasseReleaseDate && reference >= repasseReleaseDate)
      : true;

  return {
    ready: true,
    sequence,
    signalTotal,
    signalTotalRate,
    entryRate,
    signalBlockThreshold,
    signalReleaseThreshold,
    commissionEntryThreshold,
    commission: {
      status: commissionReleased ? "released" : commissionReleaseDate ? "scheduled" : "blocked",
      releaseDate: commissionReleased ? null : commissionReleaseDate,
      reason: entryUnlockDate
        ? `Entrada de ${roundMoney(entryRate * 100)}% do VGV: liberação integral após 7 dias.`
        : signalBlocked
          ? "Bloqueada até o saldo em aberto dos sinais cair para 3% do VGV ou menos."
          : "Sem bloqueio pelo fluxo de sinais.",
    },
    repasse: {
      status: repasseReleased ? "released" : "blocked",
      releaseDate: repasseReleased ? null : repasseReleaseDate,
      reason: signalBlocked
        ? "Bloqueado porque os sinais somam 5% do VGV ou mais; libera com saldo em aberto de até 3%."
        : "Sinais abaixo de 5% do VGV.",
    },
  };
}
