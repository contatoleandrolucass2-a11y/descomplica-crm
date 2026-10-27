import { enforcePageAccess } from "@/lib/authorization/enforce";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { UsefulLinksContent } from "../UsefulLinksContent";

const page = usefulLinksPages.find((entry) => entry.slug === "campanha-do-mes")!;
export const metadata = { title: page.title };

export default async function UsefulLinksPage() {
  await enforcePageAccess("/app/links-uteis/campanha-do-mes");
  return <UsefulLinksContent page={page} />;
}
