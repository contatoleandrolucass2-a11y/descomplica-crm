import "server-only";

import { getApplicationOrigin } from "@/lib/security/origin";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function getGoalsReferenceDate(now: () => Date = () => new Date()) {
  const visualReference = process.env.QA_VISUAL_GOALS_REFERENCE_TIME;
  if (!visualReference) return now();

  const applicationOrigin = getApplicationOrigin();
  if (
    process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA !== "true" ||
    applicationOrigin?.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(applicationOrigin.hostname)
  ) {
    throw new Error("A referência visual das metas exige o modo QA local isolado.");
  }

  const parsed = new Date(visualReference);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== visualReference) {
    throw new Error("A referência visual das metas é inválida.");
  }
  return parsed;
}
