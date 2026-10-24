import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  resolveLeadScope: vi.fn(),
  getLeadCatalogs: vi.fn(),
  getLead: vi.fn(),
  saveLead: vi.fn(),
  mutateLead: vi.fn(),
  saveLeadDistribution: vi.fn(),
  setLeadPresence: vi.fn(),
  assignLead: vi.fn(),
  previewLeadImport: vi.fn(),
  applyLeadImport: vi.fn(),
  saveLeadOperationsSettings: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authorization/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/crm/leads/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crm/leads/data")>();
  return {
    ...actual,
    resolveLeadScope: mocks.resolveLeadScope,
    getLeadCatalogs: mocks.getLeadCatalogs,
    getLead: mocks.getLead,
    saveLead: mocks.saveLead,
    mutateLead: mocks.mutateLead,
  };
});
vi.mock("@/lib/crm/leads/operations-data", () => ({
  saveLeadDistribution: mocks.saveLeadDistribution,
  setLeadPresence: mocks.setLeadPresence,
  assignLead: mocks.assignLead,
  previewLeadImport: mocks.previewLeadImport,
  applyLeadImport: mocks.applyLeadImport,
  saveLeadOperationsSettings: mocks.saveLeadOperationsSettings,
}));

import {
  addLeadActivityFormAction,
  archiveLeadFormAction,
  closeLeadFormAction,
  saveLeadAction,
  saveLeadFormAction,
  toggleLeadFavoriteFormAction,
} from "@/app/(protected)/app/leads/actions";
import {
  applyLeadImportFormAction,
  previewLeadImportFormAction,
  saveLeadDistributionFormAction,
  saveLeadSettingsFormAction,
} from "@/app/(protected)/app/leads/operations-actions";
import { LeadDataError } from "@/lib/crm/leads/data";
import type { LeadSaveCommand } from "@/lib/crm/leads/contracts";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const leadId = "20000000-0000-4000-8000-000000000001";
const stageId = "30000000-0000-4000-8000-000000000001";
const wonStageId = "30000000-0000-4000-8000-000000000002";
const sourceId = "40000000-0000-4000-8000-000000000001";
const customerId = "50000000-0000-4000-8000-000000000001";

const catalogs = {
  stages: [
    {
      id: stageId,
      key: "new",
      name: "Novo",
      position: 10,
      color: "#2563eb",
      terminal: false,
      won: false,
    },
    {
      id: wonStageId,
      key: "won",
      name: "Ganho",
      position: 90,
      color: "#16a34a",
      terminal: true,
      won: true,
    },
  ],
  sources: [{ id: sourceId, key: "manual", name: "Cadastro manual" }],
  channels: [],
  lostReasons: [],
  responsibles: [],
};

const currentLead = {
  lead: {
    id: leadId,
    organizationId,
    stageId,
    sourceId,
    channelId: null,
    lostReasonId: null,
    responsibleUserId: null,
    status: "open",
    priority: "normal",
    favorite: false,
    archivedAt: null,
    closedAt: null,
    summary: null,
    version: 7,
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  },
  customer: {
    id: customerId,
    name: "Cliente Sintético",
    email: "cliente@example.test",
    phone: null,
    secondaryPhone: null,
    city: null,
    stateCode: null,
  },
  interest: null,
  activities: [],
  messages: [],
  tags: [],
  stageHistory: [],
  catalogs: {
    stages: catalogs.stages,
    sources: catalogs.sources,
    channels: catalogs.channels,
    lostReasons: catalogs.lostReasons,
  },
};

function createLeadForm() {
  const formData = new FormData();
  formData.set("organizationId", organizationId);
  formData.set("customerName", "Cliente Sintético");
  formData.set("email", "cliente@example.test");
  formData.set("interest", "Apartamento teste");
  formData.set("idempotencyKey", "lead-create-0001");
  return formData;
}

