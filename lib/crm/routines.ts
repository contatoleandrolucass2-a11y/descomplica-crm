import { z } from "zod";

export const routineRoleSchema = z.enum([
  "regional-house",
  "regional-imob",
  "gerente-house",
  "coordenador-vendas",
  "coordenador-parcerias",
  "corretor",
]);
const routineTextSchema = z
  .string()
  .max(4000)
  .refine((value) => value.length <= 4000, "The routine text exceeds the UTF-16 storage limit.");
export const routineRowSchema = z
  .object({
    "Segunda-feira": routineTextSchema,
    "Terça-feira": routineTextSchema,
    "Quarta-feira": routineTextSchema,
    "Quinta-feira": routineTextSchema,
    "Sexta-feira": routineTextSchema,
    Sábado: routineTextSchema,
    Domingo: routineTextSchema,
  })
  .strict();
export const routineRowsSchema = z.array(routineRowSchema).max(200);
export const routineRecordSchema = z.object({
  role_key: routineRoleSchema,
  rows: routineRowsSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  updated_at: z.string().datetime({ offset: true }),
});
export const routineSnapshotSchema = z
  .object({
    routines: z.array(routineRecordSchema).max(6),
    can_edit: z.boolean(),
  })
  .refine(
    (value) => new Set(value.routines.map((row) => row.role_key)).size === value.routines.length,
  );
export const routineSaveSchema = z
  .object({
    role_key: routineRoleSchema,
    rows: routineRowsSchema,
    expected_revision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .strict();

export type RoutineSnapshot = z.infer<typeof routineSnapshotSchema>;
