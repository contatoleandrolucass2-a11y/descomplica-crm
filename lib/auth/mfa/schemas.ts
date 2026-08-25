import { z } from "zod";

export const factorIdSchema = z.uuid();
export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
