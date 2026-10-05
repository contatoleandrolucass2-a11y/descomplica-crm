"use client";

import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useActionState, useMemo, useState, type FormEvent } from "react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import {
  PERMISSIONS,
  getPermissionLabel,
  type PermissionKey,
} from "@/lib/authorization/permissions";
import {
  ROLE_INHERITED_PERMISSIONS,
  summarizeRoleChange,
} from "@/lib/authorization/access-presentation";
import { ROLES, getRoleLabel, type RoleKey } from "@/lib/authorization/roles";

import {
  assignRoleAction,
  approveUserAccessAction,
  removePermissionOverrideAction,
  setPermissionOverrideAction,
  setUserActiveAction,
  type AdminActionState,
} from "./actions";

const INITIAL_STATE: AdminActionState = { status: "idle", message: "" };
const PAGE_SIZE = 6;

export interface UserPermissionOverride {
  permissionKey: PermissionKey;
  effect: "allow" | "deny";
  reason: string | null;
}

export interface ManagedUser {
  userId: string;
  email: string | null;
  isActive: boolean;
  accessStatus: "pending" | "approved" | "suspended" | "legacy_review";
  roleKey: RoleKey | null;
  isSelf: boolean;
  isManageable: boolean;
  overrides: UserPermissionOverride[];
}

interface UserAccessManagerProps {
  users: ManagedUser[];
  assignableRoles: RoleKey[];
  manageablePermissions: PermissionKey[];
  canManageRoles: boolean;
  canManagePermissions: boolean;
  canManageUsers: boolean;
  canApproveUsers: boolean;
  reportingScopes: Array<{
    id: string;
    key: string;
    type: "global" | "organization" | "team" | "portfolio" | "person";
  }>;
}

const APPROVABLE_ROLES = [
  "admin",
  "coordinator",
  "manager",
  "broker",
  "real_estate",
  "house",
  "partnership_channel",
] as const satisfies readonly RoleKey[];

