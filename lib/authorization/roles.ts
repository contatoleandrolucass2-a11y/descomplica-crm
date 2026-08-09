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
    description:
      "Gerencia usuários, acessos e auditoria dentro do escopo aprovado; fatos comerciais v2 permanecem restritos ao Master.",
  },
  coordinator: {
    level: 60,
    label: "Coordenador",
    description:
      "Acessa navegação básica e simuladores visuais; fatos comerciais aguardam modelos v3 com escopo.",
  },
  manager: {
    level: 55,
    label: "Gerente",
    description: "Papel técnico de gerente; não recebe permissões comerciais automaticamente.",
  },
  supervisor: {
    level: 50,
    label: "Supervisor",
    description:
      "Acessa navegação básica e simuladores visuais; fatos comerciais aguardam modelos v3 com escopo.",
  },
  house: {
    level: 45,
    label: "House",
    description: "Papel técnico de house; não recebe permissões comerciais automaticamente.",
  },
  real_estate: {
    level: 40,
    label: "Imobiliária",
    description:
      "Acessa navegação básica e simuladores visuais; fatos comerciais aguardam modelos v3 com escopo.",
  },
  partnership_channel: {
    level: 35,
    label: "Canal de Parcerias",
    description:
      "Papel técnico do Canal de Parcerias; não recebe permissões comerciais automaticamente.",
  },
  broker_lead: {
    level: 30,
    label: "Líder de corretores",
    description:
      "Acessa navegação básica e simuladores visuais; fatos comerciais aguardam modelos v3 com escopo.",
  },
  broker: {
    level: 20,
    label: "Corretor",
    description:
      "Acessa navegação básica e simuladores visuais; fatos comerciais aguardam modelos v3 com escopo.",
  },
  user: {
    level: 10,
    label: "Usuário",
    description:
      "Acessa navegação básica e simuladores visuais; fatos comerciais aguardam modelos v3 com escopo.",
  },
  pending: {
    level: 1,
    label: "Pendente",
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
    (roleKey) => roleKey !== "master" && roleKey !== "pending" && ROLES[roleKey].level < actorLevel,
  );
}
