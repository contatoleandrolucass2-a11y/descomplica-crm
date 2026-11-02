import { createHash } from "node:crypto";
import { z } from "zod";

const filtersSchema = z.object({
  q: z.string().max(2000).default(""),
  owner: z.string().max(100).default(""),
  status: z.enum(["all", "active", "archived"]).default("all"),
  category: z.enum(["todo", "visits", "future", "favorites", "all"]).default("todo"),
});
const requestSchema = filtersSchema
  .extend({
    limit: z.coerce.number().int().min(1).max(100),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();
const invalidCursor = () =>
  Object.assign(new Error("A página não corresponde ao recorte atual. Atualize a lista."), {
    status: 422,
  });

/** Cursor contains ordering keys, never an authorization decision or cached permission. */
export function leadPageRequest(searchParams, { ownerIds, actorId }, now = new Date()) {
  const { limit, cursor, ...filters } = requestSchema.parse(Object.fromEntries(searchParams));
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        actorId,
        ownerIds: ownerIds === null ? null : [...ownerIds].sort(),
        filters,
      }),
    )
    .digest("hex");
  let after = null;
  let asOf = now.toISOString();
  if (cursor) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw invalidCursor();
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (
        value.v !== 1 ||
        value.f !== fingerprint ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.at) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.created) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) ||
        !Number.isFinite(Date.parse(value.created)) ||
        new Date(value.at).toISOString() !== value.at ||
        Date.parse(value.at) > +now
      )
        throw invalidCursor();
      asOf = value.at;
      after = { created: value.created, id: value.id };
    } catch {
      throw invalidCursor();
    }
  }
  return { ownerIds, actorId, filters, limit, fingerprint, asOf, after };
}

export function nextLeadCursor(context, last) {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      f: context.fingerprint,
      at: context.asOf,
      created: last.cursor_created_at,
      id: last.id,
    }),
  ).toString("base64url");
}
