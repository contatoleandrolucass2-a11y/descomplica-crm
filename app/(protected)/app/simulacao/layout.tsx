import type { ReactNode } from "react";

import { enforcePermission } from "@/lib/authorization/enforce";

// Page visibility and engine execution remain separate gates. This layout
// enforces only the Master-scoped simulator page permission before streaming;
// every page/endpoint still rechecks its own execution contract.
export default async function SimulationLayout({ children }: { children: ReactNode }) {
  await enforcePermission("crm.simulators.view");
  return children;
}
