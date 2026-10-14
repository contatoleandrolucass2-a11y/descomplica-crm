"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  CircleX,
  Clock3,
  Search,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useActionState, useCallback, useMemo, useState, type FormEvent } from "react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import {
  PERMISSIONS,
  getPermissionLabel,
  type PermissionKey,
} from "@/lib/authorization/permissions";
import {
  ROLE_INHERITED_PERMISSIONS,
  SIMULATOR_ACCESS_PERMISSIONS,
  summarizeRoleChange,
} from "@/lib/authorization/access-presentation";
import { ROLES, getRoleLabel, type RoleKey } from "@/lib/authorization/roles";

import {
  assignRoleAction,
  approveUserAccessAction,
  setPermissionOverridesBulkAction,
  setUserActiveAction,
  type AdminActionState,
} from "./actions";

const INITIAL_STATE: AdminActionState = { status: "idle", message: "" };
const PAGE_SIZE = 8;
const HIDDEN_PERMISSION_KEYS = new Set<PermissionKey>([
  "audit.view",
  "crm.read_model_v3.view",
  "crm.read_model_v3.ranking.view",
  "crm.read_model_v3.partnerships.view",
  "crm.read_model_v3.stock.view",
]);
const ALL_PERMISSIONS = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(
  (key) => key !== "crm.simulators.execute" && !HIDDEN_PERMISSION_KEYS.has(key),
);

function getControlKeys(permissionKey: PermissionKey): readonly PermissionKey[] {
  return permissionKey === "crm.simulators.view" ? SIMULATOR_ACCESS_PERMISSIONS : [permissionKey];
}

function getControlLabel(permissionKey: PermissionKey): string {
  return permissionKey === "crm.simulators.view"
    ? "Acessar simuladores"
    : getPermissionLabel(permissionKey);
}

function getControlDescription(permissionKey: PermissionKey): string {
  return permissionKey === "crm.simulators.view"
    ? "Permite visualizar e executar os simuladores disponíveis."
    : PERMISSIONS[permissionKey].description;
}

function countControls(keys: readonly PermissionKey[]): number {
  return new Set(
    keys
      .filter((key) => !HIDDEN_PERMISSION_KEYS.has(key))
      .map((key) => (key === "crm.simulators.execute" ? "crm.simulators.view" : key)),
  ).size;
}
const ACTIVE_ROLE_KEYS = new Set<string>([
  "master",
  "admin",
  "coordinator",
  "manager_house",
  "manager_imob",
  "broker_house",
  "broker_imob",
]);
const APPROVABLE_ROLE_KEYS = new Set<string>([
  "admin",
  "coordinator",
  "manager_house",
  "manager_imob",
  "broker_house",
  "broker_imob",
]);

type BulkEffect = "allow" | "deny" | "inherit";

interface PermissionGroup {
  id: string;
  label: string;
  description?: string;
  matches: (permissionKey: PermissionKey) => boolean;
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "commercial",
    label: "Comercial",
    matches: (key) =>
      key === "pages.view" ||
      key.startsWith("crm.dashboard.") ||
      key.startsWith("crm.stages.") ||
      key.startsWith("crm.ranking.") ||
      key.startsWith("crm.partnerships.") ||
      key.startsWith("crm.read_model_v3."),
  },
  {
    id: "simulators",
    label: "Simuladores",
    description:
      "RIVA e DIRECIONAL controlam as unidades visíveis. O Administrador herda ambas; os demais papéis precisam de liberação individual.",
    matches: (key) =>
      key.startsWith("crm.simulators.") ||
      key.startsWith("crm.inventory.") ||
      key.startsWith("crm.commercial_engine."),
  },
  {
    id: "settings",
    label: "Configurações",
    matches: (key) =>
      key.startsWith("crm.settings.") ||
      key.startsWith("crm.salesforce.") ||
      key.startsWith("crm.ingest.") ||
      key.startsWith("crm.commercial_policy."),
  },
  {
    id: "administration",
    label: "Administração",
    matches: (key) =>
      key.startsWith("users.") ||
      key.startsWith("permissions.") ||
      key.startsWith("roles.") ||
      key.startsWith("audit.") ||
      key.startsWith("admin.") ||
      key === "pages.manage",
  },
];

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
  inheritedPermissions?: readonly PermissionKey[];
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
  isMasterPermissionManager: boolean;
  canManageUsers: boolean;
  canApproveUsers: boolean;
  reportingScopes: Array<{
    id: string;
    key: string;
    type: "global" | "organization" | "team" | "portfolio" | "person";
  }>;
}

