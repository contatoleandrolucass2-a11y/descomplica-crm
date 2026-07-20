import "server-only";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "./guards";
import { AuthorizationError } from "./types";

// Read-only accessor for `public.audit_logs` (M5.1). Never inserts, updates,
// or deletes — rows are appended exclusively by SECURITY DEFINER admin
// functions (M5.2). RLS (`audit_logs_select_with_audit_view`) is the final
// authority; `requirePermission("audit.view")` here is an early UX gate only.

export interface AuditLogEntry {
  id: number;
  actorId: string | null;
  targetUserId: string | null;
  action: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ListAuditLogsOptions {
  actorId?: string;
  targetUserId?: string;
  action?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Sanitize a caller-supplied limit: coerce to a whole number in [1, 100],
// falling back to the default for undefined / non-finite input.
function normalizeLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

interface AuditLogRow {
  id: number;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function listAuditLogs(options: ListAuditLogsOptions = {}): Promise<AuditLogEntry[]> {
  await requirePermission("audit.view");

  const limit = normalizeLimit(options?.limit);

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, target_user_id, action, before, after, ip, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.actorId) {
    query = query.eq("actor_id", options.actorId);
  }
  if (options.targetUserId) {
    query = query.eq("target_user_id", options.targetUserId);
  }
  if (options.action) {
    query = query.eq("action", options.action);
  }

  const { data, error } = await query;

  if (error) {
    throw new AuthorizationError("FORBIDDEN", "Authorization check failed.");
  }

  const rows = (data ?? []) as AuditLogRow[];

  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    targetUserId: row.target_user_id,
    action: row.action,
    before: row.before,
    after: row.after,
    ipAddress: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}
