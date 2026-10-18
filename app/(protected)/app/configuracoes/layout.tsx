import type { ReactNode } from "react";

import { enforceAuthorization } from "@/lib/authorization/enforce";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await enforceAuthorization();
  return children;
}