function ApprovalForm({
  user,
  roles,
  reportingScopes,
}: {
  user: ManagedUser;
  roles: RoleKey[];
  reportingScopes: UserAccessManagerProps["reportingScopes"];
}) {
  const availableRoles = roles.filter((role) =>
    APPROVABLE_ROLES.some((approvableRole) => approvableRole === role),
  );
  const [state, action, pending] = useActionState(
    approveUserAccessAction.bind(null, user.userId),
    INITIAL_STATE,
  );
  if (availableRoles.length === 0 || reportingScopes.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--analytics-warning)] bg-[color-mix(in_srgb,var(--analytics-warning)_9%,var(--analytics-surface))] p-3 text-sm text-[var(--analytics-warning-ink)]">
        Aprovação indisponível: falta papel atribuível ou escopo oficial ativo.
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(event) =>
        confirmChange(event, "A conta será aprovada somente com o papel e os escopos selecionados.")
      }
      className="grid gap-3 rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-[var(--analytics-ink)]">
          Papel aprovado
          <select
            name="roleKey"
            required
            className="min-h-11 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 text-[var(--analytics-ink)]"
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {getRoleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-[var(--analytics-ink)]">
          Escopo oficial
          <select
            name="reportingScopeIds"
            required
            multiple
            size={Math.min(5, reportingScopes.length)}
            className="min-h-28 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-[var(--analytics-ink)]"
          >
            {reportingScopes.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.key} · {scope.type}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-[var(--analytics-ink)]">
        Motivo da aprovação
        <input
          name="reason"
          required
          minLength={3}
          maxLength={240}
          className="min-h-11 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 text-[var(--analytics-ink)]"
        />
      </label>
      <p className="text-xs leading-5 text-[var(--analytics-muted)]">
        O banco revalida identidade, hierarquia, compatibilidade e unicidade do escopo. Nenhuma
        associação é inferida pelo nome.
      </p>
      <button type="submit" disabled={pending} className={managementStyles.buttonPrimary}>
        {pending ? "Validando…" : "Aprovar acesso escopado"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function confirmChange(event: FormEvent<HTMLFormElement>, summary: string) {
  if (!window.confirm(`Revise antes de salvar:\n\n${summary}\n\nDeseja continuar?`)) {
    event.preventDefault();
  }
}

function formatPermissionList(keys: readonly PermissionKey[]): string {
  if (keys.length === 0) return "Nenhum acesso";
  return keys.map(getPermissionLabel).join(", ");
}

function ActionFeedback({ state }: { state: AdminActionState }) {
  if (state.status === "idle") return null;

  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${
        state.status === "error"
          ? "border-[var(--analytics-danger)] bg-[color-mix(in_srgb,var(--analytics-danger)_8%,var(--analytics-surface))] text-[var(--analytics-danger-ink)]"
          : "border-[var(--analytics-positive)] bg-[color-mix(in_srgb,var(--analytics-positive)_8%,var(--analytics-surface))] text-[var(--analytics-positive-ink)]"
      }`}
    >
      <p>{state.message}</p>
      {state.sessionRefreshRecommended ? (
        <p className="mt-1">
          Se a sessão já estava aberta, peça ao usuário para sair e entrar novamente.
        </p>
      ) : null}
    </div>
  );
}

function RoleForm({ user, roles }: { user: ManagedUser; roles: RoleKey[] }) {
  const initialRole = user.roleKey ?? "user";
  const [selectedRole, setSelectedRole] = useState<RoleKey>(initialRole);
  const [state, action, pending] = useActionState(
    assignRoleAction.bind(null, user.userId),
    INITIAL_STATE,
  );
  const change = summarizeRoleChange(user.roleKey, selectedRole);
  const elevation = ROLES[selectedRole].level > (user.roleKey ? ROLES[user.roleKey].level : 0);
  const unchanged = user.roleKey === selectedRole;
  const summary = [
    `Papel: ${user.roleKey ? getRoleLabel(user.roleKey) : "Sem papel"} → ${getRoleLabel(selectedRole)}`,
    `Acessos adicionados: ${formatPermissionList(change.added)}`,
    `Acessos removidos: ${formatPermissionList(change.removed)}`,
    "As exceções individuais existentes não serão alteradas.",
  ].join("\n");

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, summary)}
      className="grid gap-3"
    >
      <div>
        <label
          className="text-sm font-medium text-[var(--analytics-ink)]"
          htmlFor={`role-${user.userId}`}
        >
          Papel
        </label>
        <select
          id={`role-${user.userId}`}
          name="roleKey"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as RoleKey)}
          className="mt-1 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
        >
          {roles.map((roleKey) => (
            <option key={roleKey} value={roleKey}>
              {getRoleLabel(roleKey)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--analytics-muted)]">
          {ROLES[selectedRole].description}
        </p>
      </div>
      <div>
        <label
          className="text-sm font-medium text-[var(--analytics-ink)]"
          htmlFor={`role-reason-${user.userId}`}
        >
          Motivo {elevation ? "(obrigatório para elevação)" : "(opcional)"}
        </label>
        <input
          id={`role-reason-${user.userId}`}
          name="reason"
          required={elevation}
          minLength={elevation ? 3 : undefined}
          maxLength={240}
          className="mt-1 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
        />
      </div>
      <div className="rounded-lg bg-[var(--analytics-surface-muted)] p-3 text-xs text-[var(--analytics-muted)]">
        <strong className="text-[var(--analytics-ink)]">Resumo:</strong> acessos adicionados:{" "}
        {formatPermissionList(change.added)}; acessos removidos:{" "}
        {formatPermissionList(change.removed)}.
      </div>
      <button
        type="submit"
        disabled={pending || unchanged}
        className={managementStyles.buttonPrimary}
      >
        {pending ? "Salvando…" : "Salvar papel"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function StatusForm({ user }: { user: ManagedUser }) {
  const nextActive = !user.isActive;
  const [state, action, pending] = useActionState(
    setUserActiveAction.bind(null, user.userId, nextActive),
    INITIAL_STATE,
  );
  const summary = nextActive
    ? "A conta será reativada e voltará a usar os acessos efetivos do papel e das exceções."
    : "A conta será desativada e todos os acessos serão suspensos.";

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, summary)}
      className="grid gap-3"
    >
      <div>
        <label
          className="text-sm font-medium text-[var(--analytics-ink)]"
          htmlFor={`status-reason-${user.userId}`}
        >
          Motivo {nextActive ? "(opcional)" : "(obrigatório para desativação)"}
        </label>
        <input
          id={`status-reason-${user.userId}`}
          name="reason"
          required={!nextActive}
          minLength={!nextActive ? 3 : undefined}
          maxLength={240}
          className="mt-1 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
        />
      </div>
      <p className="rounded-lg bg-[var(--analytics-surface-muted)] p-3 text-xs text-[var(--analytics-muted)]">
        {summary}
      </p>
      <button
        type="submit"
        disabled={pending}
        className={user.isActive ? managementStyles.buttonDanger : managementStyles.buttonPrimary}
      >
        {pending ? "Salvando…" : user.isActive ? "Desativar usuário" : "Reativar usuário"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function PermissionOverrideForm({
  user,
  permissions,
}: {
  user: ManagedUser;
  permissions: PermissionKey[];
}) {
  const [permissionKey, setPermissionKey] = useState<PermissionKey>(permissions[0]!);
  const [effect, setEffect] = useState<"allow" | "deny">("allow");
  const [state, action, pending] = useActionState(
    setPermissionOverrideAction.bind(null, user.userId),
    INITIAL_STATE,
  );
  const summary = `${getPermissionLabel(permissionKey)} será ${
    effect === "allow" ? "adicionado" : "removido"
  } por uma exceção individual. O papel não será alterado.`;

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, summary)}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium text-[var(--analytics-ink)]"
            htmlFor={`permission-${user.userId}`}
          >
            Permissão
          </label>
          <select
            id={`permission-${user.userId}`}
            name="permissionKey"
            value={permissionKey}
            onChange={(event) => setPermissionKey(event.target.value as PermissionKey)}
            className="mt-1 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
          >
            {permissions.map((key) => (
              <option key={key} value={key}>
                {getPermissionLabel(key)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--analytics-muted)]">
            {PERMISSIONS[permissionKey].description}
          </p>
        </div>
        <div>
          <label
            className="text-sm font-medium text-[var(--analytics-ink)]"
            htmlFor={`effect-${user.userId}`}
          >
            Efeito
          </label>
          <select
            id={`effect-${user.userId}`}
            name="effect"
            value={effect}
            onChange={(event) => setEffect(event.target.value as "allow" | "deny")}
            className="mt-1 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
          >
            <option value="allow">Permitir individualmente</option>
            <option value="deny">Negar individualmente</option>
          </select>
        </div>
      </div>
      <div>
        <label
          className="text-sm font-medium text-[var(--analytics-ink)]"
          htmlFor={`override-reason-${user.userId}`}
        >
          Motivo da exceção (obrigatório)
        </label>
        <input
          id={`override-reason-${user.userId}`}
          name="reason"
          required
          minLength={3}
          maxLength={240}
          className="mt-1 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
        />
      </div>
      <p className="rounded-lg bg-[var(--analytics-surface-muted)] p-3 text-xs text-[var(--analytics-muted)]">
        {summary}
      </p>
      <button type="submit" disabled={pending} className={managementStyles.buttonPrimary}>
        {pending ? "Salvando…" : "Aplicar exceção"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function RemoveOverrideForm({
  user,
  override,
}: {
  user: ManagedUser;
  override: UserPermissionOverride;
}) {
  const [state, action, pending] = useActionState(
    removePermissionOverrideAction.bind(null, user.userId, override.permissionKey),
    INITIAL_STATE,
  );
  const summary = `A exceção de ${getPermissionLabel(
    override.permissionKey,
  )} será removida. Voltará a valer a permissão herdada do papel.`;

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, summary)}
      className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div>
        <label
          className="sr-only"
          htmlFor={`remove-reason-${user.userId}-${override.permissionKey}`}
        >
          Motivo para remover a exceção
        </label>
        <input
          id={`remove-reason-${user.userId}-${override.permissionKey}`}
          name="reason"
          required
          minLength={3}
          maxLength={240}
          placeholder="Motivo para remover (obrigatório)"
          className="w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm text-[var(--analytics-ink)]"
        />
      </div>
      <button type="submit" disabled={pending} className={managementStyles.buttonDanger}>
        {pending ? "Removendo…" : "Remover exceção"}
      </button>
      <div className="sm:col-span-2">
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function UserRow({
  user,
  assignableRoles,
  manageablePermissions,
  canManageRoles,
  canManagePermissions,
  canManageUsers,
  canApproveUsers,
  reportingScopes,
}: UserAccessManagerProps & { user: ManagedUser }) {
  const inherited = user.roleKey ? ROLE_INHERITED_PERMISSIONS[user.roleKey] : [];
  const hasControls =
    user.isManageable && (canManageRoles || canManagePermissions || canManageUsers);

  return (
    <article className={`${managementStyles.panel} overflow-hidden`}>
      <details>
        <summary className="grid min-h-14 cursor-pointer list-none gap-2 px-4 py-3 marker:hidden sm:grid-cols-[minmax(14rem,1.4fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_auto] sm:items-center">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-[var(--analytics-ink)]">
              {user.email ?? "E-mail não informado"}
            </h2>
          </div>
          <p className="text-sm text-[var(--analytics-ink)]">
            {user.roleKey ? getRoleLabel(user.roleKey) : "Sem papel"}
            {user.isSelf ? " · Sua conta" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              className={managementStyles.statusPill}
              data-state={user.isActive ? "active" : "inactive"}
            >
              {user.isActive ? "Ativo" : "Inativo"}
            </span>
            <span className={managementStyles.statusPill} data-state={user.accessStatus}>
              {user.accessStatus === "pending"
                ? "Aguardando aprovação"
                : user.accessStatus === "approved"
                  ? "Acesso aprovado"
                  : user.accessStatus === "suspended"
                    ? "Acesso suspenso"
                    : "Legado em revisão"}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className={managementStyles.statusPill}>
              {user.overrides.length} {user.overrides.length === 1 ? "exceção" : "exceções"}
            </span>
            <span aria-hidden="true" className="text-lg text-[var(--analytics-muted)]">
              ▾
            </span>
          </div>
        </summary>

        <div className="border-t border-[var(--analytics-line)] px-4 py-5 sm:px-5">
          {user.accessStatus === "pending" && canApproveUsers && user.isManageable ? (
            <section className="mb-5" aria-label="Aprovação Master-only">
              <h3 className="mb-2 font-semibold text-[var(--analytics-ink)]">
                Aprovação de acesso escopado
              </h3>
              <ApprovalForm user={user} roles={assignableRoles} reportingScopes={reportingScopes} />
            </section>
          ) : null}
          <section aria-labelledby={`role-title-${user.userId}`}>
            <h3
              id={`role-title-${user.userId}`}
              className="font-semibold text-[var(--analytics-ink)]"
            >
              {user.roleKey ? getRoleLabel(user.roleKey) : "Sem papel"}
            </h3>
            <p className="mt-1 text-sm text-[var(--analytics-muted)]">
              {user.roleKey
                ? ROLES[user.roleKey].description
                : "A conta não possui um conjunto de acessos herdados."}
            </p>
          </section>

          <section className="mt-5" aria-labelledby={`inherited-title-${user.userId}`}>
            <h3
              id={`inherited-title-${user.userId}`}
              className="font-semibold text-[var(--analytics-ink)]"
            >
              Permissões herdadas do papel
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {inherited.map((permissionKey) => (
                <li
                  key={permissionKey}
                  className="rounded-lg bg-[var(--analytics-surface-muted)] px-3 py-2 text-sm"
                >
                  <strong className="text-[var(--analytics-ink)]">
                    {getPermissionLabel(permissionKey)}
                  </strong>
                  <p className="mt-0.5 text-xs text-[var(--analytics-muted)]">
                    {PERMISSIONS[permissionKey].description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5" aria-labelledby={`exceptions-title-${user.userId}`}>
            <h3
              id={`exceptions-title-${user.userId}`}
              className="font-semibold text-[var(--analytics-ink)]"
            >
              Exceções individuais
            </h3>
            {user.overrides.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--analytics-muted)]">
                Nenhuma exceção configurada.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {user.overrides.map((override) => (
                  <li
                    key={override.permissionKey}
                    className="rounded-lg bg-[var(--analytics-surface-muted)] p-3 text-sm"
                  >
                    <strong className="text-[var(--analytics-ink)]">
                      {getPermissionLabel(override.permissionKey)}
                    </strong>
                    <p className="mt-1 text-[var(--analytics-muted)]">
                      {override.effect === "allow" ? "Permitida" : "Negada"} individualmente
                      {override.reason ? ` — ${override.reason}` : ""}
                    </p>
                    {hasControls && canManagePermissions ? (
                      <RemoveOverrideForm user={user} override={override} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="mt-6 rounded-xl border border-[var(--analytics-line)] p-4">
            <summary className="cursor-pointer font-semibold text-[var(--analytics-ink)]">
              Configurações avançadas
            </summary>
            <p className="mt-2 font-mono text-xs break-all text-[var(--analytics-muted)]">
              ID: {user.userId}
            </p>
            {hasControls ? (
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                {canManageRoles ? <RoleForm user={user} roles={assignableRoles} /> : null}
                {canManageUsers ? <StatusForm user={user} /> : null}
                {canManagePermissions && manageablePermissions.length > 0 ? (
                  <div className="lg:col-span-2">
                    <PermissionOverrideForm user={user} permissions={manageablePermissions} />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--analytics-muted)]">
                Esta conta não pode ser alterada por você devido à hierarquia ou à proteção contra
                autoelevação.
              </p>
            )}
          </details>
        </div>
      </details>
    </article>
  );
}

export function UserAccessManager(props: UserAccessManagerProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [role, setRole] = useState<"all" | RoleKey | "unassigned">("all");
  const [pageNumber, setPageNumber] = useState(1);
  const users = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return props.users.filter((user) => {
      const roleLabel = user.roleKey ? getRoleLabel(user.roleKey) : "sem papel";
      const statusLabel = user.isActive ? "ativo" : "inativo";
      const matchesSearch =
        !query ||
        `${user.email ?? ""} ${roleLabel} ${statusLabel}`
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      const matchesStatus =
        status === "all" ||
        (status === "active" && user.isActive) ||
        (status === "inactive" && !user.isActive) ||
        (status === "pending" && user.accessStatus === "pending");
      const matchesRole =
        role === "all" || (role === "unassigned" ? user.roleKey === null : user.roleKey === role);
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [props.users, role, search, status]);
  const roleOptions = useMemo(
    () =>
      [...new Set(props.users.flatMap((user) => (user.roleKey ? [user.roleKey] : [])))].sort(
        (left, right) => getRoleLabel(left).localeCompare(getRoleLabel(right), "pt-BR"),
      ),
    [props.users],
  );
  const activeCount = props.users.filter((user) => user.isActive).length;
  const pendingCount = props.users.filter((user) => user.accessStatus === "pending").length;
  const revokedCount = props.users.filter(
    (user) => !user.isActive || user.accessStatus === "suspended",
  ).length;
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(pageNumber, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleUsers = users.slice(pageStart, pageStart + PAGE_SIZE);

  function resetPage() {
    setPageNumber(1);
  }

  return (
    <div className="admin-users-content">
      <section
        className={`${managementStyles.panel} ${managementStyles.panelPadded} admin-users-toolbar`}
      >
        <div className={managementStyles.toolbar}>
          <label className={managementStyles.searchLabel} htmlFor="user-search">
            <Search aria-hidden="true" />
            <span className={managementStyles.searchCopy}>
              <span>Buscar usuário</span>
              <input
                id="user-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="E-mail, papel ou status"
                className={managementStyles.searchInput}
              />
            </span>
          </label>
          <label className={managementStyles.selectLabel}>
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                resetPage();
              }}
              className={managementStyles.select}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="pending">Aguardando aprovação</option>
            </select>
          </label>
          <label className={managementStyles.selectLabel}>
            Papel
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as typeof role);
                resetPage();
              }}
              className={managementStyles.select}
            >
              <option value="all">Todos</option>
              <option value="unassigned">Sem papel</option>
              {roleOptions.map((roleKey) => (
                <option key={roleKey} value={roleKey}>
                  {getRoleLabel(roleKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section
        aria-label="Resumo de usuários"
        className={`${managementStyles.summaryGrid} admin-users-summary`}
      >
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <UsersRound />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Total de usuários</span>
            <strong className={managementStyles.summaryValue}>{props.users.length}</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <UserCheck />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Com acesso ativo</span>
            <strong className={managementStyles.summaryValue}>{activeCount}</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <ShieldCheck />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Aguardando aprovação</span>
            <strong className={managementStyles.summaryValue}>{pendingCount}</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <ShieldCheck />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Acessos revogados</span>
            <strong className={managementStyles.summaryValue}>{revokedCount}</strong>
          </div>
        </article>
      </section>

      <section
        className={`${managementStyles.panel} ${managementStyles.panelPadded} admin-users-results`}
      >
        <div className={managementStyles.sectionHeader}>
          <div>
            <p className={managementStyles.sectionKicker}>Controle de acesso</p>
            <h2 className={managementStyles.sectionTitle}>Usuários cadastrados</h2>
          </div>
          <p className={managementStyles.muted} aria-live="polite">
            {users.length} {users.length === 1 ? "usuário encontrado" : "usuários encontrados"}
          </p>
        </div>

        <div className="mt-3 grid gap-2" data-qa-visual-volatile="user-results">
          <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_auto] gap-2 px-4 text-xs font-semibold tracking-wide text-[var(--analytics-cyan-strong)] uppercase sm:grid">
            <span>Usuário</span>
            <span>Papel</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {visibleUsers.length > 0 ? (
            visibleUsers.map((user) => <UserRow key={user.userId} user={user} {...props} />)
          ) : (
            <p className={`${managementStyles.emptyState} ${managementStyles.panel}`}>
              Nenhum usuário corresponde à busca.
            </p>
          )}
        </div>

        <div className={`mt-3 ${managementStyles.pagination}`}>
          <span>
            {users.length
              ? `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, users.length)} de ${users.length}`
              : "0 resultados"}
          </span>
          <div className={managementStyles.paginationControls}>
            <button
              type="button"
              className={managementStyles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span className={managementStyles.pageButton} aria-current="page">
              {currentPage}
            </span>
            <button
              type="button"
              className={managementStyles.pageButton}
              disabled={currentPage === pageCount}
              onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
              aria-label="Próxima página"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
