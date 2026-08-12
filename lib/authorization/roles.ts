// Mirrors the `roles` seed in M5.1 migration. Not a security boundary —
// the authoritative values live in the database. Labels and descriptions are
// presentation-only; the technical keys remain unchanged for RPC calls.
export const ROLES = {
  master: {
    level: 100,
    label: "Master",
    description:
      "Responsável máximo pelo sistema, com gestão integral e não atribuível pela interface.",
  },
  admin: {
    level: 80,
    label: "Administrador",
    description: "Gerencia usuários, acessos, auditoria, páginas e configurações do CRM.",
  },
  coordinator: {
    level: 60,
    label: "Coordenador",
    description:
      "Consulta dashboard, etapas, Canal de Parcerias, ranking e simuladores visuais, sem administrar acessos.",
  },
  supervisor: {
    level: 50,
    label: "Supervisor",
    description:
      "Consulta dashboard, etapas, Canal de Parcerias, ranking e simuladores visuais, sem administrar acessos.",
  },
  real_estate: {
    level: 40,
    label: "Imobiliária",
    description:
      "Consulta dashboard, etapas, Canal de Parcerias, ranking e simuladores visuais, sem administrar acessos.",
  },
  broker_lead: {
    level: 30,
    label: "Líder de corretores",
    description:
      "Consulta dashboard, etapas, Canal de Parcerias, ranking e simuladores visuais, sem administrar acessos.",
  },
  broker: {
    level: 20,
    label: "Corretor",
    description:
      "Consulta dashboard, etapas, Canal de Parcerias, ranking e simuladores visuais, sem administrar acessos.",
  },
  user: {
    level: 10,
    label: "Usuário",
    description:
      "Consulta dashboard, etapas, Canal de Parcerias, ranking e simuladores visuais, sem administrar acessos.",
  },
} as const;

export type RoleKey = keyof typeof ROLES;

export function getRoleLevel(roleKey: RoleKey): number {
  return ROLES[roleKey].level;
}

export function getRoleLabel(roleKey: RoleKey): string {
  return ROLES[roleKey].label;
}

export function getAssignableRoleKeys(actorLevel: number): RoleKey[] {
  return (Object.keys(ROLES) as RoleKey[]).filter(
    (roleKey) => roleKey !== "master" && ROLES[roleKey].level < actorLevel,
  );
}