function getUserStatus(user: ManagedUser) {
  if (user.accessStatus === "pending") {
    return { key: "pending", label: "Pendente" } as const;
  }
  if (!user.isActive || user.accessStatus === "suspended") {
    return { key: "inactive", label: "Revogado" } as const;
  }
  if (user.accessStatus === "legacy_review") {
    return { key: "legacy_review", label: "Em revisão" } as const;
  }
  return { key: "approved", label: "Ativo" } as const;
}

function getVisibleRoleLabel(roleKey: RoleKey | null): string {
  if (!roleKey) return "Sem papel";
  if (roleKey === "pending") return "Pendente";
  if (!ACTIVE_ROLE_KEYS.has(roleKey)) return "Papel legado — reclassificar";
  return getRoleLabel(roleKey);
}

function getInheritedPermissions(user: ManagedUser): readonly PermissionKey[] {
  if (user.inheritedPermissions) return user.inheritedPermissions;
  if (!user.roleKey) return [];
  return ROLE_INHERITED_PERMISSIONS[user.roleKey] ?? [];
}

function accountHasAccess(user: ManagedUser): boolean {
  return (
    user.isActive &&
    user.accessStatus === "approved" &&
    Boolean(user.roleKey && ACTIVE_ROLE_KEYS.has(user.roleKey))
  );
}

function getEffectivePermissionCount(user: ManagedUser): number {
  if (!accountHasAccess(user)) return 0;
  const effectivePermissions = new Set<PermissionKey>(getInheritedPermissions(user));
  for (const override of user.overrides) {
    if (override.effect === "allow") effectivePermissions.add(override.permissionKey);
    else effectivePermissions.delete(override.permissionKey);
  }
  return ALL_PERMISSIONS.filter((key) =>
    getControlKeys(key).every((item) => effectivePermissions.has(item)),
  ).length;
}

function confirmChange(event: FormEvent<HTMLFormElement>, summary: string) {
  if (!window.confirm(`Revise antes de salvar:\n\n${summary}\n\nDeseja continuar?`)) {
    event.preventDefault();
  }
}

function formatPermissionList(keys: readonly PermissionKey[]): string {
  const visibleKeys = keys.filter((key) => !HIDDEN_PERMISSION_KEYS.has(key));
  if (visibleKeys.length === 0) return "Nenhum acesso";
  return [
    ...new Set(
      visibleKeys.map((key) =>
        getControlLabel(key === "crm.simulators.execute" ? "crm.simulators.view" : key),
      ),
    ),
  ].join(", ");
}

