import { z } from "zod";

export const routineRoleSchema = z.enum([
  "regional-house",
  "regional-imob",
  "gerente-house",
  "coordenador-vendas",
  "coordenador-parcerias",
  "corretor",
]);
export const routineRowSchema = z
  .object({
    "Segunda-feira": z.string().max(4000),
    "Terça-feira": z.string().max(4000),
    "Quarta-feira": z.string().max(4000),
    "Quinta-feira": z.string().max(4000),
    "Sexta-feira": z.string().max(4000),
    Sábado: z.string().max(4000),
    Domingo: z.string().max(4000),
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
