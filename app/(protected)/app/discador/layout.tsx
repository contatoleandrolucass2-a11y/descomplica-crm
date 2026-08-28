import type { ReactNode } from "react";

import { enforcePermission } from "@/lib/authorization/enforce";

export default async function DialerLayout({ children }: { children: ReactNode }) {
  await enforcePermission("crm.dialer.view");
  return children;
}
