import { z } from "zod";
import { routineRoleSchema, routineRowSchema } from "@/lib/crm/routines";

export const routineCompletionSchema = z
  .object({
    role_key: routineRoleSchema,
    row_index: z.number().int().min(0).max(199),
    day: routineRowSchema.keyof(),
    activity_text: z
      .string()
      .min(1)
      .max(4000)
      .refine((text) => text.length <= 4000, "The activity text exceeds the UTF-16 storage limit.")
      .refine((text) => text.trim().length > 0),
  })
  .strict();

export const routineCompletionSaveSchema = routineCompletionSchema.extend({
  expected_week_start: z.iso.date(),
  completed: z.boolean(),
});

export const routineCompletionSnapshotSchema = z
  .object({
    week_start: z.iso.date(),
    resets_at: z.string().datetime({ offset: true }),
    server_now: z.string().datetime({ offset: true }),
    completions: z.array(routineCompletionSchema).max(8400),
  })
  .strict()
  .refine(
    ({ completions }) =>
      new Set(completions.map(({ role_key, row_index, day }) => `${role_key}:${row_index}:${day}`))
        .size === completions.length,
  );

export type RoutineCompletion = z.infer<typeof routineCompletionSchema>;
export type RoutineCompletionSave = z.infer<typeof routineCompletionSaveSchema>;
export type RoutineCompletionSnapshot = z.infer<typeof routineCompletionSnapshotSchema>;
