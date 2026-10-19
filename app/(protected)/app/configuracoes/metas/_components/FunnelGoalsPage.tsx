import { loadFunnelGoalsDraft } from "@/lib/crm/commercial-engine/draft-data";
import { funnelDraftValuesToGoals } from "@/lib/crm/commercial-engine/drafts";
import { type GoalProfileKey } from "@/lib/crm/goals/catalog";
import { loadFunnelGoals } from "@/lib/crm/goals/data";
import { getGoalsReferenceDate } from "@/lib/crm/goals/reference";
import { GoalPlanning } from "./GoalPlanning";

export async function FunnelGoalsPage({
  canManageDraft,
  profile,
  notification,
}: {
  canManageDraft: boolean;
  profile: GoalProfileKey;
  notification?: "saved" | "validation" | "save";
}) {
  const [result, draft] = await Promise.all([
    loadFunnelGoals(profile),
    profile === "partnerships" && canManageDraft
      ? loadFunnelGoalsDraft(profile)
      : Promise.resolve(null),
  ]);
  const values = draft
    ? funnelDraftValuesToGoals(draft.payload, draft.updatedAt)
    : result.status === "ready"
      ? result.goals
      : null;
  const referenceDate = getGoalsReferenceDate();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
  return (
    <main
      aria-label={profile === "partnerships" ? "Metas do funil de parcerias" : "Metas do funil"}
    >
      <p className="px-5 py-2 text-xs text-[var(--analytics-muted)]" role="status">
        {canManageDraft
          ? profile === "dv"
            ? "Configuração atual: editável · Salve para aplicar as alterações"
            : "Base legada: somente leitura · Rascunho atual: editável"
          : "Base legada: somente leitura · Rascunho atual: indisponível"}
      </p>
      <GoalPlanning
        profile={profile}
        initialValues={values}
        canManageDraft={canManageDraft}
        revision={draft?.revision ?? 0}
        today={today}
        notification={notification}
      />
    </main>
  );
}
