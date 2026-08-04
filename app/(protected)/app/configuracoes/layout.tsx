import type { ReactNode } from "react";

import { enforcePermission } from "@/lib/authorization/enforce";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await enforcePermission("crm.settings.view");
  return children;
}
