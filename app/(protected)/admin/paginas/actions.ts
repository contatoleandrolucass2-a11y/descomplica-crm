"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";

const visibilitySchema = z.object({
  pageKey: z.string().regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/),
  nextActive: z.boolean(),
  reason: z.string().trim().max(240).optional(),
});

export async function setPageVisibilityAction(
  pageKey: string,
  nextActive: boolean,
  formData: FormData,
): Promise<void> {
  await requirePermission("pages.manage");

  const input = visibilitySchema.parse({
    pageKey,
    nextActive,
    reason: formData.get("reason") || undefined,
  });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_app_page_active", {
    target_page_key: input.pageKey,
    target_is_active: input.nextActive,
    reason: input.reason ?? null,
  });

  if (error) throw new Error("Não foi possível alterar a visibilidade da página.");

  revalidatePath("/", "layout");
}
