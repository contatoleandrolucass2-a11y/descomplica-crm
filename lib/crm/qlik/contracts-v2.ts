import { z } from "zod";

const MAX_PAYLOAD_BYTES = 4_000_000;
const moneyPattern = /^(0|[1-9]\d{0,15})\.\d{2}$(?![\s\S])/;
const money = z.string().regex(moneyPattern);
const count = z.number().int().min(0).max(1_000_000_000);
const timestamp = z
  .string()
  .datetime()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$(?![\s\S])/);

// Mirrors UTF-8 jsonb::text for this contract: numbers are safe integers and
// amounts are strings. Key ordering changes no bytes; separators add spaces.
export function qlikRankingV2JsonbByteLength(value: unknown): number {
  if (typeof value === "string") {
    for (const character of value) {
      const point = character.codePointAt(0)!;
      if (point === 0 || (point >= 0xd800 && point <= 0xdfff)) return Infinity;
    }
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  }
  if (value === null) return 4;
  if (typeof value === "boolean") return value ? 4 : 5;
  if (typeof value === "number") {
    return Number.isSafeInteger(value)
      ? Buffer.byteLength(JSON.stringify(value), "utf8")
      : Infinity;
  }
  if (Array.isArray(value)) {
    return (
      2 +
      Math.max(0, value.length - 1) * 2 +
      value.reduce<number>((size, item) => size + qlikRankingV2JsonbByteLength(item), 0)
    );
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value);
    return (
      2 +
      Math.max(0, entries.length - 1) * 2 +
      entries.reduce(
        (size, [key, item]) =>
          size + qlikRankingV2JsonbByteLength(key) + 2 + qlikRankingV2JsonbByteLength(item),
        0,
      )
    );
  }
  return Infinity;
}

function cents(value: string): bigint {
  return BigInt(value.replace(".", ""));
}

// Preserve PostgreSQL timestamp precision when comparing sub-millisecond times.
function microseconds(value: string): bigint {
  const fraction = value.match(/\.(\d+)Z$/)?.[1] ?? "";
  return BigInt(Date.parse(`${value.slice(0, 19)}Z`)) * 1000n + BigInt(fraction.padEnd(6, "0"));
}

const cube = z
  .object({
    coverage: z
      .object({ state: z.literal("complete"), sourceRows: z.number().int().min(0).max(5000) })
      .strict(),
    nativeTotals: z.object({ vgv: money, contracts: count }).strict(),
    rows: z
      .array(
        z
          .object({
            key: z
              .string()
              .min(1)
              .max(128)
              .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$(?![\s\S])/),
            name: z
              .string()
              .min(1)
              .max(256)
              .regex(/^[^\p{Cc}\p{Cs}]*$/u)
              .refine(
                (value) => !value.startsWith(" ") && !value.endsWith(" "),
                "name must not have leading or trailing ASCII spaces",
              ),
            vgv: money,
            contracts: count,
          })
          .strict(),
      )
      .max(5000),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (value.coverage.sourceRows !== value.rows.length) {
      issue(["coverage", "sourceRows"], "sourceRows must equal rows length");
    }
    for (let index = 1; index < value.rows.length; index++) {
      if (value.rows[index - 1]!.key >= value.rows[index]!.key) {
        issue(["rows", index, "key"], "keys must be unique and sorted");
      }
    }
    // Refinements also run on dirty values; never pass invalid input to BigInt.
    if (
      moneyPattern.test(value.nativeTotals.vgv) &&
      value.rows.every((row) => moneyPattern.test(row.vgv))
    ) {
      const total = value.rows.reduce((sum, row) => sum + cents(row.vgv), 0n);
      if (total !== cents(value.nativeTotals.vgv)) {
        issue(["nativeTotals", "vgv"], "vgv must equal the exact row sum");
      }
    }
    if (
      Number.isSafeInteger(value.nativeTotals.contracts) &&
      value.rows.every((row) => Number.isSafeInteger(row.contracts))
    ) {
      const total = value.rows.reduce((sum, row) => sum + BigInt(row.contracts), 0n);
      if (total !== BigInt(value.nativeTotals.contracts)) {
        issue(["nativeTotals", "contracts"], "contracts must equal the exact row sum");
      }
    }
  });

export function createQlikRankingV2Schema(now: () => Date = () => new Date()) {
  return z
    .object({
      schemaVersion: z.literal(2),
      batchId: z.string().uuid(),
      requestId: z.string().uuid(),
      startedAt: timestamp,
      completedAt: timestamp,
      source: z
        .object({
          appId: z.literal("7c000871-8b32-4c0f-bfd5-4b9d46946575"),
          sheetId: z.literal("772db774-0bc2-42d8-ac11-3e4917bd0d37"),
          mappingSha256: z.string().regex(/^[0-9a-f]{64}$(?![\s\S])/),
          reloadTimestamp: timestamp,
        })
        .strict(),
      scope: z
        .object({
          businessUnit: z.literal("Direcional"),
          regional: z.literal("SP CAPITAL"),
          channel: z.literal("CANAL IMOB"),
        })
        .strict(),
      months: z
        .array(
          z
            .object({
              periodMonth: z
                .string()
                .date()
                .regex(/^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])-01$(?![\s\S])/),
              imobs: cube,
              developments: cube,
            })
            .strict(),
        )
        .min(1)
        .max(12),
    })
    .strict()
    .superRefine((value, context) => {
      const issue = (path: (string | number)[], message: string) =>
        context.addIssue({ code: "custom", path, message });
      const currentTime = now().getTime();
      if (!Number.isFinite(currentTime)) {
        issue([], "invalid validation clock");
      } else if (
        [value.startedAt, value.completedAt, value.source.reloadTimestamp].every(
          (item) => timestamp.safeParse(item).success,
        )
      ) {
        const completed = microseconds(value.completedAt);
        if (microseconds(value.startedAt) > completed) {
          issue(["startedAt"], "startedAt must not exceed completedAt");
        }
        if (completed > BigInt(currentTime + 300_000) * 1000n) {
          issue(["completedAt"], "completedAt must not exceed now plus five minutes");
        }
        if (microseconds(value.source.reloadTimestamp) > microseconds(value.startedAt)) {
          issue(["source", "reloadTimestamp"], "reloadTimestamp must not exceed startedAt");
        }
      }
      const year = value.months[0]?.periodMonth.slice(0, 4);
      value.months.forEach((month, index) => {
        if (
          month.periodMonth.slice(0, 4) !== year ||
          (index > 0 && value.months[index - 1]!.periodMonth >= month.periodMonth)
        ) {
          issue(
            ["months", index, "periodMonth"],
            "months must be unique, sorted and in the same year",
          );
        }
      });
      if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_PAYLOAD_BYTES) {
        issue([], "payload must not exceed 4000000 bytes");
      }
      if (qlikRankingV2JsonbByteLength(value) > MAX_PAYLOAD_BYTES) {
        issue([], "payload must fit PostgreSQL JSONB within 4000000 bytes");
      }
    });
}

export const qlikRankingV2Schema = createQlikRankingV2Schema();
export type QlikRankingV2 = z.infer<typeof qlikRankingV2Schema>;