describe("Lead server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({});
    mocks.resolveLeadScope.mockResolvedValue({
      status: "ready",
      scope: { id: organizationId, key: "org", name: "Organização sintética", kind: "real_estate" },
      scopes: [],
    });
    mocks.getLeadCatalogs.mockResolvedValue(catalogs);
    mocks.getLead.mockResolvedValue(currentLead);
    mocks.saveLead.mockResolvedValue({ id: leadId, version: 1, created: true });
    mocks.mutateLead.mockResolvedValue({ id: leadId, version: 8, replayed: false });
    mocks.saveLeadDistribution.mockResolvedValue({ revision: 2 });
    mocks.previewLeadImport.mockResolvedValue({
      batchId: "60000000-0000-4000-8000-000000000001",
      planHash: "a".repeat(64),
      status: "previewed",
      counts: { total: 1, valid: 1, duplicate: 0, invalid: 0 },
      replayed: false,
    });
    mocks.applyLeadImport.mockResolvedValue({
      batchId: "60000000-0000-4000-8000-000000000001",
      status: "applied",
      created: 1,
      skipped: 0,
      replayed: false,
    });
    mocks.saveLeadOperationsSettings.mockResolvedValue({ revision: 2 });
  });

  it("creates a lead only after resolving an authorized scope and permission", async () => {
    await expect(saveLeadFormAction(createLeadForm())).resolves.toEqual({
      status: "success",
      leadId,
      version: 1,
      message: "Lead salvo.",
    });

    expect(mocks.resolveLeadScope).toHaveBeenCalledExactlyOnceWith(organizationId);
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("crm.leads.create");
    expect(mocks.saveLead).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        leadId: null,
        expectedVersion: null,
        idempotencyKey: "lead-create-0001",
        input: expect.objectContaining({ organizationId, stageId, sourceId }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/leads/lista");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/leads/${leadId}`);
  });

  it("rejects ambiguous scope before reading catalogs or writing a lead", async () => {
    mocks.resolveLeadScope.mockResolvedValue({
      status: "scope_required",
      scopes: [
        { id: organizationId, key: "org-a", name: "Organização A", kind: "real_estate" },
        { id: otherOrganizationId, key: "org-b", name: "Organização B", kind: "real_estate" },
      ],
    });
    const formData = createLeadForm();
    formData.delete("organizationId");

    await expect(saveLeadFormAction(formData)).resolves.toEqual({
      status: "validation_error",
      message: "Selecione a organização do lead.",
    });
    expect(mocks.getLeadCatalogs).not.toHaveBeenCalled();
    expect(mocks.saveLead).not.toHaveBeenCalled();
  });

  it("uses the persisted organization and version when editing", async () => {
    const formData = createLeadForm();
    formData.set("leadId", leadId);
    formData.set("organizationId", otherOrganizationId);

    await expect(saveLeadFormAction(formData)).resolves.toMatchObject({ status: "success" });
    expect(mocks.resolveLeadScope).not.toHaveBeenCalled();
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("crm.leads.edit");
    expect(mocks.saveLead).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId,
        expectedVersion: 7,
        input: expect.objectContaining({ organizationId }),
      }),
    );
  });

  it("does not write when the server permission check fails", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(saveLeadFormAction(createLeadForm())).resolves.toEqual({
      status: "error",
      message: "Não foi possível concluir a operação do lead.",
    });
    expect(mocks.saveLead).not.toHaveBeenCalled();
  });

  it("validates typed commands before checking permissions", async () => {
    const invalidCommand = {
      leadId: null,
      expectedVersion: 1,
      idempotencyKey: "invalid-0001",
      input: {},
    } as unknown as LeadSaveCommand;
    await expect(saveLeadAction(invalidCommand)).rejects.toBeDefined();
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });

  it("rejects an invalid activity type before mutation", async () => {
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("type", "script_injetado");
    formData.set("title", "Retorno");

    await expect(addLeadActivityFormAction(formData)).resolves.toEqual({
      status: "validation_error",
      message: "O tipo da atividade é inválido.",
    });
    expect(mocks.mutateLead).not.toHaveBeenCalled();
  });

  it("maps a concurrent mutation to an actionable conflict", async () => {
    mocks.mutateLead.mockRejectedValue(
      new LeadDataError("conflict", "O lead mudou em outra sessão. Recarregue antes de continuar."),
    );
    const formData = new FormData();
    formData.set("leadId", leadId);

    await expect(archiveLeadFormAction(formData)).resolves.toEqual({
      status: "conflict",
      message: "O lead mudou em outra sessão. Recarregue antes de continuar.",
    });
  });

  it("uses the current version for favorite and close mutations", async () => {
    const favoriteForm = new FormData();
    favoriteForm.set("leadId", leadId);
    await toggleLeadFavoriteFormAction(favoriteForm);

    expect(mocks.requirePermission).toHaveBeenLastCalledWith("crm.leads.edit");
    expect(mocks.mutateLead).toHaveBeenLastCalledWith(
      expect.objectContaining({
        leadId,
        operation: "set_favorite",
        expectedVersion: 7,
        payload: { favorite: true },
      }),
    );

    const closeForm = new FormData();
    closeForm.set("leadId", leadId);
    await closeLeadFormAction(closeForm);

    expect(mocks.requirePermission).toHaveBeenLastCalledWith("crm.leads.close");
    expect(mocks.mutateLead).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operation: "close",
        expectedVersion: 7,
        payload: { stageId: wonStageId, lostReasonId: null, reason: "Fechado pela interface" },
      }),
    );
  });

  it("previews a bounded CSV without passing raw file content to the data layer", async () => {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set(
      "file",
      new File(["nome,email\nCliente Sintético,cliente@example.test\n"], "leads.csv", {
        type: "text/csv",
      }),
    );
    formData.set("mapping", JSON.stringify({ name: "nome", email: "email" }));

    await expect(previewLeadImportFormAction(formData)).resolves.toMatchObject({
      status: "success",
      message: "Prévia criada sem armazenar o arquivo bruto.",
    });
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("crm.leads.import.manage");
    expect(mocks.previewLeadImport).toHaveBeenCalledExactlyOnceWith(
      organizationId,
      expect.any(Uint8Array),
      { name: "nome", email: "email" },
      [{ name: "Cliente Sintético", email: "cliente@example.test" }],
    );
  });

  it("rejects a non-CSV import before preview persistence", async () => {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("file", new File(["conteúdo"], "leads.txt", { type: "text/plain" }));

    await expect(previewLeadImportFormAction(formData)).resolves.toMatchObject({
      status: "validation_error",
    });
    expect(mocks.previewLeadImport).not.toHaveBeenCalled();
  });

  it("requires the exact preview hash before applying an import", async () => {
    const invalid = new FormData();
    invalid.set("batchId", "60000000-0000-4000-8000-000000000001");
    invalid.set("planHash", "short");
    await expect(applyLeadImportFormAction(invalid)).resolves.toMatchObject({
      status: "validation_error",
    });
    expect(mocks.applyLeadImport).not.toHaveBeenCalled();

    const valid = new FormData();
    valid.set("batchId", "60000000-0000-4000-8000-000000000001");
    valid.set("planHash", "a".repeat(64));
    await expect(applyLeadImportFormAction(valid)).resolves.toMatchObject({
      status: "success",
      message: "Importação aplicada.",
    });
    expect(mocks.applyLeadImport).toHaveBeenCalledExactlyOnceWith(
      "60000000-0000-4000-8000-000000000001",
      "a".repeat(64),
    );
  });

  it("validates distribution revision and settings reason before writing", async () => {
    const distribution = new FormData();
    distribution.set("organizationId", organizationId);
    distribution.set("expectedRevision", "1");
    distribution.set("reason", "Ajuste operacional autorizado");
    distribution.set("document", JSON.stringify({ queues: [], rules: [] }));
    await expect(saveLeadDistributionFormAction(distribution)).resolves.toMatchObject({
      status: "success",
    });
    expect(mocks.requirePermission).toHaveBeenLastCalledWith("crm.leads.distribution.manage");
    expect(mocks.saveLeadDistribution).toHaveBeenCalledWith(
      organizationId,
      1,
      { queues: [], rules: [] },
      "Ajuste operacional autorizado",
    );

    const settings = new FormData();
    settings.set("organizationId", organizationId);
    settings.set("expectedRevision", "1");
    settings.set("reason", "curto");
    settings.set(
      "document",
      JSON.stringify({
        sources: [],
        channels: [],
        stages: [],
        lostReasons: [],
        tags: [],
        alerts: {},
        adjustments: {},
      }),
    );
    await expect(saveLeadSettingsFormAction(settings)).resolves.toMatchObject({
      status: "validation_error",
    });
    expect(mocks.saveLeadOperationsSettings).not.toHaveBeenCalled();
  });
});
