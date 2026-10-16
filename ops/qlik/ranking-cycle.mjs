import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createQlikRankingV2Schema } from "../../lib/crm/qlik/contracts-v2.ts";
import { publishRankingObservation } from "./publish-ranking.mjs";
import { isRankingFailureCode } from "./ranking-artifact.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SCOPE = Object.freeze({
  businessUnit: "Direcional",
  regional: "SP CAPITAL",
  channel: "CANAL IMOB",
});

/** Each collect call must open and close its own QIX session and reconcile both cubes. */
export async function runRankingCycle({
  collect,
  secret,
  signal,
  publish = publishRankingObservation,
  now = () => new Date(),
  uuid = randomUUID,
} = {}) {
  const unavailable = (reason) => ({ state: "unavailable", reason });
  if (
    typeof collect !== "function" ||
    typeof publish !== "function" ||
    typeof now !== "function" ||
    typeof uuid !== "function" ||
    typeof secret !== "string" ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(secret) ||
    !(signal instanceof AbortSignal)
  )
    return unavailable("cycle_configuration");
  try {
    const identities = [uuid(), uuid(), uuid()];
    if (identities.some((id) => !UUID.test(id)) || new Set(identities).size !== 3)
      return unavailable("cycle_identity");
    const [batchId, ...requests] = identities;
    const observations = [];
    for (const requestId of requests) {
      if (signal.aborted) return unavailable("cancelled");
      const startedAt = now().toISOString();
      if (observations.length && startedAt < observations[0].completedAt)
        return unavailable("cycle_clock");
      const result = await collect({ signal, identity: requestId });
      if (signal.aborted) return unavailable("cancelled");
      if (result?.status === "reauth_required")
        return {
          state: "reauth_required",
          ...(isRankingFailureCode(result.reason) ? { reason: result.reason } : {}),
        };
      if (result?.status === "unavailable" && isRankingFailureCode(result.reason))
        return unavailable(result.reason);
      if (result?.status !== "collected") return unavailable("collection_unavailable");
      const completedAt = now().toISOString();
      if (completedAt < startedAt) return unavailable("cycle_clock");
      // Detach each completed result before opening the next independent session.
      const { source, months, scope } = structuredClone(result);
      if (!isDeepStrictEqual(scope, SCOPE)) return unavailable("collection_scope");
      observations.push({
        schemaVersion: 2,
        batchId,
        requestId,
        startedAt,
        completedAt,
        source,
        scope,
        months,
      });
    }
    const [first, second] = observations;
    if (
      !isDeepStrictEqual(first.source, second.source) ||
      !isDeepStrictEqual(first.months, second.months)
    )
      return unavailable("collection_changed");
    const schema = createQlikRankingV2Schema(now);
    if (observations.some((observation) => !schema.safeParse(observation).success))
      return unavailable("invalid_observation");
    if (signal.aborted) return unavailable("cancelled");
    const staged = await publish(first, { secret, signal });
    if (signal.aborted) return unavailable("cancelled");
    if (staged?.state !== "staged" || staged.requestId !== first.requestId)
      return unavailable("staging_unavailable");
    const committed = await publish(second, { secret, signal });
    if (signal.aborted) return unavailable("cancelled");
    if (
      committed?.state !== "published" ||
      committed.requestId !== second.requestId ||
      typeof committed.contentSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(committed.contentSha256 ?? "") ||
      committed.contentSha256 !== staged.contentSha256
    )
      return unavailable("publication_unavailable");
    return {
      state: "succeeded",
      batchId,
      requestId: second.requestId,
      contentSha256: committed.contentSha256,
      completedAt: second.completedAt,
    };
  } catch {
    // Never propagate source records, transport messages or credentials.
    return unavailable(signal.aborted ? "cancelled" : "cycle_unavailable");
  }
}
