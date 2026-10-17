import { z } from "zod";

export const META_ADS_ACCOUNT_ID = "1080988750909489";
export const META_ADS_BUSINESS_ID = "310106776631136";
export const META_ADS_MANAGER_URL =
  "https://adsmanager.facebook.com/adsmanager/manage/campaigns/?global_scope_id=310106776631136&business_id=310106776631136&act=1080988750909489&nav_entry_point=am_global_scope_selector";
export const META_ADS_STATUS_PATH = "/api/meta-ads/status";
export const META_ADS_STATUS_TTL_MS = 120_000;

export const metaAdsObservationSchema = z
  .object({
    version: z.literal(1),
    accountId: z.literal(META_ADS_ACCOUNT_ID),
    businessId: z.literal(META_ADS_BUSINESS_ID),
    observedAt: z.iso.datetime(),
    state: z.enum(["connected", "reauth_required", "unavailable", "wrong_account"]),
  })
  .strict();
export type MetaAdsObservation = z.infer<typeof metaAdsObservationSchema>;

export const metaAdsConnectionSnapshotSchema = z
  .object({
    accountId: z.literal(META_ADS_ACCOUNT_ID),
    businessId: z.literal(META_ADS_BUSINESS_ID),
    state: z.enum([
      "unconfigured",
      "waiting",
      "connected",
      "reauth_required",
      "unavailable",
      "stale",
      "wrong_account",
    ]),
    checkedAt: z.iso.datetime().nullable(),
    receivedAt: z.iso.datetime().nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.state !== "connected" || (value.checkedAt !== null && value.receivedAt !== null),
  );
export type MetaAdsConnectionSnapshot = z.infer<typeof metaAdsConnectionSnapshotSchema>;

export function emptyMetaAdsConnectionSnapshot(
  state: MetaAdsConnectionSnapshot["state"] = "waiting",
): MetaAdsConnectionSnapshot {
  return {
    accountId: META_ADS_ACCOUNT_ID,
    businessId: META_ADS_BUSINESS_ID,
    state,
    checkedAt: null,
    receivedAt: null,
  };
}
