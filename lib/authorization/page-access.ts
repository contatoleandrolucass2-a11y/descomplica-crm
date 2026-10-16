import "server-only";

import { createClient } from "@/lib/auth/supabase/server";
import { hasPersistedPageAccess } from "@/lib/navigation/page-access";
import { requireAuthorization } from "./guards";
import { AuthorizationError } from "./types";

export async function requirePageAccess(pathname: string, allowSessionRefresh = true) {
  const context = await requireAuthorization(allowSessionRefresh);
  const client = await createClient(allowSessionRefresh ? {} : { allowSessionRefresh: false });
  if (!(await hasPersistedPageAccess(client, pathname, context.roleKey, context.permissions))) {
    throw new AuthorizationError("FORBIDDEN", "Page access denied.");
  }
  return context;
}
