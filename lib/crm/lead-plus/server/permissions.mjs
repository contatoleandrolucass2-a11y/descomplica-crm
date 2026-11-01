import { createHash } from "node:crypto";
export const scopedResourceId = (id, team) =>
  team ? id + "--" + createHash("md5").update(team).digest("hex") : id;
// Matriz conferida nos formulários de usuários do C2S original em 30/10/2026.
// O C2S representa o gerente como usuário master; o alcance depende das
// empresas/hierarquias gerenciadas. Financeiro permanece fora da interface local.
// O perfil Admin separado foi solicitado para o DESCOMPLICA LEAD em 31/10/2026.
export const c2sPermissionLabels = {
  is_master: "Usuário master (Gerente)",
  restrict_lead_data: "Restringir acesso a dados de leads?",
  access_users: "Pode editar usuários",
  edit_queues: "Pode editar filas de distribuição?",
  edit_hierarchy: "Pode editar hierarquia?",
  edit_v2_bucket: "Pode editar bolsão?",
  edit_tags: "Pode editar etiquetas?",
  access_company_config: "Pode acessar as configurações da empresa?",
  access_finance: "Pode acessar o financeiro da empresa?",
  export_leads_reports: "Pode extrair relatórios de leads?",
  show_in_metrics: "Visível nos relatórios",
  receive_copy_of_email: "Receber cópia das respostas por e-mail?",
};
export function c2sFlags(role) {
  const master = ["admin", "superintendent", "manager"].includes(role);
  return {
    is_master: master,
    restrict_lead_data: false,
    access_users: master,
    edit_queues: master,
    edit_hierarchy: master,
    edit_v2_bucket: master,
    edit_tags: master,
    access_company_config: master,
    access_finance: master,
    export_leads_reports: master,
    show_in_metrics: true,
    receive_copy_of_email: false,
  };
}
export function c2sPermissions(role) {
  const flags = c2sFlags(role);
  const permissions = [
    "crm.dashboard.view",
    "leads.view",
    "leads.create",
    "leads.edit.own",
    "bucket.view",
    "bucket.claim",
    "properties.view",
    "reports.view",
  ];
  if (flags.is_master) permissions.push("leads.edit.scope", "audit.view");
  if (flags.access_users) permissions.push("users.view", "users.manage");
  if (flags.edit_queues) permissions.push("queues.manage");
  if (flags.edit_hierarchy) permissions.push("teams.view", "teams.manage");
  if (flags.edit_v2_bucket) permissions.push("bucket.manage");
  if (flags.edit_tags) permissions.push("tags.manage");
  if (flags.access_company_config)
    permissions.push("crm.settings.manage", "properties.manage", "portals.manage");
  if (flags.export_leads_reports) permissions.push("reports.export");
  if (role === "admin") permissions.push("admin.access");
  return permissions;
}
