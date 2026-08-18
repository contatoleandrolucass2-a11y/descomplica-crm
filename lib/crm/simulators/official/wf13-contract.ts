export const WF13_MAX_INSTALLMENTS = 84;

export type Wf13InstallmentsValidation =
  | { valid: true; value: number }
  | { valid: false; code: string; message: string };

const INTEGER_PATTERN = /^\d+$/;
const SIGNED_INTEGER_PATTERN = /^-\d+$/;

export function validateWf13Installments(value: string): Wf13InstallmentsValidation {
  const normalized = value.trim();

  if (!normalized || normalized === "0" || SIGNED_INTEGER_PATTERN.test(normalized)) {
    return {
      valid: false,
      code: "installments.range_invalid",
      message: "Informe uma quantidade entre 1 e 84 parcelas.",
    };
  }

  if (!INTEGER_PATTERN.test(normalized)) {
    return {
      valid: false,
      code: "installments.integer_required",
      message: "Informe uma quantidade inteira de parcelas.",
    };
  }

  const parsed = BigInt(normalized);
  if (parsed > BigInt(WF13_MAX_INSTALLMENTS)) {
    return {
      valid: false,
      code: "installments.maximum_exceeded",
      message: "O limite máximo permitido é de 84 parcelas mensais.",
    };
  }

  if (parsed < 1n) {
    return {
      valid: false,
      code: "installments.range_invalid",
      message: "Informe uma quantidade entre 1 e 84 parcelas.",
    };
  }

  return { valid: true, value: Number(parsed) };
}
