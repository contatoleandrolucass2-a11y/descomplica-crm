/**
 * Route group shell for authenticated, verified-only surfaces.
 *
 * The (protected) segment is a Next.js route group: it organizes files
 * without appearing in URLs. A future protected page at
 * app/(protected)/dashboard/page.tsx will be served at /dashboard, not at
 * /(protected)/dashboard.
 *
 * This layout is intentionally a structural pass-through in M3:
 *   - No authentication checks live here.
 *   - No Supabase client is created here.
 *   - No redirects are issued here.
 * Real route protection (per ROUTE_PROTECTION.md and B10 verification gate)
 * arrives in M4+ once login and verification-pending surfaces exist and
 * actual protected paths are introduced.
 *
 * Per PROJECT_STRUCTURE_PLAN.md > Folder Structure Proposal.
 */

import type { ReactNode } from "react";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
