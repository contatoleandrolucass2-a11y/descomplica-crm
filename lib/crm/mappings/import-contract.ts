import { createHash } from "node:crypto";

import { z } from "zod";

const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/)
  .max(100);
const uuidSchema = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const timestampSchema = z.string().datetime({ offset: true });
const externalIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => !controlCharacterPattern.test(value));
const evidenceReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_000)
  .refine((value) => !controlCharacterPattern.test(value));
const reasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => !controlCharacterPattern.test(value));

export const mappingEntityKindSchema = z.enum([
  "person",
  "organization",
  "team",
  "portfolio",
  "reporting_scope",
  "origin",
  "development",
  "location",
]);

const mappingReviewBaseShape = {
  requestId: uuidSchema,
  source: slugSchema,
  entityKind: mappingEntityKindSchema,
  externalId: externalIdSchema,
  reason: reasonSchema,
} as const;

const verifyMappingReviewPayloadSchema = z
  .object({
    ...mappingReviewBaseShape,
    ownerKey: slugSchema,
    targetId: uuidSchema,
    decision: z.literal("verify"),
    effectiveFrom: timestampSchema,
    evidenceReference: evidenceReferenceSchema,
  })
  .strict();

const rejectMappingReviewPayloadSchema = z
  .object({
    ...mappingReviewBaseShape,
    decision: z.literal("reject"),
    evidenceReference: evidenceReferenceSchema.optional(),
  })
  .strict();

export const mappingReviewPayloadSchema = z.discriminatedUnion("decision", [
  verifyMappingReviewPayloadSchema,
  rejectMappingReviewPayloadSchema,
]);

export const mappingImportManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    batchRequestId: uuidSchema,
    generatedAt: timestampSchema,
    evidenceReference: evidenceReferenceSchema,
    mappings: z.array(mappingReviewPayloadSchema).min(1).max(500),
  })
  .strict()
  .superRefine((manifest, context) => {
    const requestIds = new Set<string>();
    const externalIdentities = new Set<string>();

    for (const [index, mapping] of manifest.mappings.entries()) {
      if (requestIds.has(mapping.requestId)) {
        context.addIssue({
          code: "custom",
          message: "mapping request IDs must be unique",
          path: ["mappings", index, "requestId"],
        });
      }
      requestIds.add(mapping.requestId);

      const externalIdentity = JSON.stringify([
        mapping.source,
        mapping.entityKind,
        mapping.externalId,
      ]);
      if (externalIdentities.has(externalIdentity)) {
        context.addIssue({
          code: "custom",
          message: "source identities must be unique within a mapping batch",
          path: ["mappings", index, "externalId"],
        });
      }
      externalIdentities.add(externalIdentity);
    }
  });

export const mappingImportDispositionSchema = z.enum([
  "create_verified",
  "promote_pending",
  "record_rejection",
  "reject_pending",
  "close_verified",
  "conflict",
]);

const mappingImportReasonCodeSchema = z
  .string()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/)
  .max(100);

export const mappingImportPlanItemSchema = z
  .object({
    requestId: uuidSchema,
    source: slugSchema,
    entityKind: mappingEntityKindSchema,
    externalId: externalIdSchema,
    disposition: mappingImportDispositionSchema,
    reasonCode: mappingImportReasonCodeSchema.nullable(),
    sourceIdentityId: uuidSchema.nullable(),
    reconciliationItemId: uuidSchema.nullable(),
  })
  .strict();

export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const mappingImportRpcResultSchema = z
  .object({
    ok: z.boolean(),
    mode: z.enum(["preview", "apply"]),
    ready: z.boolean(),
    manifestHash: sha256Schema,
    planHash: sha256Schema,
    mappingCount: z.number().int().min(0).max(500),
    conflictCount: z.number().int().min(0).max(500),
    appliedCount: z.number().int().min(0).max(500),
    noop: z.boolean(),
    items: z.array(mappingImportPlanItemSchema).max(500),
  })
  .strict()
  .superRefine((result, context) => {
    const derivedConflictCount = result.items.filter(
      (item) => item.disposition === "conflict",
    ).length;

    if (result.mappingCount !== result.items.length) {
      context.addIssue({
        code: "custom",
        message: "mapping count must match plan items",
        path: ["mappingCount"],
      });
    }
    if (result.conflictCount !== derivedConflictCount) {
      context.addIssue({
        code: "custom",
        message: "conflict count must match conflict dispositions",
        path: ["conflictCount"],
      });
    }
    if (result.ready !== (result.conflictCount === 0)) {
      context.addIssue({
        code: "custom",
        message: "ready must be false whenever the plan contains conflicts",
        path: ["ready"],
      });
    }
    if (result.mode === "preview" && result.appliedCount !== 0) {
      context.addIssue({
        code: "custom",
        message: "preview results cannot report applied mappings",
        path: ["appliedCount"],
      });
    }
    if (result.appliedCount > result.mappingCount - result.conflictCount) {
      context.addIssue({
        code: "custom",
        message: "applied count exceeds actionable mappings",
        path: ["appliedCount"],
      });
    }
  });

export type MappingEntityKind = z.infer<typeof mappingEntityKindSchema>;
export type MappingReviewPayload = z.infer<typeof mappingReviewPayloadSchema>;
export type MappingImportManifest = z.infer<typeof mappingImportManifestSchema>;
export type MappingImportDisposition = z.infer<typeof mappingImportDispositionSchema>;
export type MappingImportPlanItem = z.infer<typeof mappingImportPlanItemSchema>;
export type MappingImportRpcResult = z.infer<typeof mappingImportRpcResultSchema>;

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function mappingSortKey(mapping: MappingReviewPayload): string {
  return JSON.stringify([
    mapping.source,
    mapping.entityKind,
    mapping.externalId,
    mapping.requestId,
  ]);
}

function canonicalMapping(mapping: MappingReviewPayload): MappingReviewPayload {
  if (mapping.decision === "verify") {
    return {
      requestId: mapping.requestId,
      source: mapping.source,
      entityKind: mapping.entityKind,
      externalId: mapping.externalId,
      ownerKey: mapping.ownerKey,
      targetId: mapping.targetId,
      decision: mapping.decision,
      effectiveFrom: mapping.effectiveFrom,
      evidenceReference: mapping.evidenceReference,
      reason: mapping.reason,
    };
  }

  return {
    requestId: mapping.requestId,
    source: mapping.source,
    entityKind: mapping.entityKind,
    externalId: mapping.externalId,
    decision: mapping.decision,
    ...(mapping.evidenceReference ? { evidenceReference: mapping.evidenceReference } : {}),
    reason: mapping.reason,
  };
}

export function canonicalizeMappingImportManifest(input: unknown): MappingImportManifest {
  const manifest = mappingImportManifestSchema.parse(input);
  const mappings = manifest.mappings
    .map(canonicalMapping)
    .sort((left, right) => compareUtf8(mappingSortKey(left), mappingSortKey(right)));

  return {
    schemaVersion: 1,
    batchRequestId: manifest.batchRequestId,
    generatedAt: manifest.generatedAt,
    evidenceReference: manifest.evidenceReference,
    mappings,
  };
}

export function serializeCanonicalMappingImportManifest(input: unknown): string {
  return JSON.stringify(canonicalizeMappingImportManifest(input));
}

export function hashMappingImportManifest(input: unknown): string {
  return createHash("sha256").update(serializeCanonicalMappingImportManifest(input)).digest("hex");
}

export function parseMappingImportManifest(input: unknown): MappingImportManifest {
  return mappingImportManifestSchema.parse(input);
}
