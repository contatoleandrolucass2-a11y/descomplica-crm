import { enforcePageAccess } from "@/lib/authorization/enforce";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { UsefulLinksContent } from "../UsefulLinksContent";

const page = usefulLinksPages.find((entry) => entry.slug === "app-bora-vender")!;
export const metadata = { title: page.title };

export default async function UsefulLinksPage() {
  await enforcePageAccess("/app/links-uteis/app-bora-vender");
  return <UsefulLinksContent page={page} />;
}
