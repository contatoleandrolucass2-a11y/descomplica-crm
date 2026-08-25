import type { ReactNode } from "react";

import { enforcePermission } from "@/lib/authorization/enforce";

// Keep the exact partnership gate above the page/loading boundary so a direct
// request denied by RBAC receives a real HTTP 403 before Next.js streams the
// protected app shell. The page guard remains as defense in depth.
export default async function PartnershipsChannelLayout({ children }: { children: ReactNode }) {
  await enforcePermission("crm.partnerships.view");
  return children;
}
