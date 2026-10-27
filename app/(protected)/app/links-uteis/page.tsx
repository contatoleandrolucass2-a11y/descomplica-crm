import {
  ManagementPage,
  ManagementPageHeader,
} from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePageAccess } from "@/lib/authorization/enforce";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";

import { UsefulLinksCards } from "./UsefulLinksContent";
import styles from "./UsefulLinks.module.css";

export const metadata = { title: "Links Úteis" };

export default async function UsefulLinksHubPage() {
  const context = await enforcePageAccess("/app/links-uteis");
  const navigation = await getAuthorizedNavigation(context);
  const pages = usefulLinksPages.filter((page) =>
    navigation.some((entry) => entry.path === `/app/links-uteis/${page.slug}`),
  );

  return (
    <ManagementPage className={styles.canvas!}>
      <ManagementPageHeader
        eyebrow="Apoio comercial"
        title="Links Úteis"
        description="Contatos, lojas, orientações e materiais para o seu dia a dia."
      />
      {pages.length ? (
        <UsefulLinksCards pages={pages} />
      ) : (
        <p>Nenhum conteúdo liberado para o seu acesso.</p>
      )}
    </ManagementPage>
  );
}
