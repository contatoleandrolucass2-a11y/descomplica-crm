const root = "/app/leads";
export const canonicalLeadPages = {
  list: root + "/lista",
  activities: root + "/atividades",
  pipeline: root + "/funil",
  distribution: root + "/distribuicao",
  reports: root + "/relatorios",
  imports: root + "/importacao",
  settings: root + "/configuracoes",
  audit: root + "/auditoria",
};
export function operationPage(path, method) {
  if (path === "/session" || path === "/health") return root;
  if (/^\/whatsapp\/(accounts|settings|diagnostics)(?:\/|$)/.test(path))
    return canonicalLeadPages.settings;
  if (/^\/whatsapp\/(session|conversations|events|templates|availability)(?:\/|$)/.test(path))
    return canonicalLeadPages.list;
  if (path === "/whatsapp/metrics") return canonicalLeadPages.reports;
  if (/^\/imports(?:\/|$)/.test(path)) return canonicalLeadPages.imports;
  if (/^\/leads\/[^/]+\/activities$/.test(path)) return canonicalLeadPages.activities;
  if (/^\/leads(?:\/|$)/.test(path)) return canonicalLeadPages.list;
  if (/^\/bucket(?:\/|$)/.test(path))
    return path === "/bucket/policy" && method !== "GET"
      ? canonicalLeadPages.settings
      : canonicalLeadPages.pipeline;
  if (["/analytics", "/management", "/dashboard", "/report-leads", "/exports/leads"].includes(path))
    return canonicalLeadPages.reports;
  if (path === "/audit") return canonicalLeadPages.audit;
  if (
    path === "/integrations" ||
    path.startsWith("/integrations/") ||
    path === "/crm-users" ||
    path === "/crm-users/link" ||
    path === "/permissions" ||
    path.startsWith("/admin/")
  )
    return canonicalLeadPages.settings;
  const kind = path.match(/^\/resources\/([a-z-]+)(?:\/[a-zA-Z0-9-]+)?$/)?.[1];
  if (["queues", "teams"].includes(kind)) return canonicalLeadPages.distribution;
  if (kind === "users")
    return method === "GET" ? canonicalLeadPages.list : canonicalLeadPages.settings;
  if (["profile", "templates", "training", "lead-preferences"].includes(kind))
    return canonicalLeadPages.list;
  if (kind === "exports") return canonicalLeadPages.reports;
  if (["settings", "tags", "archive-reasons", "alerts"].includes(kind))
    return canonicalLeadPages.settings;
  return null;
}
const permissionPages = {
  "crm.dashboard.view": [canonicalLeadPages.reports],
  "leads.view": [canonicalLeadPages.list],
  "leads.create": [canonicalLeadPages.list],
  "leads.edit.own": [canonicalLeadPages.list],
  "leads.edit.scope": [canonicalLeadPages.list],
  "bucket.view": [canonicalLeadPages.pipeline],
  "bucket.claim": [canonicalLeadPages.pipeline],
  "bucket.manage": [canonicalLeadPages.settings, canonicalLeadPages.pipeline],
  "reports.view": [canonicalLeadPages.reports],
  "reports.export": [canonicalLeadPages.reports],
  "users.view": [canonicalLeadPages.settings],
  "users.manage": [canonicalLeadPages.settings],
  "teams.view": [canonicalLeadPages.distribution],
  "teams.manage": [canonicalLeadPages.distribution],
  "queues.manage": [canonicalLeadPages.distribution],
  "tags.manage": [canonicalLeadPages.settings],
  "crm.settings.manage": [canonicalLeadPages.settings],
  "audit.view": [canonicalLeadPages.audit],
  "admin.access": [canonicalLeadPages.settings],
};
export function intersectPermissions(permissions, pages) {
  const allowed = new Set(pages);
  return permissions.filter((permission) =>
    permissionPages[permission]?.every((page) => allowed.has(page)),
  );
}

