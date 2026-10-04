import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
} from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getManageablePages } from "@/lib/navigation/pages";

import { PageCatalogManager } from "./PageCatalogManager";

export const metadata = { title: "Catálogo de páginas" };

export default async function PagesAdminPage() {
  await enforcePermission("pages.manage");
  const pages = await getManageablePages();

  return (
    <ManagementPage>
      <ManagementPageHeader
        eyebrow="Administração"
        title="Catálogo de páginas"
        description="Ative ou desative entradas de navegação sem alterar a autorização protegida de cada rota."
        status={<ManagementStatusBadge>Governança do catálogo</ManagementStatusBadge>}
      />
      <PageCatalogManager pages={pages} />
    </ManagementPage>
  );
}
