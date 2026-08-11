import "server-only";

import { createClient } from "@/lib/auth/supabase/server";
import type { GoalProfileKey } from "@/lib/crm/goals/catalog";

import {
  commercialConfigurationDraftSchema,
  funnelGoalsDraftPayloadSchema,
  pointSettingsDraftPayloadSchema,
} from "./drafts";

async function loadDraft(engineKey: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_crm_commercial_configuration_draft", {
    p_engine_key: engineKey,
  });
  // App-first compatibility: the production schema may legitimately precede
  // this additive RPC while the release train is still blocked. Only the
  // precise PostgREST "function absent from schema cache" state falls back to
  // legacy read-only rendering; permission, network and validation failures
  // remain fatal.
  if (error?.code === "PGRST202") return null;
  if (error) throw new Error("Não foi possível carregar o rascunho comercial.");
  if (data === null) return null;
  return commercialConfigurationDraftSchema.parse(data);
}

export async function loadFunnelGoalsDraft(profile: GoalProfileKey) {
  const engineKey = profile === "dv" ? "goals.dv" : "goals.partnerships";
  const draft = await loadDraft(engineKey);
  if (!draft) return null;
  const payload = funnelGoalsDraftPayloadSchema.parse(draft.payload);
  if (payload.profile !== profile || draft.engineKey !== engineKey) {
    throw new Error("O rascunho de metas não corresponde ao perfil solicitado.");
  }
  return { ...draft, payload };
}

export async function loadPointSettingsDraft() {
  const draft = await loadDraft("points.ranking");
  if (!draft) return null;
  const payload = pointSettingsDraftPayloadSchema.parse(draft.payload);
  if (draft.engineKey !== "points.ranking") {
    throw new Error("O rascunho de pontos não corresponde ao motor solicitado.");
  }
  return { ...draft, payload };
}
