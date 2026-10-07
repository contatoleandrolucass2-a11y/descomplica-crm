// Mirrors the `roles` seed in M5.1 migration. Not a security boundary —
// the authoritative values live in the database. Labels and descriptions are
// presentation-only; the technical keys remain unchanged for RPC calls.
export const ROLES = {
  master: {
    level: 100,
    label: "Master",
    assignable: false,
    description:
      "Responsável máximo pelo sistema, com gestão integral e não atribuível pela interface.",
  },
  admin: {
    level: 80,
    label: "Administrador",
    assignable: true,
    description:
      "Administra usuários de menor nível e acessa as funções operacionais, sem exercer funções exclusivas de Master.",
  },
  coordinator: {
    level: 60,
    label: "Coordenador",
    assignable: true,
    description: "Acessa a operação com Canal Imob e o Canal de Parcerias.",
  },
  manager_house: {
    level: 55,
    label: "Gerente House",
    assignable: true,
    description: "Acessa a operação sem Canal Imob e o Ranking.",
  },
  manager_imob: {
    level: 54,
    label: "Gerente Imob",
    assignable: true,
    description: "Acessa a operação com Canal Imob e o Canal de Parcerias.",
  },
  broker_house: {
    level: 25,
    label: "Corretor House",
    assignable: true,
    description: "Acessa a operação sem Canal Imob e o Ranking.",
  },
  broker_imob: {
    level: 24,
    label: "Corretor Imob",
    assignable: true,
    description: "Acessa a operação com Canal Imob e o Canal de Parcerias.",
  },
  manager: {
    level: 53,
    label: "Gerente (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  supervisor: {
    level: 50,
    label: "Supervisor (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  house: {
    level: 45,
    label: "House (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  real_estate: {
    level: 40,
    label: "Imobiliária (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  partnership_channel: {
    level: 35,
    label: "Canal de Parcerias (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  broker_lead: {
    level: 30,
    label: "Líder de corretores (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  broker: {
    level: 20,
    label: "Corretor (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  user: {
    level: 10,
    label: "Usuário (legado)",
    assignable: false,
    description: "Papel legado sem permissões herdadas; exige reclassificação manual.",
  },
  pending: {
    level: 1,
    label: "Pendente",
    assignable: false,
    description:
      "Papel técnico de onboarding pendente; não recebe permissões comerciais automaticamente.",
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
    (roleKey) => ROLES[roleKey].assignable && ROLES[roleKey].level < actorLevel,
  );
}
