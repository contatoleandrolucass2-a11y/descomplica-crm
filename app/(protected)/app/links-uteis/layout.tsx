import type { ReactNode } from "react";

import { enforceAuthorization } from "@/lib/authorization/enforce";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";

import { UsefulLinksSidebar } from "./UsefulLinksSidebar";

export default async function UsefulLinksLayout({ children }: { children: ReactNode }) {
  const context = await enforceAuthorization();
  const navigation = await getAuthorizedNavigation(context);
  const pages = navigation
    .filter((page) => page.key === "crm.useful_links" || page.parentKey === "crm.useful_links")
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ key, name, path }) => ({ key, name, path }));

  return <UsefulLinksSidebar pages={pages}>{children}</UsefulLinksSidebar>;
}
