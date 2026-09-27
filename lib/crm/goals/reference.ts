import "server-only";

import { getApplicationOrigin } from "@/lib/security/origin";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const ISOLATED_HOMOLOGATION_ORIGIN = "https://homolog.descomplicapro.com.br";

export function getGoalsReferenceDate(now: () => Date = () => new Date()) {
  const visualReference = process.env.QA_VISUAL_GOALS_REFERENCE_TIME;
  if (!visualReference) return now();

  const applicationOrigin = getApplicationOrigin();
  const isolatedLocalQa =
    process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA === "true" &&
    applicationOrigin?.protocol === "http:" &&
    LOOPBACK_HOSTS.has(applicationOrigin.hostname);
  const isolatedHostedQa =
    process.env.HOMOLOGATION_MODE === "true" &&
    process.env.PUBLIC_SIGNUP_ENABLED === "false" &&
    process.env.SUPABASE_URL === "http://kong:8000" &&
    applicationOrigin?.origin === ISOLATED_HOMOLOGATION_ORIGIN;
  if (!isolatedLocalQa && !isolatedHostedQa) {
    throw new Error("A referência visual das metas exige um ambiente QA isolado.");
  }

  const parsed = new Date(visualReference);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== visualReference) {
    throw new Error("A referência visual das metas é inválida.");
  }
  return parsed;
}
