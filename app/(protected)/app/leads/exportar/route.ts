import { exportLeads } from "@/lib/crm/leads/operations-data";
import { requirePermission } from "@/lib/authorization/guards";

const columns = [
  "id",
  "name",
  "email",
  "phone",
  "status",
  "priority",
  "stage",
  "source",
  "createdAt",
] as const;
const csvCell = (value: unknown) => {
  const raw = String(value ?? "");
  const neutralized = /^[\s]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replaceAll('"', '""')}"`;
};
export async function GET(request: Request) {
  try {
    await requirePermission("crm.leads.export");
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("scope");
    if (!organizationId) return Response.json({ error: "scope_required" }, { status: 400 });
    const result = await exportLeads(
      organizationId,
      { includeArchived: url.searchParams.get("archived") === "true" },
      5000,
    );
    const csv = [
      columns.join(","),
      ...result.rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
    ].join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="leads.csv"',
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "export_unavailable" }, { status: 403 });
  }
}
