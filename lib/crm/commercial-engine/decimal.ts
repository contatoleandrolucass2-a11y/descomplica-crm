export type DecimalRoundingMode = "down" | "up" | "floor" | "ceil" | "half_up" | "half_even";

export type DecimalValue = Readonly<{
  coefficient: bigint;
  scale: number;
}>;

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const MAX_INPUT_DIGITS = 30;
const MAX_RESULT_DIGITS = 120;
const MAX_OUTPUT_SCALE = 18;
const MAX_INTERMEDIATE_SCALE = 120;

export class CommercialDecimalError extends Error {}

function powerOfTen(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_RESULT_DIGITS) {
    throw new CommercialDecimalError("decimal exponent is outside the supported range");
  }
  return 10n ** BigInt(exponent);
}

function digitCount(value: bigint): number {
  const absolute = value < 0n ? -value : value;
  return absolute.toString().length;
}

function bounded(value: DecimalValue): DecimalValue {
  if (
    value.scale < 0 ||
    value.scale > MAX_INTERMEDIATE_SCALE ||
    digitCount(value.coefficient) > MAX_RESULT_DIGITS
  ) {
    throw new CommercialDecimalError("decimal result is outside the supported range");
  }
  return value;
}

function normalize(value: DecimalValue): DecimalValue {
  if (value.coefficient === 0n) return { coefficient: 0n, scale: 0 };

  let coefficient = value.coefficient;
  let scale = value.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return bounded({ coefficient, scale });
}

export function parseCommercialDecimal(input: string): DecimalValue {
  if (!DECIMAL_PATTERN.test(input)) {
    throw new CommercialDecimalError("decimal input is invalid");
  }

  const unsigned = input.startsWith("-") ? input.slice(1) : input;
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  if (`${integerPart}${fractionPart}`.length > MAX_INPUT_DIGITS) {
    throw new CommercialDecimalError("decimal input is outside the supported range");
  }

  const sign = input.startsWith("-") ? -1n : 1n;
  return normalize({
    coefficient: BigInt(`${integerPart}${fractionPart}`) * sign,
    scale: fractionPart.length,
  });
}

export function commercialDecimalToString(value: DecimalValue): string {
  const normalized = normalize(value);
  const sign = normalized.coefficient < 0n ? "-" : "";
  const digits = (
    normalized.coefficient < 0n ? -normalized.coefficient : normalized.coefficient
  ).toString();
  if (normalized.scale === 0) return `${sign}${digits}`;

  const padded = digits.padStart(normalized.scale + 1, "0");
  const splitAt = padded.length - normalized.scale;
  return `${sign}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

export function commercialDecimalToOutputString(value: DecimalValue): string {
  const normalized = normalize(value);
  if (normalized.scale > MAX_OUTPUT_SCALE) {
    throw new CommercialDecimalError("decimal output scale is outside the supported range");
  }
  if (digitCount(normalized.coefficient) > MAX_INPUT_DIGITS) {
    throw new CommercialDecimalError("decimal output precision is outside the supported range");
  }
  return commercialDecimalToString(normalized);
}

function align(left: DecimalValue, right: DecimalValue): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

export function addCommercialDecimals(left: DecimalValue, right: DecimalValue): DecimalValue {
  const [leftCoefficient, rightCoefficient, scale] = align(left, right);
  return normalize({ coefficient: leftCoefficient + rightCoefficient, scale });
}

export function subtractCommercialDecimals(left: DecimalValue, right: DecimalValue): DecimalValue {
  const [leftCoefficient, rightCoefficient, scale] = align(left, right);
  return normalize({ coefficient: leftCoefficient - rightCoefficient, scale });
}

export function multiplyCommercialDecimals(left: DecimalValue, right: DecimalValue): DecimalValue {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  });
}

function roundedQuotient(
  numerator: bigint,
  denominator: bigint,
  mode: DecimalRoundingMode,
): bigint {
  if (denominator === 0n) throw new CommercialDecimalError("division by zero");
  if (denominator < 0n) return roundedQuotient(-numerator, -denominator, mode);

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;

  const direction = numerator < 0n ? -1n : 1n;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  if (mode === "down") return quotient;
  if (mode === "up") return quotient + direction;
  if (mode === "floor") return numerator < 0n ? quotient - 1n : quotient;
  if (mode === "ceil") return numerator > 0n ? quotient + 1n : quotient;

  const doubled = absoluteRemainder * 2n;
  if (doubled < denominator) return quotient;
  if (doubled > denominator || mode === "half_up") return quotient + direction;
  return quotient % 2n === 0n ? quotient : quotient + direction;
}

export function divideCommercialDecimals(
  numerator: DecimalValue,
  denominator: DecimalValue,
  scale: number,
  mode: DecimalRoundingMode,
): DecimalValue {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_OUTPUT_SCALE) {
    throw new CommercialDecimalError("division scale is outside the supported range");
  }

  const scaledNumerator = numerator.coefficient * powerOfTen(denominator.scale + scale);
  const scaledDenominator = denominator.coefficient * powerOfTen(numerator.scale);
  return normalize({
    coefficient: roundedQuotient(scaledNumerator, scaledDenominator, mode),
    scale,
  });
}

export function roundCommercialDecimal(
  value: DecimalValue,
  scale: number,
  mode: DecimalRoundingMode,
): DecimalValue {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_OUTPUT_SCALE) {
    throw new CommercialDecimalError("rounding scale is outside the supported range");
  }
  if (value.scale <= scale) return normalize(value);

  const denominator = powerOfTen(value.scale - scale);
  return normalize({
    coefficient: roundedQuotient(value.coefficient, denominator, mode),
    scale,
  });
}

export function compareCommercialDecimals(left: DecimalValue, right: DecimalValue): number {
  const [leftCoefficient, rightCoefficient] = align(left, right);
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0;
}

export function commercialDecimalIsInteger(value: DecimalValue): boolean {
  const normalized = normalize(value);
  return normalized.scale === 0;
}
