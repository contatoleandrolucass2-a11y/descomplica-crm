import { enforcePageAccess } from "@/lib/authorization/enforce";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { UsefulLinksContent } from "../UsefulLinksContent";

const page = usefulLinksPages.find((entry) => entry.slug === "relacionamento")!;
export const metadata = { title: page.title };

export default async function UsefulLinksPage() {
  await enforcePageAccess("/app/links-uteis/relacionamento");
  return <UsefulLinksContent page={page} />;
}
