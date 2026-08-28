import "server-only";

import { z } from "zod";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const MAX_MONEY_CENTS = 100_000_000_000_000n;

export const legacyBoundedText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));

export const legacyOptionalText = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));

export const legacyMoneyInput = z
  .string()
  .regex(MONEY_PATTERN)
  .refine((value) => !MONEY_PATTERN.test(value) || parseLegacyMoneyCents(value) <= MAX_MONEY_CENTS);

export const legacyOptionalMoneyInput = z.union([z.literal(""), legacyMoneyInput]);

export const legacyDecimalInput = z.string().regex(DECIMAL_PATTERN);

export const legacyMoneyCentsOutput = z.string().regex(/^(?:0|[1-9]\d*)$/);

export const legacyDateInput = z.string().refine((value) => parseLegacyDate(value) !== null);

export const legacyOptionalDateInput = z.union([z.literal(""), legacyDateInput]);

export function parseLegacyMoneyCents(value: string): bigint {
  if (!MONEY_PATTERN.test(value)) throw new Error("invalid_money");
  const [whole = "0", decimals = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"));
}

export function serializeLegacyMoneyCents(value: bigint): string {
  if (value < 0n) throw new Error("negative_money");
  return value.toString();
}

export function legacyMoneyCentsToNumber(value: bigint): number {
  const converted = Number(value) / 100;
  if (!Number.isSafeInteger(Number(value)) || !Number.isFinite(converted)) {
    throw new Error("unsafe_money");
  }
  return converted;
}

export function legacyNumberToMoneyCents(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return BigInt(Math.round((value + Number.EPSILON) * 100));
}

export function roundLegacyFraction(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error("invalid_fraction");
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function multiplyLegacyRatio(value: bigint, numerator: bigint, denominator: bigint): bigint {
  return roundLegacyFraction(value * numerator, denominator);
}

export function parseLegacyDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function serializeLegacyDate(value: Date | null): string {
  return value?.toISOString().slice(0, 10) ?? "";
}

export function addLegacyDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function addLegacyMonths(value: Date, months: number): Date {
  const target = value.getUTCFullYear() * 12 + value.getUTCMonth() + months;
  const year = Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(value.getUTCDate(), lastDay), 12));
}

export function wholeLegacyMonths(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function roundLegacyNumber(value: number, decimals = 8): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