/** Mutations use canonical granular grants; unknown operations fail closed. */
export function operationPermissions(path, method) {
  if (path.startsWith("/whatsapp/")) {
    if (!operationPage(path, method)) return null;
    if (method === "GET") {
      if (/\/export$/.test(path)) return ["crm.leads.export", "crm.leads.reports.export"];
      return path === "/whatsapp/metrics" ? ["crm.leads.reports.view"] : [];
    }
    if (
      /^\/whatsapp\/(accounts|settings|diagnostics)(?:\/|$)/.test(path) &&
      ["POST", "PUT"].includes(method)
    )
      return ["crm.leads.settings.manage"];
    if (path === "/whatsapp/availability" && method === "PUT")
      return ["crm.leads.assign", "crm.leads.distribution.assign"];
    if (/^\/whatsapp\/conversations\/[^/]+$/.test(path) && method === "PATCH")
      return ["crm.leads.edit", "crm.leads.stage.move"];
    if (method !== "POST") return null;
    if (/\/(claim|transfer|requeue)$/.test(path))
      return ["crm.leads.assign", "crm.leads.distribution.assign"];
    if (/\/close$/.test(path)) return ["crm.leads.close"];
    if (/\/notes$/.test(path)) return ["crm.leads.edit"];
    if (/\/redact$/.test(path)) return ["crm.leads.settings.manage"];
    if (/\/read$/.test(path)) return [];
    if (/\/(messages|media)$/.test(path)) return ["crm.leads.messages.manage"];
    return null;
  }
  if (method === "GET") {
    if (path === "/exports/leads") return ["crm.leads.export", "crm.leads.reports.export"];
    return operationPage(path, method) ? [] : null;
  }
  if (path === "/leads" && method === "POST") return ["crm.leads.create", "crm.leads.assign"];
  if (/^\/leads\/[^/]+\/activities$/.test(path) && method === "POST")
    return ["crm.leads.activities.manage"];
  // The composite editor can change owner, stage, terminal status and archive together.
  if (/^\/leads\/[^/]+$/.test(path) && method === "PATCH")
    return [
      "crm.leads.edit",
      "crm.leads.assign",
      "crm.leads.stage.move",
      "crm.leads.close",
      "crm.leads.archive",
    ];
  if (/^\/imports(?:\/|$)/.test(path) && ["POST", "DELETE"].includes(method))
    return ["crm.leads.import.manage"];
  if (/^\/bucket\/[^/]+\/claim$/.test(path) && method === "POST")
    return ["crm.leads.assign", "crm.leads.distribution.assign"];
  if (path === "/bucket/policy") return ["crm.leads.settings.manage"];
  if (path === "/integrations/facebook/campaigns" && method === "PUT")
    return ["crm.leads.settings.manage"];
  if (path === "/crm-users/link" && method === "POST")
    return ["users.manage", "crm.leads.settings.manage"];
  const kind = path.match(/^\/resources\/([a-z-]+)\/[a-zA-Z0-9-]+$/)?.[1];
  if (!["PUT", "DELETE"].includes(method)) return null;
  if (kind === "users") return ["users.manage", "crm.leads.settings.manage"];
  if (["teams", "queues"].includes(kind)) return ["crm.leads.distribution.manage"];
  if (kind === "tags") return ["crm.leads.tags.manage", "crm.leads.settings.manage"];
  if (["settings", "archive-reasons", "alerts"].includes(kind))
    return ["crm.leads.settings.manage"];
  if (kind === "exports") return ["crm.leads.export", "crm.leads.reports.export"];
  if (kind === "templates") return ["crm.leads.messages.manage"];
  if (["profile", "lead-preferences", "training"].includes(kind)) return ["crm.leads.edit"];
  return null;
}
const granularPermissions = {
  "leads.create": ["crm.leads.create"],
  "leads.edit.own": ["crm.leads.edit"],
  "leads.edit.scope": ["crm.leads.edit", "crm.leads.assign"],
  "bucket.claim": ["crm.leads.assign", "crm.leads.distribution.assign"],
  "bucket.manage": ["crm.leads.settings.manage"],
  "reports.export": ["crm.leads.export", "crm.leads.reports.export"],
  "users.view": ["users.view"],
  "users.manage": ["users.manage", "crm.leads.settings.manage"],
  "teams.manage": ["crm.leads.distribution.manage"],
  "queues.manage": ["crm.leads.distribution.manage"],
  "tags.manage": ["crm.leads.tags.manage"],
  "crm.settings.manage": ["crm.leads.settings.manage"],
  "admin.access": ["admin.access"],
};
export function intersectGranularPermissions(permissions, canonical) {
  const allowed = new Set(canonical);
  return permissions.filter(
    (permission) =>
      !granularPermissions[permission] ||
      granularPermissions[permission].every((grant) => allowed.has(grant)),
  );
}
