import { z } from "zod";

export const QLIK_STATUS_PATH = "/api/ingest/qlik/status";
export const QLIK_STATUS_TTL_MS = 90_000;
export const QLIK_COLLECTION_INTERVAL_MS = 3_600_000;
const timestamp = z.iso.datetime({ precision: 3 });
export const qlikStatusObservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    observedAt: timestamp,
    cycleAt: timestamp,
    cycle: z.enum(["running", "succeeded", "reauth_required", "unavailable"]),
    lastCollectedAt: timestamp.nullable(),
    lastPublishedAt: timestamp.nullable(),
    sourceUpdatedAt: timestamp.nullable(),
    nextRunAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const observed = Date.parse(value.observedAt);
    for (const key of [
      "cycleAt",
      "lastCollectedAt",
      "lastPublishedAt",
      "sourceUpdatedAt",
    ] as const) {
      if (value[key] && Date.parse(value[key]) > observed)
        context.addIssue({ code: "custom", path: [key], message: "Future evidence" });
    }
    if (value.cycle === "running" && value.nextRunAt !== null)
      context.addIssue({
        code: "custom",
        path: ["nextRunAt"],
        message: "Running cycle has no next start",
      });
    if (value.cycle === "succeeded" && (!value.lastPublishedAt || !value.lastCollectedAt))
      context.addIssue({
        code: "custom",
        path: ["cycle"],
        message: "Publication evidence required",
      });
    if (
      value.lastPublishedAt &&
      (!value.lastCollectedAt || value.lastPublishedAt < value.lastCollectedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["lastPublishedAt"],
        message: "Invalid publication order",
      });
    if (
      value.nextRunAt &&
      Date.parse(value.nextRunAt) !== Date.parse(value.cycleAt) + QLIK_COLLECTION_INTERVAL_MS
    )
      context.addIssue({ code: "custom", path: ["nextRunAt"], message: "Invalid schedule" });
  });
export type QlikStatusObservation = z.infer<typeof qlikStatusObservationSchema>;
export const qlikStatusSnapshotSchema = z
  .object({
    state: z.enum([
      "waiting",
      "unconfigured",
      "running",
      "succeeded",
      "reauth_required",
      "unavailable",
      "stale",
    ]),
    checkedAt: timestamp.nullable(),
    receivedAt: timestamp.nullable(),
    lastCollectedAt: timestamp.nullable(),
    lastPublishedAt: timestamp.nullable(),
    sourceUpdatedAt: timestamp.nullable(),
    nextRunAt: timestamp.nullable(),
  })
  .strict();
export type QlikStatusSnapshot = z.infer<typeof qlikStatusSnapshotSchema>;
export function emptyQlikStatus(
  state: QlikStatusSnapshot["state"] = "waiting",
): QlikStatusSnapshot {
  return {
    state,
    checkedAt: null,
    receivedAt: null,
    lastCollectedAt: null,
    lastPublishedAt: null,
    sourceUpdatedAt: null,
    nextRunAt: null,
  };
}
