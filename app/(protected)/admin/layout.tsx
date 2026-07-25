/**
 * Sub-layout for /admin (M6.4).
 *
 * Nested under app/(protected)/layout.tsx, which already requires an
 * authenticated session. This layout adds the permission gate: only callers
 * holding admin.access reach the admin subtree. The redirect (to /login or
 * /unauthorized) is centralized inside enforcePermission — this file never
 * redirects or catches errors itself.
 */

import type { ReactNode } from "react";

import { enforcePermission } from "@/lib/authorization/enforce";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await enforcePermission("admin.access");

  return <>{children}</>;
}
