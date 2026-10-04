"use client";

import { FileCheck2 } from "lucide-react";
import { useActionState, type ReactNode } from "react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import {
  initialCommercialDraftActionState,
  type CommercialDraftActionState,
} from "@/lib/crm/commercial-engine/drafts";

const BLOCKER_LABELS: Record<string, string> = {
  official_policy: "política ativa",
  owner: "responsável",
  backup_owner: "responsável substituto",
  golden_cases: "casos de ouro",
  approval: "aprovação",
  cohort_and_grant: "público e permissões",
  effective_date: "vigência",
  rollback: "plano de reversão",
};

export function ConfigurationDraftForm({
  action,
  children,
  enabled = true,
  saveLabel,
}: {
  action: (
    state: CommercialDraftActionState,
    formData: FormData,
  ) => Promise<CommercialDraftActionState>;
  children: ReactNode;
  enabled?: boolean;
  saveLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialCommercialDraftActionState);

  if (!enabled) {
    return (
      <section className="grid gap-3" aria-label="Rascunho indisponível">
        <fieldset disabled className="contents">
          {children}
        </fieldset>
        <div
          role="status"
          className={`${managementStyles.panel} ${managementStyles.panelPadded} ${managementStyles.muted} text-sm leading-6`}
        >
          <strong className="block text-[var(--analytics-ink)]">
            Rascunho indisponível para este perfil
          </strong>
          A base legada permanece somente leitura. Nenhuma validação ou gravação de política
          comercial foi liberada.
        </div>
      </section>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      {children}
      <section
        aria-label="Validação do rascunho"
        className={`${managementStyles.panel} ${managementStyles.panelPadded} ${managementStyles.panelStrong} grid gap-3`}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.48fr)] lg:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <span className={managementStyles.iconFrame} aria-hidden="true">
              <FileCheck2 />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-[var(--analytics-muted)]">
                <strong className="block text-[var(--analytics-ink)]">Revisão segura</strong>
                Esta operação valida ou salva somente um rascunho inativo. Ela não altera metas,
                ranking, política ativa, ativação, permissões ou dados realizados.
              </p>
              {state.status !== "idle" ? (
                <div
                  role={
                    state.status === "previewed" || state.status === "saved" ? "status" : "alert"
                  }
                  aria-live="polite"
                  className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
                    state.status === "previewed" || state.status === "saved"
                      ? "border-[var(--analytics-positive)] bg-[color-mix(in_srgb,var(--analytics-positive)_8%,var(--analytics-surface))] text-[var(--analytics-positive)]"
                      : "border-[var(--analytics-danger)] bg-[color-mix(in_srgb,var(--analytics-danger)_8%,var(--analytics-surface))] text-[var(--analytics-danger)]"
                  }`}
                >
                  <strong>{state.message}</strong>
                  {state.planFingerprint ? (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer underline underline-offset-2">
                        Detalhes técnicos
                      </summary>
                      <code className="mt-1 block break-all">Plano: {state.planFingerprint}</code>
                    </details>
                  ) : null}
                  {state.blockers?.length ? (
                    <span className="mt-1 block text-xs">
                      Ativação bloqueada por:{" "}
                      {state.blockers.map((item) => BLOCKER_LABELS[item] ?? item).join(", ")}.
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--analytics-ink)]">
            Motivo do rascunho
            <input
              name="draftReason"
              minLength={8}
              maxLength={500}
              required
              placeholder="Descreva a finalidade desta revisão"
              className="min-h-11 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-base font-normal text-[var(--analytics-ink)] outline-none focus:border-[var(--analytics-cyan-strong)] focus:ring-2 focus:ring-cyan-200"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--analytics-line)] pt-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            name="draftIntent"
            value="preview"
            disabled={pending}
            className={managementStyles.button}
          >
            {pending ? "Validando…" : "Validar sem aplicar"}
          </button>
          <button
            type="submit"
            name="draftIntent"
            value="save"
            disabled={pending}
            className={managementStyles.buttonPrimary}
          >
            {pending ? "Processando…" : saveLabel}
          </button>
        </div>
      </section>
    </form>
  );
}
