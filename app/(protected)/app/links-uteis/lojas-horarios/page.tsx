import { enforcePageAccess } from "@/lib/authorization/enforce";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { UsefulLinksContent } from "../UsefulLinksContent";

const page = usefulLinksPages.find((entry) => entry.slug === "lojas-horarios")!;
export const metadata = { title: page.title };

export default async function UsefulLinksPage() {
  await enforcePageAccess("/app/links-uteis/lojas-horarios");
  return <UsefulLinksContent page={page} />;
}
