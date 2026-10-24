import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  exportLeads: vi.fn(),
}));

vi.mock("@/lib/authorization/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/crm/leads/operations-data", () => ({ exportLeads: mocks.exportLeads }));

import {
  LeadDistributionWorkspace,
  type DistributionQueue,
} from "@/app/(protected)/app/leads/_components/LeadDistributionWorkspace";
import { LeadAuditWorkspace } from "@/app/(protected)/app/leads/_components/LeadAuditWorkspace";
import { LeadImportWorkspace } from "@/app/(protected)/app/leads/_components/LeadImportWorkspace";
import { LeadReportsWorkspace } from "@/app/(protected)/app/leads/_components/LeadReportsWorkspace";
import { LeadSettingsWorkspace } from "@/app/(protected)/app/leads/_components/LeadSettingsWorkspace";
import { GET as exportLeadsRoute } from "@/app/(protected)/app/leads/exportar/route";

const organizationId = "10000000-0000-4000-8000-000000000001";
const queue: DistributionQueue = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Fila sintética",
  active: true,
  priority: 1,
  revision: 3,
  strategyLabel: "Rodízio",
  fallbackLabel: null,
  rules: [],
  members: [],
};

describe("Lead operational workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({});
    mocks.exportLeads.mockResolvedValue({
      rows: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          name: "Cliente sintético",
          email: "cliente@example.test",
          phone: null,
          status: "open",
          priority: "normal",
          stage: "Novo",
          source: "Cadastro manual",
          createdAt: "2026-10-24T00:00:00.000Z",
        },
      ],
      limit: 5000,
      truncated: false,
    });
  });

  it("keeps distribution management disabled for read-only profiles", () => {
    const markup = renderToStaticMarkup(
      <LeadDistributionWorkspace
        state="ready"
        view="queues"
        queues={[queue]}
        explanations={[]}
        scopeId={organizationId}
        canManage={false}
        canAssign={false}
      />,
    );

    expect(markup).toContain("Acesso somente para consulta");
    expect(markup).toContain("Fila sintética");
    expect(markup).toContain('name="expectedRevision" value="3"');
    expect(markup).toContain('name="organizationId" value="10000000-0000-4000-8000-000000000001"');
    expect(markup).toContain('type="submit" disabled=""');
  });

  it("distinguishes an empty report from an unavailable source", () => {
    const emptyMarkup = renderToStaticMarkup(
      <LeadReportsWorkspace
        state="ready"
        reportKind="overview"
        report={{
          available: true,
          periodLabel: "01/10/2026 a 24/10/2026",
          metrics: [{ label: "Leads recebidos", value: 0 }],
          columns: ["Total"],
          rows: [],
        }}
        scopeId={organizationId}
        canExport={false}
      />,
    );
    expect(emptyMarkup).toContain("Sem dados no período");
    expect(emptyMarkup).toContain("Leads recebidos");
    expect(emptyMarkup).toContain(">0<");
    expect(emptyMarkup).toContain("Exportação não autorizada");

    const unavailableMarkup = renderToStaticMarkup(
      <LeadReportsWorkspace
        state="not_configured"
        reportKind="overview"
        report={null}
        canExport={false}
      />,
    );
    expect(unavailableMarkup).toContain("Relatórios ainda não configurados");
    expect(unavailableMarkup).not.toContain(">0<");
  });

  it("prevents applying an import preview with invalid rows", () => {
    const markup = renderToStaticMarkup(
      <LeadImportWorkspace
        state="ready"
        scopeId={organizationId}
        history={[]}
        preview={{
          id: "30000000-0000-4000-8000-000000000001",
          fileName: "leads-sinteticos.csv",
          statusLabel: "Revisão necessária",
          totalRows: 2,
          validRows: 1,
          invalidRows: 1,
          createdAtLabel: "24/10/2026 03:00",
          expiresAtLabel: "25/10/2026 03:00",
          planHash: "sha256-sintetico",
          errors: [{ row: 2, field: "email", message: "E-mail inválido" }],
        }}
        canManage
        canExport={false}
      />,
    );

    expect(markup).toContain("O preview valida o arquivo e não cria leads.");
    expect(markup).toContain("E-mail inválido");
    expect(markup).toContain('name="expectedHash" value="sha256-sintetico"');
    expect(markup).toMatch(
      /<button[^>]*type="submit"[^>]*disabled=""[^>]*>.*Aplicar lote validado/su,
    );
    expect(markup).toContain("Exportação indisponível");
  });

  it("requires revision and reason while keeping settings read-only without manage permission", () => {
    const markup = renderToStaticMarkup(
      <LeadSettingsWorkspace
        state="ready"
        scopeId={organizationId}
        canManage={false}
        settings={{
          revision: 5,
          duplicateWindowDays: 30,
          unattendedTimeoutMinutes: 60,
          assignmentPolicy: "queue",
          publicLinkEnabled: false,
          alerts: [],
        }}
      />,
    );

    expect(markup).toContain("Consulta habilitada");
    expect(markup).toContain('name="expectedRevision" value="5"');
    expect(markup).toContain('name="reason" required="" disabled=""');
    expect(markup).toContain("Salvar com controle de revisão");
    expect(markup).toContain("Nenhum alerta configurado");
  });

  it("keeps operational navigation keyboard-readable and scope-bound", () => {
    const markup = renderToStaticMarkup(
      <LeadDistributionWorkspace
        state="empty"
        view="members"
        queues={[]}
        explanations={[]}
        scopeId={organizationId}
        canManage
        canAssign={false}
      />,
    );

    expect(markup).toContain('aria-label="Áreas da distribuição"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain(
      "/app/leads/distribuicao?visao=members&amp;scope=10000000-0000-4000-8000-000000000001",
    );
    expect(markup).toContain("Nenhuma fila selecionada");
  });

  it("states the audit privacy boundary and renders only operational metadata", () => {
    const markup = renderToStaticMarkup(
      <LeadAuditWorkspace
        state="ready"
        scopeId={organizationId}
        page={1}
        pageCount={1}
        total={1}
        events={[
          {
            id: "40000000-0000-4000-8000-000000000001",
            actionLabel: "Fila alterada",
            resourceLabel: "Fila 01",
            actorLabel: "Usuário sintético",
            scopeLabel: "Organização sintética",
            reason: "Ajuste autorizado",
            occurredAtLabel: "24/10/2026 03:00",
            changedFields: ["priority", "active"],
          },
        ]}
      />,
    );

    expect(markup).toContain("Telefone, e-mail, mensagens e conteúdo importado não são exibidos.");
    expect(markup).toContain("Fila alterada");
    expect(markup).toContain("priority, active");
    expect(markup).toContain('role="search"');
    expect(markup).toContain('aria-label="Paginação da auditoria"');
  });

  it("requires export permission before reading lead data", async () => {
    await exportLeadsRoute(
      new Request(`https://crm.example.test/app/leads/exportar?scope=${organizationId}`),
    );

    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("crm.leads.export");
    expect(mocks.exportLeads).toHaveBeenCalledExactlyOnceWith(
      organizationId,
      { includeArchived: false },
      5000,
    );
  });

  it.each(["=1+1", "+SUM(1,1)", "-2+3", "@cmd"])(
    "neutralizes CSV formula injection for %s",
    async (dangerousName) => {
      mocks.exportLeads.mockResolvedValue({
        rows: [
          {
            id: "50000000-0000-4000-8000-000000000001",
            name: dangerousName,
            email: null,
            phone: null,
            status: "open",
            priority: "normal",
            stage: "Novo",
            source: null,
            createdAt: "2026-10-24T00:00:00.000Z",
          },
        ],
        limit: 5000,
        truncated: false,
      });

      const response = await exportLeadsRoute(
        new Request(`https://crm.example.test/app/leads/exportar?scope=${organizationId}`),
      );
      const csv = await response.text();

      expect(response.status).toBe(200);
      expect(csv).toContain(`"'${dangerousName}"`);
      expect(csv).not.toContain(`,"${dangerousName}"`);
    },
  );
});
