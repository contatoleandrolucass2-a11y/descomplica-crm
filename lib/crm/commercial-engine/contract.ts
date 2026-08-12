import { z } from "zod";

import { COMMERCIAL_ENGINE_KEYS } from "./catalog.ts";
import type { DecimalRoundingMode } from "./decimal.ts";

const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;
const keyPattern = /^[a-z][a-z0-9]*([._-][a-z0-9]+)*$/;
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

const boundedTextSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => value === value.trim() && !controlCharacterPattern.test(value));
const keySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(keyPattern)
  .refine((value) => value === value.trim());
const uuidSchema = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
export const commercialDecimalStringSchema = z
  .string()
  .max(44)
  .regex(decimalPattern)
  .refine((value) => value.replace(/[-.]/g, "").length <= 30);

export const commercialValueTypeSchema = z.enum(["decimal", "boolean", "string", "date"]);
export type CommercialValueType = z.infer<typeof commercialValueTypeSchema>;

export type CommercialExpression =
  | { op: "literal"; valueType: CommercialValueType; value: string | boolean }
  | { op: "input"; key: string }
  | {
      op: "add" | "multiply" | "min" | "max" | "and" | "or" | "concat";
      args: CommercialExpression[];
    }
  | { op: "subtract"; left: CommercialExpression; right: CommercialExpression }
  | {
      op: "divide";
      numerator: CommercialExpression;
      denominator: CommercialExpression;
      scale: number;
      rounding: DecimalRoundingMode;
    }
  | {
      op: "round";
      value: CommercialExpression;
      scale: number;
      rounding: DecimalRoundingMode;
    }
  | {
      op: "compare";
      comparator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
      left: CommercialExpression;
      right: CommercialExpression;
    }
  | { op: "not"; value: CommercialExpression }
  | {
      op: "if";
      condition: CommercialExpression;
      then: CommercialExpression;
      else: CommercialExpression;
    }
  | {
      op: "date_add_days";
      date: CommercialExpression;
      amount: CommercialExpression;
    }
  | {
      op: "date_add_months";
      date: CommercialExpression;
      amount: CommercialExpression;
      overflow: "reject" | "clamp";
    }
  | {
      op: "date_diff_days";
      start: CommercialExpression;
      end: CommercialExpression;
    };

const roundingSchema = z.enum(["down", "up", "floor", "ceil", "half_up", "half_even"]);

export const commercialExpressionSchema: z.ZodType<CommercialExpression> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z
      .object({
        op: z.literal("literal"),
        valueType: commercialValueTypeSchema,
        value: z.union([z.string().max(1_000), z.boolean()]),
      })
      .strict(),
    z.object({ op: z.literal("input"), key: keySchema }).strict(),
    z
      .object({
        op: z.enum(["add", "multiply", "min", "max", "and", "or", "concat"]),
        args: z.array(commercialExpressionSchema).min(2).max(20),
      })
      .strict(),
    z
      .object({
        op: z.literal("subtract"),
        left: commercialExpressionSchema,
        right: commercialExpressionSchema,
      })
      .strict(),
    z
      .object({
        op: z.literal("divide"),
        numerator: commercialExpressionSchema,
        denominator: commercialExpressionSchema,
        scale: z.number().int().min(0).max(18),
        rounding: roundingSchema,
      })
      .strict(),
    z
      .object({
        op: z.literal("round"),
        value: commercialExpressionSchema,
        scale: z.number().int().min(0).max(18),
        rounding: roundingSchema,
      })
      .strict(),
    z
      .object({
        op: z.literal("compare"),
        comparator: z.enum(["eq", "neq", "lt", "lte", "gt", "gte"]),
        left: commercialExpressionSchema,
        right: commercialExpressionSchema,
      })
      .strict(),
    z.object({ op: z.literal("not"), value: commercialExpressionSchema }).strict(),
    z
      .object({
        op: z.literal("if"),
        condition: commercialExpressionSchema,
        then: commercialExpressionSchema,
        else: commercialExpressionSchema,
      })
      .strict(),
    z
      .object({
        op: z.literal("date_add_days"),
        date: commercialExpressionSchema,
        amount: commercialExpressionSchema,
      })
      .strict(),
    z
      .object({
        op: z.literal("date_add_months"),
        date: commercialExpressionSchema,
        amount: commercialExpressionSchema,
        overflow: z.enum(["reject", "clamp"]),
      })
      .strict(),
    z
      .object({
        op: z.literal("date_diff_days"),
        start: commercialExpressionSchema,
        end: commercialExpressionSchema,
      })
      .strict(),
  ]),
);

export const commercialPolicyDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    runtimeVersion: z.literal(1),
    inputs: z
      .array(
        z
          .object({
            key: keySchema,
            valueType: commercialValueTypeSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    outputs: z
      .array(
        z
          .object({
            key: keySchema,
            valueType: commercialValueTypeSchema,
            expression: commercialExpressionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

const unknownRecordSchema = z.record(z.string().max(100), z.unknown());

export const commercialGoldenCaseSchema = z
  .object({
    caseKey: keySchema,
    input: unknownRecordSchema,
    expected: unknownRecordSchema,
  })
  .strict();

export const commercialPolicyDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    engineKey: z.enum(COMMERCIAL_ENGINE_KEYS),
    version: z.number().int().min(1).max(1_000_000),
    effectiveFrom: timestampSchema,
    effectiveUntil: timestampSchema.nullable().optional(),
    timezone: z.literal("America/Sao_Paulo"),
    ownerKey: keySchema,
    backupOwnerKey: keySchema,
    evidenceReference: boundedTextSchema,
    changeReason: boundedTextSchema.max(500),
    definition: commercialPolicyDefinitionSchema,
    goldenCases: z.array(commercialGoldenCaseSchema).min(1).max(100),
  })
  .strict()
  .superRefine((document, context) => {
    if (document.ownerKey === document.backupOwnerKey) {
      context.addIssue({
        code: "custom",
        message: "owner and backup owner must be different",
        path: ["backupOwnerKey"],
      });
    }
    if (
      document.effectiveUntil &&
      new Date(document.effectiveUntil).getTime() <= new Date(document.effectiveFrom).getTime()
    ) {
      context.addIssue({
        code: "custom",
        message: "effectiveUntil must be after effectiveFrom",
        path: ["effectiveUntil"],
      });
    }

    for (const [path, values] of [
      [["definition", "inputs"], document.definition.inputs.map((item) => item.key)],
      [["definition", "outputs"], document.definition.outputs.map((item) => item.key)],
      [["goldenCases"], document.goldenCases.map((item) => item.caseKey)],
    ] as const) {
      const seen = new Set<string>();
      for (const [index, value] of values.entries()) {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            message: "keys must be unique",
            path: [...path, index],
          });
        }
        seen.add(value);
      }
    }
  });

export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const commercialPolicyImportManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: uuidSchema,
    policy: commercialPolicyDocumentSchema,
    policyHash: sha256Schema,
    goldenReportHash: sha256Schema,
  })
  .strict();

export const commercialEngineRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: uuidSchema,
    input: unknownRecordSchema,
  })
  .strict();

export type CommercialPolicyDefinition = z.infer<typeof commercialPolicyDefinitionSchema>;
export type CommercialPolicyDocument = z.infer<typeof commercialPolicyDocumentSchema>;
export type CommercialPolicyImportManifest = z.infer<typeof commercialPolicyImportManifestSchema>;
export type CommercialEngineRequest = z.infer<typeof commercialEngineRequestSchema>;
