import { enforcePageAccess } from "@/lib/authorization/enforce";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { UsefulLinksContent } from "../UsefulLinksContent";

const page = usefulLinksPages.find((entry) => entry.slug === "regras-comerciais")!;
export const metadata = { title: page.title };

export default async function UsefulLinksPage() {
  await enforcePageAccess("/app/links-uteis/regras-comerciais");
  return <UsefulLinksContent page={page} />;
}
