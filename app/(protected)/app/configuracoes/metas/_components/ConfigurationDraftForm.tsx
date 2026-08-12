"use client";

import { useActionState, type ReactNode } from "react";

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
  saveLabel,
}: {
  action: (
    state: CommercialDraftActionState,
    formData: FormData,
  ) => Promise<CommercialDraftActionState>;
  children: ReactNode;
  saveLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialCommercialDraftActionState);

  return (
    <form action={formAction} className="mt-5 grid gap-5">
      {children}
      <section
        aria-label="Validação do rascunho"
        className="grid gap-4 rounded-2xl border border-cyan-300/30 bg-[var(--analytics-navy)] p-4 text-white shadow-xl sm:p-5"
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)] sm:items-end">
          <div>
            <p className="text-sm leading-6 text-slate-200">
              Esta operação valida ou salva somente um rascunho inativo. Ela não altera metas,
              ranking, política ativa, ativação, permissões ou dados realizados.
            </p>
            {state.status !== "idle" ? (
              <div
                role={state.status === "previewed" || state.status === "saved" ? "status" : "alert"}
                aria-live="polite"
                className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                  state.status === "previewed" || state.status === "saved"
                    ? "bg-cyan-100 text-cyan-950"
                    : "bg-red-100 text-red-900"
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
          <label className="grid gap-1.5 text-xs font-semibold text-slate-200">
            Motivo do rascunho
            <input
              name="draftReason"
              minLength={8}
              maxLength={500}
              required
              placeholder="Descreva a finalidade desta revisão"
              className="min-h-11 rounded-xl border border-white/20 bg-white px-3 py-2 text-base font-normal text-slate-950"
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            name="draftIntent"
            value="preview"
            disabled={pending}
            className="min-h-12 rounded-xl border border-cyan-200/40 px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-white/10 disabled:opacity-60"
          >
            {pending ? "Validando…" : "Validar sem aplicar"}
          </button>
          <button
            type="submit"
            name="draftIntent"
            value="save"
            disabled={pending}
            className="min-h-12 rounded-xl bg-lime-300 px-6 py-3 text-sm font-semibold text-[#082137] hover:bg-lime-200 disabled:opacity-60"
          >
            {pending ? "Processando…" : saveLabel}
          </button>
        </div>
      </section>
    </form>
  );
}
