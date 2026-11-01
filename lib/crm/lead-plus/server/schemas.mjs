import { z } from "zod";
const short = z.string().trim().max(250);
export const propertySchema = z
  .object({
    code: short.min(1),
    title: short.min(1),
    type: z.enum(["Apartamento", "Casa", "Terreno", "Comercial", "Outro"]),
    purpose: z.enum(["Venda", "Locação"]),
    price: z.number().min(0).max(1e12),
    area: z.number().min(0).max(1e8),
    bedrooms: z.number().int().min(0).max(100),
    bathrooms: z.number().int().min(0).max(100),
    parking: z.number().int().min(0).max(100),
    address: short,
    neighborhood: short,
    city: short,
    state: z.string().max(2),
    zipcode: z.string().max(12),
    description: z.string().max(10000),
    photo: z
      .string()
      .max(2048)
      .url()
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Use uma imagem HTTPS.")
      .or(z.literal("")),
    active: z.boolean(),
  })
  .strict();
export const invoiceSchema = z
  .object({
    row: z.tuple([
      short.min(1),
      short.min(1),
      short,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.string().regex(/^\d+(?:[.,]\d{1,2})?$/),
      z.enum(["Pendente", "Pago", "Cancelado"]),
    ]),
  })
  .strict();
