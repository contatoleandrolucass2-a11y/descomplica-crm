import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { qlikRankingV2Schema, type QlikRankingV2 } from "./contracts-v2";

const yearSchema = z.number().int().min(2020).max(2100);
function timestampMicros(value: string): bigint | null {
  const parsed = Date.parse(value);
  const match = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?Z$(?![\s\S])/);
  if (!Number.isFinite(parsed) || !match) return null;
  return (
    BigInt(Date.parse(`${value.slice(0, 19)}Z`)) * 1000n + BigInt((match[1] ?? "").padEnd(6, "0"))
  );
}
const responseSchema = z
  .object({
    current: qlikRankingV2Schema.nullable(),
    previous: qlikRankingV2Schema.nullable(),
    publishedAt: z
      .string()
      .datetime()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$(?![\s\S])/)
      .nullable(),
    availableYears: z.array(yearSchema).max(81),
  })
  .strict()
  .superRefine((value, context) => {
    const invalid = () => context.addIssue({ code: "custom", message: "inconsistent publication" });
    if (
      value.availableYears.some(
        (year, index) => index > 0 && year >= value.availableYears[index - 1]!,
      )
    )
      invalid();
    if (!value.current) {
      if (value.previous !== null || value.publishedAt !== null) invalid();
      return;
    }
    const year = Number(value.current.months[0]?.periodMonth.slice(0, 4));
    if (!value.availableYears.includes(year) || value.publishedAt === null) invalid();
    if (value.publishedAt !== null) {
      const published = timestampMicros(value.publishedAt);
      const completed = timestampMicros(value.current.completedAt);
      // Producer timestamps may lead the publishing clock by the accepted five minutes.
      if (
        published === null ||
        completed === null ||
        published < completed - 300_000_000n ||
        published > BigInt(Date.now()) * 1000n + 300_000_000n
      )
        invalid();
    }
    if (
      value.previous &&
      (Number(value.previous.months[0]?.periodMonth.slice(0, 4)) !== year ||
        value.previous.batchId === value.current.batchId ||
        value.previous.requestId === value.current.requestId)
    )
      invalid();
  });

export type QlikRankingV2Data =
  | { status: "unavailable" }
  | { status: "empty"; availableYears: number[] }
  | {
      status: "ready";
      current: QlikRankingV2;
      previous: QlikRankingV2 | null;
      publishedAt: string;
      availableYears: number[];
    };

/** Session-scoped RPC only. The database enforces MFA and crm.ranking.view. */
export async function loadQlikRankingV2(year: number | null = null): Promise<QlikRankingV2Data> {
  if (year !== null && !yearSchema.safeParse(year).success) return { status: "unavailable" };
  try {
    const client = await createClient();
    const { data, error } = await client
      .rpc("get_qlik_ranking_v2", { p_year: year })
      .abortSignal(AbortSignal.timeout(12_000));
    if (error) return { status: "unavailable" };
    const result = responseSchema.safeParse(data);
    if (!result.success) return { status: "unavailable" };
    const value = result.data;
    const selectedYear = year ?? value.availableYears[0];
    if (!value.current) {
      if (selectedYear !== undefined && value.availableYears.includes(selectedYear)) {
        return { status: "unavailable" };
      }
      return { status: "empty", availableYears: value.availableYears };
    }
    if (Number(value.current.months[0]?.periodMonth.slice(0, 4)) !== selectedYear) {
      return { status: "unavailable" };
    }
    return {
      status: "ready",
      current: value.current,
      previous: value.previous,
      publishedAt: value.publishedAt!,
      availableYears: value.availableYears,
    };
  } catch {
    // Do not return database messages, payloads or session details to the UI.
    return { status: "unavailable" };
  }
}
