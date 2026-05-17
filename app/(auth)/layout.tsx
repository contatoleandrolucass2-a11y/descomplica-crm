/**
 * Route group shell for unauthenticated auth surfaces.
 *
 * The (auth) segment is a Next.js route group: it organizes files without
 * appearing in URLs. A future login page at app/(auth)/login/page.tsx will
 * be served at /login, not at /(auth)/login.
 *
 * This layout is intentionally a structural pass-through in M3:
 *   - No authentication logic lives here.
 *   - No Supabase client is created here.
 *   - No redirects are issued here.
 * Real surfaces (login, sign-up, recovery, verification) arrive in M4+.
 *
 * Per PROJECT_STRUCTURE_PLAN.md > Folder Structure Proposal.
 */

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
