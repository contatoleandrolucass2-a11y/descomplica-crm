import "server-only";

import { createClient } from "@/lib/auth/supabase/server";

import { usefulLinksDocumentSchema, type UsefulLinksDocument } from "./document";

type UsefulLinksResult =
  | { data: UsefulLinksDocument | null; error: null }
  | { data: null; error: { code?: string | null } };

export async function getUsefulLinksDocument(pageKey: string): Promise<UsefulLinksResult> {
  const supabase = await createClient();
  const result = await supabase.rpc("get_useful_links_document", { p_page_key: pageKey });
  if (result.error) return { data: null, error: result.error };
  if (result.data === null) return { data: null, error: null };
  const parsed = usefulLinksDocumentSchema.safeParse(result.data);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: { code: "INVALID_RPC_RESPONSE" } };
}

export async function saveUsefulLinksDocument(
  document: UsefulLinksDocument,
): Promise<UsefulLinksResult> {
  const supabase = await createClient();
  const result = await supabase.rpc("save_useful_links_document", {
    p_page_key: document.pageKey,
    p_expected_revision: document.revision,
    p_document: document,
  });
  if (result.error) return { data: null, error: result.error };
  const parsed = usefulLinksDocumentSchema.safeParse(result.data);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: { code: "INVALID_RPC_RESPONSE" } };
}
