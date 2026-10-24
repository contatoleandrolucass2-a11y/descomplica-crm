import { redirect } from "next/navigation";

import { enforcePageAccess } from "@/lib/authorization/enforce";
import { importPreviewSchema } from "@/lib/crm/leads/operations-contracts";
import { listLeadImports } from "@/lib/crm/leads/operations-data";

import { applyLeadImportFormAction, previewLeadImportFormAction } from "../operations-actions";
import {
  LeadImportWorkspace,
  type LeadImportBatch,
  type LeadImportPreview,
} from "../_components/LeadImportWorkspace";
import { firstSearchValue, resolveLeadPageScope } from "../_components/LeadPageScope";
import { LeadPageShell, LeadScopeSelector, LeadSourceNotice } from "../_components/LeadWorkspace";

export const metadata = { title: "Importação de leads" };

async function previewImport(formData: FormData) {
  "use server";
  const result = await previewLeadImportFormAction(formData);
  const scope =
    typeof formData.get("organizationId") === "string"
      ? String(formData.get("organizationId"))
      : "";
  if (result.status !== "success")
    redirect(`/app/leads/importacao?scope=${encodeURIComponent(scope)}&erro=preview`);
  const preview = importPreviewSchema.safeParse(result.data);
  if (!preview.success)
    redirect(`/app/leads/importacao?scope=${encodeURIComponent(scope)}&erro=resposta`);
  const params = new URLSearchParams({
    scope,
    batch: preview.data.batchId,
    hash: preview.data.planHash,
    total: String(preview.data.counts.total),
    validas: String(preview.data.counts.valid),
    invalidas: String(preview.data.counts.invalid),
    duplicadas: String(preview.data.counts.duplicate),
    status: preview.data.status,
  });
  if (preview.data.expiresAt) params.set("expira", preview.data.expiresAt);
  redirect(`/app/leads/importacao?${params.toString()}`);
}

async function applyImport(formData: FormData) {
  "use server";
  const result = await applyLeadImportFormAction(formData);
  const scope =
    typeof formData.get("organizationId") === "string"
      ? String(formData.get("organizationId"))
      : "";
  redirect(
    `/app/leads/importacao?scope=${encodeURIComponent(scope)}&resultado=${result.status === "success" ? "aplicado" : "erro"}`,
  );
}
const safeCount = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

export default async function LeadImportPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await enforcePageAccess("/app/leads/importacao");
  const params = (await props?.searchParams) ?? {};
  const scope = await resolveLeadPageScope(params, Boolean(props));
  let state = scope.state;
  let history: LeadImportBatch[] = [];
  if (scope.selectedScopeId) {
    try {
      const result = await listLeadImports(scope.selectedScopeId, 50, 0);
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      });
      history = result.items.map((item) => ({
        id: item.id,
        fileName: "Arquivo não retido",
        statusLabel:
          item.status === "previewed"
            ? "Pré-visualizado"
            : item.status === "applied"
              ? "Aplicado"
              : "Expirado",
        totalRows: item.counts.total,
        validRows: item.counts.valid,
        invalidRows: item.counts.invalid,
        createdAtLabel: formatter.format(new Date(item.createdAt)),
        expiresAtLabel: formatter.format(new Date(item.expiresAt)),
        planHash: item.planHash,
      }));
      state = result.total > 0 ? "ready" : "empty";
    } catch {
      state = "error";
    }
  }
  const batchId = firstSearchValue(params.batch);
  const planHash = firstSearchValue(params.hash);
  const total = safeCount(firstSearchValue(params.total));
  const valid = safeCount(firstSearchValue(params.validas));
  const invalid = safeCount(firstSearchValue(params.invalidas));
  const preview: LeadImportPreview | null =
    /^[0-9a-f-]{36}$/i.test(batchId) && /^[0-9a-f]{64}$/i.test(planHash)
      ? {
          id: batchId,
          fileName: "CSV validado nesta sessão",
          statusLabel: firstSearchValue(params.status) || "Pré-visualizado",
          totalRows: total,
          validRows: valid,
          invalidRows: invalid,
          createdAtLabel: "Nesta sessão",
          expiresAtLabel: firstSearchValue(params.expira) || null,
          planHash,
          errors: [],
        }
      : null;
  const canManage = access.permissions.includes("crm.leads.import.manage");
  const canExport = access.permissions.includes("crm.leads.export");
  const exportHref =
    canExport && scope.selectedScopeId
      ? `/app/leads/exportar?scope=${encodeURIComponent(scope.selectedScopeId)}`
      : undefined;
  const feedback =
    firstSearchValue(params.resultado) === "aplicado"
      ? "Lote aplicado e dados revalidados."
      : firstSearchValue(params.resultado) === "erro" || firstSearchValue(params.erro)
        ? "Não foi possível concluir a operação. Revise o arquivo e tente novamente."
        : undefined;
  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Importação e exportação"
      description="Fluxo seguro de CSV com preview, confirmação, histórico e exportação autorizada."
      sourceState={state}
    >
      <LeadSourceNotice state={state} />
      <LeadScopeSelector
        scopes={scope.scopes}
        selectedScopeId={scope.selectedScopeId}
        invalid={scope.invalid}
      />
      <LeadImportWorkspace
        state={state}
        scopeId={scope.selectedScopeId}
        history={history}
        preview={preview}
        canManage={canManage}
        canExport={canExport}
        previewAction={canManage ? previewImport : undefined}
        applyAction={canManage ? applyImport : undefined}
        exportHref={exportHref}
        feedback={feedback}
      />
    </LeadPageShell>
  );
}