function ActionFeedback({ state }: { state: AdminActionState }) {
  if (state.status === "idle") return null;

  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      aria-live={state.status === "error" ? "assertive" : "polite"}
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

function ApprovalForm({
  user,
  roles,
  reportingScopes,
}: {
  user: ManagedUser;
  roles: RoleKey[];
  reportingScopes: UserAccessManagerProps["reportingScopes"];
}) {
  const availableRoles = roles.filter((role) => APPROVABLE_ROLE_KEYS.has(role));
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
      className="admin-approval-form"
    >
      <div className="admin-approval-fields">
        <label>
          <span>Papel aprovado</span>
          <select name="roleKey" required autoComplete="off">
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {getRoleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Escopo oficial</span>
          <select
            name="reportingScopeIds"
            required
            multiple
            size={Math.min(5, reportingScopes.length)}
            autoComplete="off"
          >
            {reportingScopes.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.key} · {scope.type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="admin-form-help">
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

function RoleForm({ user, roles }: { user: ManagedUser; roles: RoleKey[] }) {
  const currentAssignableRole =
    user.roleKey && roles.includes(user.roleKey) ? user.roleKey : undefined;
  const initialRole = currentAssignableRole ?? roles[0]!;
  const [selectedRole, setSelectedRole] = useState<RoleKey>(initialRole);
  const [state, action, pending] = useActionState(
    assignRoleAction.bind(null, user.userId),
    INITIAL_STATE,
  );
  const change = summarizeRoleChange(user.roleKey, selectedRole);
  const unchanged = user.roleKey === selectedRole;
  return (
    <form action={action} className="admin-role-form">
      <div className="admin-role-form-fields">
        <label htmlFor={`role-${user.userId}`}>
          <span>Papel</span>
          <select
            id={`role-${user.userId}`}
            name="roleKey"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as RoleKey)}
            autoComplete="off"
          >
            {roles.map((roleKey) => (
              <option key={roleKey} value={roleKey}>
                {getRoleLabel(roleKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="admin-role-description">{ROLES[selectedRole].description}</p>
      <div className="admin-change-summary">
        <strong>Resumo do papel</strong>
        <span>{countControls(change.added)} adicionadas</span>
        <span>{countControls(change.removed)} removidas</span>
      </div>
      {!unchanged ? (
        <div className="admin-form-help">
          <p>Acessos adicionados: {formatPermissionList(change.added)}.</p>
          <p>Acessos removidos: {formatPermissionList(change.removed)}.</p>
          <p>
            Ao salvar, as exceções anteriores serão removidas e os acessos padrão do novo papel
            serão aplicados.
          </p>
        </div>
      ) : null}
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
      className="admin-status-form"
    >
      <p className="admin-form-help">{summary}</p>
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

function getPermissionState(
  permissionKey: PermissionKey,
  inherited: ReadonlySet<PermissionKey>,
  override: UserPermissionOverride | undefined,
) {
  if (override?.effect === "allow") {
    return { key: "override-allow", label: "Exceção permitida", permitted: true } as const;
  }
  if (override?.effect === "deny") {
    return { key: "override-deny", label: "Exceção negada", permitted: false } as const;
  }
  if (inherited.has(permissionKey)) {
    return { key: "inherited-allow", label: "Herdada: permitida", permitted: true } as const;
  }
  return { key: "inherited-deny", label: "Herdada: negada", permitted: false } as const;
}

function PermissionMatrix({
  user,
  manageablePermissions,
  editable,
}: {
  user: ManagedUser;
  manageablePermissions: PermissionKey[];
  editable: boolean;
}) {
  const [search, setSearch] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("commercial");
  const [draftEffects, setDraftEffects] = useState<Map<PermissionKey, BulkEffect>>(() => new Map());
  const submitOverrides = useCallback(
    async (previousState: AdminActionState, formData: FormData) => {
      const nextState = await setPermissionOverridesBulkAction(
        user.userId,
        previousState,
        formData,
      );
      if (nextState.status === "success") setDraftEffects(new Map());
      return nextState;
    },
    [user.userId],
  );
  const [state, action, pending] = useActionState(submitOverrides, INITIAL_STATE);
  const manageable = useMemo(() => new Set(manageablePermissions), [manageablePermissions]);
  const inherited = useMemo(() => new Set<PermissionKey>(getInheritedPermissions(user)), [user]);
  const overrides = useMemo(
    () => new Map(user.overrides.map((override) => [override.permissionKey, override])),
    [user.overrides],
  );
  const filteredPermissions = ALL_PERMISSIONS.filter((permissionKey) => {
    return `${getControlLabel(permissionKey)} ${getControlDescription(permissionKey)}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR"));
  });
  const groups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: filteredPermissions.filter(group.matches),
  })).filter((group) => group.permissions.length > 0);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];

  function isChecked(permissionKey: PermissionKey) {
    if (!accountHasAccess(user)) return false;
    const effect =
      draftEffects.get(permissionKey) ?? overrides.get(permissionKey)?.effect ?? "inherit";
    return effect === "allow" || (effect === "inherit" && inherited.has(permissionKey));
  }

  function togglePermission(permissionKey: PermissionKey) {
    const keys = getControlKeys(permissionKey);
    if (!editable || !keys.every((key) => manageable.has(key)) || pending) return;
    const checked = !keys.every(isChecked);
    setDraftEffects((current) => {
      const next = new Map(current);
      for (const key of keys) {
        const effect = checked === inherited.has(key) ? "inherit" : checked ? "allow" : "deny";
        if (effect === (overrides.get(key)?.effect ?? "inherit")) next.delete(key);
        else next.set(key, effect);
      }
      return next;
    });
  }

  function restoreDefaults() {
    setDraftEffects(
      new Map(
        manageablePermissions
          .filter(
            (permissionKey) =>
              !HIDDEN_PERMISSION_KEYS.has(permissionKey) && overrides.has(permissionKey),
          )
          .map((permissionKey) => [permissionKey, "inherit" as const]),
      ),
    );
  }

  return (
    <form action={action} className="admin-permission-form">
      {[...draftEffects].map(([permissionKey, effect]) => (
        <input
          key={permissionKey}
          type="hidden"
          name={`${effect}PermissionKeys`}
          value={permissionKey}
        />
      ))}
      <div className="admin-permission-toolbar">
        <label className="admin-permission-search" htmlFor={`permission-search-${user.userId}`}>
          <Search aria-hidden="true" />
          <span>
            <span>Buscar acesso</span>
            <input
              id={`permission-search-${user.userId}`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              placeholder="Buscar acesso ou função…"
            />
          </span>
        </label>
      </div>
      {groups.length > 0 ? (
        <div className="admin-permission-tabs" role="tablist" aria-label="Categorias de acesso">
          {groups.map((group, index) => (
            <button
              key={group.id}
              id={`access-tab-${user.userId}-${group.id}`}
              type="button"
              role="tab"
              className="admin-permission-tab"
              aria-selected={activeGroup?.id === group.id}
              aria-controls={`access-panel-${user.userId}-${group.id}`}
              tabIndex={activeGroup?.id === group.id ? 0 : -1}
              onClick={() => setActiveGroupId(group.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % groups.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + groups.length) % groups.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? groups.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                setActiveGroupId(groups[next]!.id);
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  );
                buttons?.[next]?.focus();
              }}
            >
              {group.label}
              <span>{group.permissions.length}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="admin-permission-groups">
        {groups.map((group) => (
          <section
            key={group.id}
            id={`access-panel-${user.userId}-${group.id}`}
            className="admin-permission-group admin-permission-panel"
            role="tabpanel"
            tabIndex={activeGroup?.id === group.id ? 0 : -1}
            hidden={activeGroup?.id !== group.id}
            aria-labelledby={`access-tab-${user.userId}-${group.id}`}
          >
            {group.description ? <p className="admin-form-help">{group.description}</p> : null}
            <div className="admin-permission-grid">
              {group.permissions.map((permissionKey) => {
                const keys = getControlKeys(permissionKey);
                const checked = keys.every(isChecked);
                const canEdit = editable && keys.every((key) => manageable.has(key));
                const savedStates = keys.map((key) =>
                  getPermissionState(key, inherited, overrides.get(key)),
                );
                const savedState = !accountHasAccess(user)
                  ? { key: "account-denied", label: "Conta sem acesso", permitted: false }
                  : (savedStates.find((state) => !state.permitted) ??
                    savedStates.find((state) => state.key === "override-allow") ??
                    savedStates[0]!);
                const changed = keys.some((key) => draftEffects.has(key));
                return (
                  <label
                    key={permissionKey}
                    className="admin-permission-option"
                    data-disabled={!canEdit}
                    data-editable={editable}
                    data-selected={checked}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit || pending}
                      onChange={() => togglePermission(permissionKey)}
                      aria-label={
                        permissionKey === "crm.simulators.view"
                          ? "Acessar simuladores"
                          : `Acesso a ${getPermissionLabel(permissionKey)}`
                      }
                    />
                    <span className="admin-permission-option-copy">
                      <strong>{getControlLabel(permissionKey)}</strong>
                      <small>{getControlDescription(permissionKey)}</small>
                    </span>
                    <span className="admin-permission-state" data-state={savedState.key}>
                      {checked ? <Check aria-hidden="true" /> : <CircleMinus aria-hidden="true" />}
                      {changed ? "Alteração não salva" : savedState.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 ? (
          <p className={managementStyles.emptyState}>Nenhum acesso corresponde à busca.</p>
        ) : null}
      </div>
      {editable ? (
        <div className="admin-permission-footer">
          <div className="admin-permission-summary" role="status" aria-live="polite">
            {draftEffects.size === 0
              ? "Todos os ajustes estão salvos."
              : `${countControls([...draftEffects.keys()])} ${countControls([...draftEffects.keys()]) === 1 ? "alteração não salva" : "alterações não salvas"}.`}
          </div>
          <div className="admin-permission-submit-actions">
            <button
              type="button"
              className={managementStyles.button}
              onClick={restoreDefaults}
              disabled={pending}
            >
              Usar padrão do perfil
            </button>
            <button
              type="button"
              className={managementStyles.button}
              onClick={() => setDraftEffects(new Map())}
              disabled={pending || draftEffects.size === 0}
            >
              Descartar
            </button>
            <button
              type="submit"
              className={managementStyles.buttonPrimary}
              disabled={pending || draftEffects.size === 0}
            >
              {pending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
          <ActionFeedback state={state} />
        </div>
      ) : (
        <p className="admin-permission-readonly-note">
          {accountHasAccess(user)
            ? "Esta matriz é somente para consulta. A hierarquia atual não permite alterar este usuário."
            : "Esta conta está sem acesso. A matriz mostra os acessos bloqueados enquanto a conta não estiver ativa, aprovada e com um papel válido."}
        </p>
      )}
      <div className="admin-permission-catalog-note">
        <ShieldCheck aria-hidden="true" />
        <p>
          A lista segue o catálogo autorizado do CRM. Acessos novos só aparecem quando adicionados
          ao sistema e seguem os padrões do papel e as exceções individuais.
        </p>
      </div>
    </form>
  );
}

function UserDetail({
  user,
  assignableRoles,
  manageablePermissions,
  canManageRoles,
  canManagePermissions,
  canManageUsers,
  canApproveUsers,
  reportingScopes,
}: UserAccessManagerProps & { user: ManagedUser }) {
  const status = getUserStatus(user);
  const hasAnyMutation =
    user.isManageable && (canManageRoles || canManagePermissions || canManageUsers);
  const canEditPermissions =
    accountHasAccess(user) &&
    user.isManageable &&
    canManagePermissions &&
    manageablePermissions.length > 0;
  const roleIsActive = user.roleKey ? ACTIVE_ROLE_KEYS.has(user.roleKey) : false;

  return (
    <article id="selected-user-panel" className="admin-user-detail">
      <header className="admin-user-detail-header" aria-live="polite">
        <div className="admin-user-detail-identity">
          <span className="admin-user-avatar" aria-hidden="true">
            {(user.email?.trim().charAt(0) || "?").toLocaleUpperCase("pt-BR")}
          </span>
          <div>
            <p>{user.isSelf ? "Conta atual" : "Usuário selecionado"}</p>
            <h2>{user.email ?? "E-mail não informado"}</h2>
            <span>{getVisibleRoleLabel(user.roleKey)}</span>
          </div>
        </div>
        <span className={managementStyles.statusPill} data-state={status.key}>
          {status.label}
        </span>
      </header>

      <div className="admin-user-detail-body">
        {user.accessStatus === "pending" && canApproveUsers && user.isManageable ? (
          <section className="admin-access-section" aria-labelledby={`approval-${user.userId}`}>
            <div className="admin-access-section-heading">
              <div>
                <p>Ação necessária</p>
                <h3 id={`approval-${user.userId}`}>Aprovação de acesso escopado</h3>
              </div>
            </div>
            <ApprovalForm user={user} roles={assignableRoles} reportingScopes={reportingScopes} />
          </section>
        ) : null}

        <section className="admin-access-section" aria-labelledby={`role-title-${user.userId}`}>
          <div className="admin-access-section-heading">
            <div>
              <p>Papel e responsabilidades</p>
              <h3 id={`role-title-${user.userId}`}>Papel do usuário</h3>
            </div>
            <span className="admin-section-count">{getEffectivePermissionCount(user)} acessos</span>
          </div>
          {user.isManageable &&
          canManageRoles &&
          canManagePermissions &&
          assignableRoles.length > 0 ? (
            <RoleForm key={`${user.userId}:${user.roleKey}`} user={user} roles={assignableRoles} />
          ) : (
            <div className="admin-current-role">
              <strong>{getVisibleRoleLabel(user.roleKey)}</strong>
              <p>
                {!user.roleKey
                  ? "A conta não possui um conjunto de acessos herdados."
                  : roleIsActive
                    ? ROLES[user.roleKey].description
                    : "Este papel foi descontinuado e precisa ser reclassificado por um responsável autorizado."}
              </p>
            </div>
          )}
        </section>

        <section
          className="admin-access-section admin-permission-section"
          aria-labelledby={`permissions-title-${user.userId}`}
        >
          <div className="admin-access-section-heading">
            <div>
              <p>Acessos efetivos</p>
              <h3 id={`permissions-title-${user.userId}`}>O que pode acessar</h3>
            </div>
            <span className="admin-section-count">{getEffectivePermissionCount(user)} acessos</span>
          </div>
          <p className="admin-permission-intro">
            <strong>Marcado: acesso liberado. Desmarcado: sem acesso.</strong> As caixas mostram o
            resultado do papel e das exceções individuais.
            {canEditPermissions
              ? " Clique para ajustar o rascunho; o papel do usuário não muda."
              : ""}
          </p>
          <PermissionMatrix
            key={`${user.userId}:${user.roleKey}:${JSON.stringify(user.overrides)}`}
            user={user}
            manageablePermissions={manageablePermissions}
            editable={canEditPermissions}
          />
        </section>

        <details className="admin-advanced-settings">
          <summary>Configurações avançadas</summary>
          <div>
            <p className="admin-user-id">ID: {user.userId}</p>
            {user.isManageable && canManageUsers ? <StatusForm user={user} /> : null}
            {!hasAnyMutation ? (
              <p className="admin-form-help">
                Esta conta não pode ser alterada por você devido à hierarquia ou à proteção contra
                autoelevação.
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}

export function UserAccessManager(props: UserAccessManagerProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    props.users[0]?.userId ?? null,
  );
  const users = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return props.users.filter((user) => {
      const roleLabel = getVisibleRoleLabel(user.roleKey);
      const statusLabel = getUserStatus(user).label;
      const matchesSearch =
        !query ||
        `${user.email ?? ""} ${roleLabel} ${statusLabel}`
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      const matchesStatus =
        status === "all" ||
        (status === "active" && accountHasAccess(user)) ||
        (status === "inactive" &&
          (user.accessStatus === "suspended" ||
            (!user.isActive && user.accessStatus !== "pending"))) ||
        (status === "pending" && user.accessStatus === "pending");
      return matchesSearch && matchesStatus;
    });
  }, [props.users, search, status]);
  const activeCount = props.users.filter(accountHasAccess).length;
  const pendingCount = props.users.filter((user) => user.accessStatus === "pending").length;
  const revokedCount = props.users.filter(
    (user) =>
      user.accessStatus === "suspended" || (!user.isActive && user.accessStatus !== "pending"),
  ).length;
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(pageNumber, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleUsers = users.slice(pageStart, pageStart + PAGE_SIZE);
  const selectedUser =
    visibleUsers.find((user) => user.userId === selectedUserId) ?? visibleUsers[0] ?? null;

  function resetPage() {
    setPageNumber(1);
  }

  return (
    <div className="admin-users-content">
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
            <Clock3 />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Aguardando aprovação</span>
            <strong className={managementStyles.summaryValue}>{pendingCount}</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <CircleX />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Acessos revogados</span>
            <strong className={managementStyles.summaryValue}>{revokedCount}</strong>
          </div>
        </article>
      </section>

      <div className="admin-users-workspace">
        <aside className="admin-users-directory" aria-labelledby="users-directory-title">
          <header className="admin-users-directory-header">
            <h2 id="users-directory-title">Pessoas</h2>
            <span className="admin-directory-count">{props.users.length}</span>
          </header>

          <div className="admin-users-directory-controls">
            <label className="admin-directory-search" htmlFor="user-search">
              <Search aria-hidden="true" />
              <span>
                <span className="sr-only">Buscar pessoas</span>
                <input
                  id="user-search"
                  name="userSearch"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPage();
                  }}
                  autoComplete="off"
                  placeholder="Buscar e-mail ou papel…"
                />
              </span>
            </label>
            <div
              className="admin-directory-status-filters"
              role="group"
              aria-label="Filtrar pessoas por status"
            >
              {(
                [
                  ["all", "Todos"],
                  ["active", "Ativos"],
                  ["inactive", "Revogados"],
                  ["pending", "Pendentes"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={status === value}
                  onClick={() => {
                    setStatus(value);
                    resetPage();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul
            className="admin-users-list"
            aria-label="Resultados de usuários"
            data-qa-visual-volatile="user-results"
          >
            {visibleUsers.length > 0 ? (
              visibleUsers.map((user) => {
                const userStatus = getUserStatus(user);
                return (
                  <li key={user.userId}>
                    <button
                      type="button"
                      className="admin-user-option"
                      data-selected={selectedUser?.userId === user.userId}
                      aria-pressed={selectedUser?.userId === user.userId}
                      aria-controls="selected-user-panel"
                      onClick={() => setSelectedUserId(user.userId)}
                    >
                      <span className="admin-user-avatar" aria-hidden="true">
                        {(user.email?.trim().charAt(0) || "?").toLocaleUpperCase("pt-BR")}
                      </span>
                      <span className="admin-user-option-copy">
                        <strong>{user.email ?? "E-mail não informado"}</strong>
                        <span>{getVisibleRoleLabel(user.roleKey)}</span>
                      </span>
                      <span
                        className="admin-user-status-dot"
                        role="img"
                        data-state={userStatus.key}
                        aria-label={userStatus.label}
                        title={userStatus.label}
                      />
                    </button>
                  </li>
                );
              })
            ) : (
              <li>
                <p className={managementStyles.emptyState}>
                  Nenhum usuário corresponde aos filtros.
                </p>
              </li>
            )}
          </ul>

          <footer className={`admin-users-pagination ${managementStyles.pagination}`}>
            <p aria-live="polite">
              {users.length
                ? pageCount === 1
                  ? `${users.length} de ${users.length}`
                  : `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, users.length)} de ${users.length}`
                : "0 usuários"}
            </p>
            {pageCount === 1 ? (
              <span>Fim da lista.</span>
            ) : (
              <div className={managementStyles.paginationControls}>
                <button
                  type="button"
                  className={managementStyles.pageButton}
                  disabled={currentPage === 1}
                  onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft aria-hidden="true" />
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
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            )}
          </footer>
        </aside>

        {selectedUser ? (
          <UserDetail key={selectedUser.userId} user={selectedUser} {...props} />
        ) : (
          <section className="admin-user-detail admin-user-detail-empty" id="selected-user-panel">
            <ShieldCheck aria-hidden="true" />
            <h2>
              {props.users.length ? "Nenhuma pessoa encontrada" : "Nenhum usuário cadastrado"}
            </h2>
            <p>
              {props.users.length
                ? "Ajuste a busca ou o filtro de status para encontrar uma conta."
                : "Quando houver contas disponíveis, selecione uma para revisar papel e permissões."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
