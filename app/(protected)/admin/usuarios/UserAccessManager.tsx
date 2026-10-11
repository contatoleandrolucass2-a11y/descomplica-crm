"use client";

import { Check, CircleMinus, CircleX, Search, ShieldCheck } from "lucide-react";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import {
  PERMISSIONS,
  getPermissionLabel,
  type PermissionKey,
} from "@/lib/authorization/permissions";
import { summarizeRoleChange } from "@/lib/authorization/access-presentation";
import { ROLES, getRoleLabel, type RoleKey } from "@/lib/authorization/roles";

import {
  assignRoleAction,
  approveUserAccessAction,
  loadUsersPageAction,
  setPermissionOverridesBulkAction,
  setUserActiveAction,
  type AdminActionState,
} from "./actions";
import type {
  ManagedUser,
  UserDirectoryStatusFilter,
  UserPermissionOverride,
} from "./user-directory-types";

export type { ManagedUser } from "./user-directory-types";

const INITIAL_STATE: AdminActionState = { status: "idle", message: "" };
const PAGE_SIZE = 6;
const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];
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
    matches: (key) =>
      key.startsWith("crm.simulators.") ||
      key.startsWith("crm.commercial_engine.") ||
      key.startsWith("crm.commercial_policy."),
  },
  {
    id: "settings",
    label: "Configurações",
    matches: (key) =>
      key.startsWith("crm.settings.") ||
      key.startsWith("crm.salesforce.") ||
      key.startsWith("crm.ingest."),
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

interface UserAccessManagerProps {
  users: ManagedUser[];
  initialHasMore?: boolean;
  initialNextOffset?: number | null;
  initialTotalCount?: number | null;
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
  return user.inheritedPermissions;
}

function getEffectivePermissionCount(user: ManagedUser): number {
  if (!user.isActive || user.accessStatus !== "approved" || !user.roleKey) return 0;
  const effectivePermissions = new Set<PermissionKey>(getInheritedPermissions(user));
  for (const override of user.overrides) {
    if (override.effect === "allow") effectivePermissions.add(override.permissionKey);
    else effectivePermissions.delete(override.permissionKey);
  }
  return effectivePermissions.size;
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

function useRefreshAfterMutation(state: AdminActionState, onMutationSuccess: () => void) {
  const handledState = useRef<AdminActionState | null>(null);

  useEffect(() => {
    if (state.status !== "success" || handledState.current === state) return;
    handledState.current = state;
    onMutationSuccess();
  }, [onMutationSuccess, state]);
}

function ApprovalForm({
  user,
  roles,
  reportingScopes,
  onMutationSuccess,
}: {
  user: ManagedUser;
  roles: RoleKey[];
  reportingScopes: UserAccessManagerProps["reportingScopes"];
  onMutationSuccess: () => void;
}) {
  const availableRoles = roles.filter((role) => APPROVABLE_ROLE_KEYS.has(role));
  const [state, action, pending] = useActionState(
    approveUserAccessAction.bind(null, user.userId),
    INITIAL_STATE,
  );
  useRefreshAfterMutation(state, onMutationSuccess);

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
      <label>
        <span>Motivo da aprovação</span>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={240}
          autoComplete="off"
          placeholder="Descreva o motivo…"
        />
      </label>
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

function RoleForm({
  user,
  roles,
  onMutationSuccess,
}: {
  user: ManagedUser;
  roles: RoleKey[];
  onMutationSuccess: () => void;
}) {
  const currentAssignableRole =
    user.roleKey && roles.includes(user.roleKey) ? user.roleKey : undefined;
  const initialRole = currentAssignableRole ?? roles[0]!;
  const [selectedRole, setSelectedRole] = useState<RoleKey>(initialRole);
  const [state, action, pending] = useActionState(
    assignRoleAction.bind(null, user.userId),
    INITIAL_STATE,
  );
  useRefreshAfterMutation(state, onMutationSuccess);
  const change = summarizeRoleChange(user.roleKey, selectedRole);
  const elevation = ROLES[selectedRole].level > (user.roleKey ? ROLES[user.roleKey].level : 0);
  const unchanged = user.roleKey === selectedRole;
  const summary = [
    `Papel: ${getVisibleRoleLabel(user.roleKey)} → ${getRoleLabel(selectedRole)}`,
    `Acessos adicionados: ${formatPermissionList(change.added)}`,
    `Acessos removidos: ${formatPermissionList(change.removed)}`,
    "As exceções individuais existentes não serão alteradas.",
  ].join("\n");

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, summary)}
      className="admin-role-form"
    >
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
        <label htmlFor={`role-reason-${user.userId}`}>
          <span>Motivo {elevation ? "(obrigatório para elevação)" : "(opcional)"}</span>
          <input
            id={`role-reason-${user.userId}`}
            name="reason"
            required={elevation}
            minLength={elevation ? 3 : undefined}
            maxLength={240}
            autoComplete="off"
            placeholder="Descreva a alteração…"
          />
        </label>
      </div>
      <p className="admin-role-description">{ROLES[selectedRole].description}</p>
      <div className="admin-change-summary">
        <strong>Resumo do papel</strong>
        <span>{change.added.length} adicionadas</span>
        <span>{change.removed.length} removidas</span>
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

function StatusForm({
  user,
  onMutationSuccess,
}: {
  user: ManagedUser;
  onMutationSuccess: () => void;
}) {
  const nextActive = !user.isActive;
  const [state, action, pending] = useActionState(
    setUserActiveAction.bind(null, user.userId, nextActive),
    INITIAL_STATE,
  );
  useRefreshAfterMutation(state, onMutationSuccess);
  const summary = nextActive
    ? "A conta será reativada e voltará a usar os acessos efetivos do papel e das exceções."
    : "A conta será desativada e todos os acessos serão suspensos.";

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, summary)}
      className="admin-status-form"
    >
      <label htmlFor={`status-reason-${user.userId}`}>
        <span>Motivo {nextActive ? "(opcional)" : "(obrigatório para desativação)"}</span>
        <input
          id={`status-reason-${user.userId}`}
          name="reason"
          required={!nextActive}
          minLength={!nextActive ? 3 : undefined}
          maxLength={240}
          autoComplete="off"
          placeholder="Descreva o motivo…"
        />
      </label>
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
  hasApprovedAccess: boolean,
) {
  if (!hasApprovedAccess) {
    return { key: "account-inactive", label: "Conta sem acesso", permitted: false } as const;
  }
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
  onMutationSuccess,
}: {
  user: ManagedUser;
  manageablePermissions: PermissionKey[];
  editable: boolean;
  onMutationSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState(() => {
    const firstRelevantPermission =
      getInheritedPermissions(user)[0] ??
      user.overrides[0]?.permissionKey ??
      manageablePermissions[0];
    return firstRelevantPermission
      ? (PERMISSION_GROUPS.find((group) => group.matches(firstRelevantPermission))?.id ?? "other")
      : PERMISSION_GROUPS[0]!.id;
  });
  const [selected, setSelected] = useState<Set<PermissionKey>>(() => new Set());
  const [effect, setEffect] = useState<BulkEffect>("allow");
  const [reason, setReason] = useState("");
  const submitOverrides = useCallback(
    async (previousState: AdminActionState, formData: FormData) => {
      const nextState = await setPermissionOverridesBulkAction(
        user.userId,
        previousState,
        formData,
      );
      if (nextState.status === "success") {
        setSelected(new Set());
        setEffect("allow");
        setReason("");
      }
      return nextState;
    },
    [user.userId],
  );
  const [state, action, pending] = useActionState(submitOverrides, INITIAL_STATE);
  useRefreshAfterMutation(state, onMutationSuccess);
  const manageable = useMemo(() => new Set(manageablePermissions), [manageablePermissions]);
  const inherited = useMemo(() => new Set<PermissionKey>(getInheritedPermissions(user)), [user]);
  const hasApprovedAccess =
    user.isActive && user.accessStatus === "approved" && user.roleKey !== null;
  const overrides = useMemo(
    () => new Map(user.overrides.map((override) => [override.permissionKey, override])),
    [user.overrides],
  );
  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return ALL_PERMISSIONS;
    return ALL_PERMISSIONS.filter((permissionKey) => {
      const permission = PERMISSIONS[permissionKey];
      return `${permission.label} ${permission.description} ${permissionKey}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    });
  }, [search]);
  const permissionTabs = useMemo(() => {
    const tabs = PERMISSION_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      permissions: filteredPermissions.filter(group.matches),
      total: ALL_PERMISSIONS.filter(group.matches).length,
    }));
    const knownPermissions = new Set(
      PERMISSION_GROUPS.flatMap((group) => ALL_PERMISSIONS.filter(group.matches)),
    );
    const otherPermissions = filteredPermissions.filter(
      (permissionKey) => !knownPermissions.has(permissionKey),
    );
    const otherTotal = ALL_PERMISSIONS.filter(
      (permissionKey) => !knownPermissions.has(permissionKey),
    ).length;
    if (otherTotal > 0) {
      tabs.push({
        id: "other",
        label: "Outras",
        permissions: otherPermissions,
        total: otherTotal,
      });
    }
    return tabs;
  }, [filteredPermissions]);
  const activeTab = permissionTabs.find((group) => group.id === activeGroup) ?? permissionTabs[0]!;
  const selectableFiltered = activeTab.permissions.filter((permissionKey) =>
    manageable.has(permissionKey),
  );
  const allFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((permissionKey) => selected.has(permissionKey));
  const selectedLabels = [...selected].map(getPermissionLabel);
  const effectLabel =
    effect === "allow" ? "permitir" : effect === "deny" ? "negar" : "restaurar o padrão de";

  function togglePermission(permissionKey: PermissionKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permissionKey)) next.delete(permissionKey);
      else next.add(permissionKey);
      return next;
    });
  }

  function toggleFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const permissionKey of selectableFiltered) next.delete(permissionKey);
      } else {
        for (const permissionKey of selectableFiltered) next.add(permissionKey);
      }
      return next;
    });
  }

  function clearDraft() {
    setSelected(new Set());
    setEffect("allow");
    setReason("");
  }

  const confirmation = `${selected.size} ${
    selected.size === 1 ? "permissão será alterada" : "permissões serão alteradas"
  }: ${selectedLabels.join(", ")}. A ação será ${effectLabel}. O papel não será alterado.`;

  return (
    <form
      action={action}
      onSubmit={(event) => confirmChange(event, confirmation)}
      className="admin-permission-form"
    >
      {manageablePermissions.map((permissionKey) => (
        <input
          key={permissionKey}
          type="hidden"
          name="permissionKeys"
          value={permissionKey}
          disabled={!selected.has(permissionKey)}
        />
      ))}
      <div className="admin-permission-toolbar">
        <label className="admin-permission-search" htmlFor={`permission-search-${user.userId}`}>
          <Search aria-hidden="true" />
          <span>
            <span>Buscar acesso</span>
            <input
              id={`permission-search-${user.userId}`}
              name="permissionSearch"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              placeholder="Buscar acesso ou função…"
            />
          </span>
        </label>
        {editable ? (
          <button
            type="button"
            className={managementStyles.button}
            onClick={toggleFiltered}
            disabled={selectableFiltered.length === 0 || pending}
          >
            {allFilteredSelected ? "Limpar seleção" : "Selecionar grupo"}
          </button>
        ) : null}
      </div>

      <div className="admin-permission-tabs" role="tablist" aria-label="Grupos de acesso">
        {permissionTabs.map((group) => (
          <button
            key={group.id}
            id={`permission-tab-${user.userId}-${group.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab.id === group.id}
            aria-controls={`permission-panel-${user.userId}-${group.id}`}
            data-selected={activeTab.id === group.id}
            onClick={() => setActiveGroup(group.id)}
          >
            <span>{group.label}</span>
            <small>{group.total}</small>
          </button>
        ))}
      </div>

      {editable ? (
        <fieldset className="admin-permission-effects">
          <legend>Aplicar às permissões selecionadas</legend>
          {(
            [
              ["allow", "Permitir", Check],
              ["deny", "Negar", CircleX],
              ["inherit", "Restaurar padrão", CircleMinus],
            ] as const
          ).map(([value, label, Icon]) => (
            <label key={value} data-selected={effect === value}>
              <input
                type="radio"
                name="effect"
                value={value}
                checked={effect === value}
                onChange={() => setEffect(value)}
              />
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="admin-permission-groups">
        {activeTab.permissions.length > 0 ? (
          <section
            className="admin-permission-group"
            id={`permission-panel-${user.userId}-${activeTab.id}`}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`permission-tab-${user.userId}-${activeTab.id}`}
          >
            <div className="admin-permission-grid">
              {activeTab.permissions.map((permissionKey) => {
                const override = overrides.get(permissionKey);
                const permissionState = getPermissionState(
                  permissionKey,
                  inherited,
                  override,
                  hasApprovedAccess,
                );
                const canSelect = editable && manageable.has(permissionKey);
                return (
                  <div
                    key={permissionKey}
                    className="admin-permission-option"
                    data-disabled={!canSelect}
                    data-editable={editable}
                    data-selected={selected.has(permissionKey)}
                  >
                    <input
                      type="checkbox"
                      checked={permissionState.permitted}
                      disabled
                      aria-label={`Acesso efetivo: ${getPermissionLabel(permissionKey)}`}
                    />
                    <span className="admin-permission-option-copy">
                      <strong>{getPermissionLabel(permissionKey)}</strong>
                      <small>{PERMISSIONS[permissionKey].description}</small>
                      {override?.reason ? (
                        <small className="admin-permission-override-reason">
                          Motivo atual: {override.reason}
                        </small>
                      ) : null}
                      {canSelect ? (
                        <button
                          type="button"
                          className={managementStyles.button}
                          aria-pressed={selected.has(permissionKey)}
                          onClick={() => togglePermission(permissionKey)}
                          disabled={pending}
                        >
                          {selected.has(permissionKey)
                            ? "Remover da alteração"
                            : "Incluir na alteração"}
                        </button>
                      ) : null}
                    </span>
                    <span className="admin-permission-state" data-state={permissionState.key}>
                      {permissionState.permitted ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <CircleMinus aria-hidden="true" />
                      )}
                      {permissionState.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <p className={managementStyles.emptyState}>
            Nenhum acesso deste grupo corresponde à busca.
          </p>
        )}
      </div>

      {editable ? (
        <div className="admin-permission-footer">
          <label htmlFor={`override-reason-${user.userId}`}>
            <span>Motivo da alteração em lote</span>
            <input
              id={`override-reason-${user.userId}`}
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={3}
              maxLength={240}
              autoComplete="off"
              placeholder="Explique por que estas permissões serão alteradas…"
            />
          </label>
          <div className="admin-permission-summary" role="status" aria-live="polite">
            <strong>Resumo</strong>
            <span>
              {selected.size === 0
                ? "Nenhuma permissão selecionada."
                : `${selected.size} ${
                    selected.size === 1 ? "permissão selecionada" : "permissões selecionadas"
                  } para ${effectLabel}.`}
            </span>
          </div>
          <div className="admin-permission-submit-actions">
            <button
              type="button"
              className={managementStyles.button}
              onClick={clearDraft}
              disabled={pending || (selected.size === 0 && reason.length === 0)}
            >
              Descartar
            </button>
            <button
              type="submit"
              className={managementStyles.buttonPrimary}
              disabled={pending || selected.size === 0}
            >
              {pending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
          <ActionFeedback state={state} />
        </div>
      ) : (
        <p className="admin-permission-readonly-note">
          Esta matriz é somente para consulta. A hierarquia atual não permite alterar este usuário.
        </p>
      )}
    </form>
  );
}

function UserDetail({
  user,
  assignableRoles,
  manageablePermissions,
  canManageRoles,
  canManagePermissions,
  isMasterPermissionManager,
  canManageUsers,
  canApproveUsers,
  reportingScopes,
  onMutationSuccess,
}: UserAccessManagerProps & { user: ManagedUser; onMutationSuccess: () => void }) {
  const status = getUserStatus(user);
  const hasAnyMutation =
    user.isManageable && (canManageRoles || canManagePermissions || canManageUsers);
  const canEditPermissions =
    user.isManageable && canManagePermissions && manageablePermissions.length > 0;
  const roleIsActive = user.roleKey ? ACTIVE_ROLE_KEYS.has(user.roleKey) : false;
  const protectedAdministratorAccount =
    user.roleKey === "admin" && !user.isSelf && !isMasterPermissionManager;
  const mutationBlockMessage = user.isSelf
    ? "Você não pode alterar seu próprio papel, permissões ou status."
    : protectedAdministratorAccount
      ? "Somente o Master pode alterar papel, permissões ou status de outro Administrador."
      : "Esta conta não pode ser alterada por você devido à hierarquia de acesso.";

  return (
    <article id="selected-user-panel" className="admin-user-detail">
      <header className="admin-user-detail-header" aria-live="polite">
        <div className="admin-user-detail-identity">
          <span className="admin-user-avatar" aria-hidden="true">
            {(user.email?.trim().charAt(0) || "?").toLocaleUpperCase("pt-BR")}
          </span>
          <div>
            <p>{user.isSelf ? "Conta atual" : "Usuário selecionado"}</p>
            <h2 title={user.email ?? undefined}>{user.email ?? "E-mail não informado"}</h2>
            <span>{getVisibleRoleLabel(user.roleKey)}</span>
          </div>
        </div>
        <div className="admin-user-detail-badges">
          <span className={managementStyles.statusPill} data-state={status.key}>
            {status.label}
          </span>
          {!hasAnyMutation ? (
            <span
              className="admin-protected-account-badge"
              role="status"
              aria-label={mutationBlockMessage}
              title={mutationBlockMessage}
            >
              <ShieldCheck aria-hidden="true" />
              {protectedAdministratorAccount ? "Protegida pelo Master" : "Conta protegida"}
            </span>
          ) : null}
        </div>
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
            <ApprovalForm
              user={user}
              roles={assignableRoles}
              reportingScopes={reportingScopes}
              onMutationSuccess={onMutationSuccess}
            />
          </section>
        ) : null}

        <section
          className="admin-access-section admin-profile-section"
          aria-labelledby={`role-title-${user.userId}`}
        >
          <div className="admin-access-section-heading">
            <div>
              <p>Perfil</p>
              <h3 id={`role-title-${user.userId}`}>{getVisibleRoleLabel(user.roleKey)}</h3>
            </div>
            <span className="admin-section-count">
              {user.permissionDetailsAvailable !== false
                ? `${getEffectivePermissionCount(user)} acessos`
                : "Acessos restritos"}
            </span>
          </div>
          {user.isManageable && canManageRoles && assignableRoles.length > 0 ? (
            <details className="admin-role-editor">
              <summary>Alterar papel</summary>
              <RoleForm
                key={user.userId}
                user={user}
                roles={assignableRoles}
                onMutationSuccess={onMutationSuccess}
              />
            </details>
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
            <span className="admin-section-count">
              {user.permissionDetailsAvailable !== false
                ? `${getEffectivePermissionCount(user)} acessos`
                : "Detalhes restritos"}
            </span>
          </div>
          {isMasterPermissionManager && user.isManageable ? (
            <p className="admin-permission-intro">
              Marque os acessos que deseja alterar. As caixas mostram o{" "}
              <strong>acesso efetivo</strong>, após papel e exceções. Como Master, use{" "}
              <strong>Incluir na alteração</strong> e aplique <strong>Permitir</strong> para criar
              uma exceção individual em qualquer usuário abaixo do seu nível. O papel do usuário não
              muda.
            </p>
          ) : (
            <p className="admin-permission-intro">
              Consulte o <strong>acesso efetivo</strong>. A origem identifica
              <strong> Permissões herdadas do papel</strong> e <strong>Exceções individuais</strong>
              ; os botões de alteração formam um lote separado.
            </p>
          )}
          {user.permissionDetailsAvailable !== false ? (
            <PermissionMatrix
              key={user.userId}
              user={user}
              manageablePermissions={manageablePermissions}
              editable={canEditPermissions}
              onMutationSuccess={onMutationSuccess}
            />
          ) : (
            <p className="admin-permission-readonly-note" role="status">
              Detalhes de acesso efetivo indisponíveis: este perfil não pode consultar exceções
              individuais. Nenhuma permissão é presumida.
            </p>
          )}
          <p className="admin-access-catalog-note">
            <ShieldCheck aria-hidden="true" />
            <span>
              A lista segue o catálogo autorizado do CRM. Novas capacidades só aparecem quando
              versionadas e continuam sem acesso por padrão.
            </span>
          </p>
        </section>

        <details className="admin-advanced-settings">
          <summary>Configurações avançadas</summary>
          <div>
            <p className="admin-user-id">ID: {user.userId}</p>
            {user.isManageable && canManageUsers ? (
              <StatusForm user={user} onMutationSuccess={onMutationSuccess} />
            ) : null}
            {!hasAnyMutation ? <p className="admin-form-help">{mutationBlockMessage}</p> : null}
          </div>
        </details>
      </div>
    </article>
  );
}

export function UserAccessManager(props: UserAccessManagerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<UserDirectoryStatusFilter>("all");
  const [users, setUsers] = useState(props.users);
  const [hasMore, setHasMore] = useState(props.initialHasMore ?? false);
  const [nextOffset, setNextOffset] = useState<number | null>(
    props.initialNextOffset ?? (props.initialHasMore ? PAGE_SIZE : null),
  );
  const [totalCount, setTotalCount] = useState<number | null>(
    props.initialTotalCount ?? props.users.length,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    props.users[0]?.userId ?? null,
  );
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const loadingRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const filterEffectReadyRef = useRef(false);
  const initialUsersSignature = JSON.stringify(props.users);
  const previousInitialUsersSignatureRef = useRef(initialUsersSignature);

  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? users[0] ?? null;

  const fetchPage = useCallback(
    async ({
      offset,
      replace,
      query,
      statusFilter,
    }: {
      offset: number;
      replace: boolean;
      query: string;
      statusFilter: UserDirectoryStatusFilter;
    }) => {
      if (!replace && loadingRef.current) return;
      const generation = ++requestGenerationRef.current;
      loadingRef.current = true;
      setLoading(true);
      setLoadError(null);
      if (replace) {
        setUsers([]);
        setSelectedUserId(null);
        setHasMore(false);
        setNextOffset(null);
        setTotalCount(null);
      }

      try {
        const result = await loadUsersPageAction({
          offset,
          search: query,
          status: statusFilter,
        });
        if (generation !== requestGenerationRef.current) return;
        if (result.status === "error") {
          setLoadError(result.message);
          return;
        }

        setUsers((current) => {
          if (replace) return result.page.users;
          const merged = new Map(current.map((user) => [user.userId, user]));
          for (const user of result.page.users) merged.set(user.userId, user);
          return [...merged.values()];
        });
        setSelectedUserId((current) => current ?? result.page.users[0]?.userId ?? null);
        setHasMore(result.page.hasMore);
        setNextOffset(result.page.nextOffset);
        setTotalCount(result.page.totalCount);
      } catch {
        if (generation === requestGenerationRef.current) {
          setLoadError("Não foi possível carregar mais usuários. Tente novamente.");
        }
      } finally {
        if (generation === requestGenerationRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || nextOffset === null || loadingRef.current) return;
    startTransition(() => {
      void fetchPage({
        offset: nextOffset,
        replace: false,
        query: debouncedSearch,
        statusFilter: status,
      });
    });
  }, [debouncedSearch, fetchPage, hasMore, nextOffset, status]);

  const refreshDirectory = useCallback(() => {
    startTransition(() => {
      void fetchPage({
        offset: 0,
        replace: true,
        query: debouncedSearch,
        statusFilter: status,
      });
    });
  }, [debouncedSearch, fetchPage, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!filterEffectReadyRef.current) {
      filterEffectReadyRef.current = true;
      return;
    }
    startTransition(() => {
      void fetchPage({
        offset: 0,
        replace: true,
        query: debouncedSearch,
        statusFilter: status,
      });
    });
  }, [debouncedSearch, fetchPage, status]);

  useEffect(() => {
    if (previousInitialUsersSignatureRef.current === initialUsersSignature) return;
    previousInitialUsersSignatureRef.current = initialUsersSignature;
    if (search || status !== "all" || loadingRef.current) return;

    const initialIds = new Set(props.users.map((user) => user.userId));
    setUsers((current) => [
      ...props.users,
      ...current.filter((user) => !initialIds.has(user.userId)),
    ]);
    setSelectedUserId((current) => current ?? props.users[0]?.userId ?? null);
    setHasMore(props.initialHasMore ?? false);
    setNextOffset(props.initialNextOffset ?? (props.initialHasMore ? PAGE_SIZE : null));
    setTotalCount(props.initialTotalCount ?? props.users.length);
  }, [
    initialUsersSignature,
    props.initialHasMore,
    props.initialNextOffset,
    props.initialTotalCount,
    props.users,
    search,
    status,
  ]);

  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (
      !root ||
      !sentinel ||
      !hasMore ||
      loading ||
      loadError ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root, rootMargin: "0px 0px 160px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadError, loadMore, loading]);

  return (
    <div className="admin-users-content">
      <div className="admin-users-workspace">
        <aside className="admin-users-directory" aria-labelledby="users-directory-title">
          <header className="admin-users-directory-header">
            <h2 id="users-directory-title">Pessoas</h2>
            <span>{totalCount ?? users.length}</span>
          </header>

          <div className="admin-users-directory-controls">
            <label className="admin-directory-search" htmlFor="user-search">
              <Search aria-hidden="true" />
              <span>
                <span>Buscar pessoa</span>
                <input
                  id="user-search"
                  name="userSearch"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoComplete="off"
                  placeholder="Buscar nome ou e-mail"
                />
              </span>
            </label>
            <div className="admin-directory-filter-chips" aria-label="Filtrar por status">
              {(
                [
                  ["all", "Todos"],
                  ["active", "Ativos"],
                  ["inactive", "Revogados"],
                  ["pending", "Pendentes"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  data-selected={status === value}
                  onClick={() => setStatus(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul
            ref={listRef}
            className="admin-users-list"
            aria-label="Resultados de usuários"
            data-qa-visual-volatile="user-results"
          >
            {users.length > 0 ? (
              users.map((user) => {
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
                        data-state={userStatus.key}
                        title={userStatus.label}
                      >
                        <span className="sr-only">{userStatus.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li>
                <p className={managementStyles.emptyState}>
                  {loading
                    ? "Carregando usuários…"
                    : loadError
                      ? "A lista não pôde ser carregada."
                      : "Nenhum usuário corresponde aos filtros."}
                </p>
              </li>
            )}
            {hasMore || loading ? (
              <li ref={sentinelRef} className="admin-users-load-sentinel">
                {loading && users.length > 0 ? (
                  <p role="status" aria-live="polite">
                    Carregando mais usuários…
                  </p>
                ) : null}
              </li>
            ) : null}
          </ul>

          <footer className={`admin-users-pagination ${managementStyles.pagination}`}>
            <p aria-live="polite">
              {totalCount === null
                ? `${users.length} ${users.length === 1 ? "usuário carregado" : "usuários carregados"}`
                : `${users.length} de ${totalCount}`}
            </p>
            <div className={managementStyles.paginationControls}>
              {loadError ? <span role="alert">{loadError}</span> : null}
              {hasMore || loadError ? (
                <button
                  type="button"
                  className={managementStyles.button}
                  disabled={loading}
                  onClick={() => {
                    if (users.length === 0) {
                      void fetchPage({
                        offset: 0,
                        replace: true,
                        query: debouncedSearch,
                        statusFilter: status,
                      });
                    } else {
                      loadMore();
                    }
                  }}
                >
                  {loading
                    ? "Carregando…"
                    : loadError
                      ? "Tentar novamente"
                      : "Carregar mais usuários"}
                </button>
              ) : users.length > 0 ? (
                <span>Fim da lista.</span>
              ) : null}
            </div>
          </footer>
        </aside>

        {selectedUser ? (
          <UserDetail
            key={selectedUser.userId}
            user={selectedUser}
            onMutationSuccess={refreshDirectory}
            {...props}
          />
        ) : (
          <section className="admin-user-detail admin-user-detail-empty" id="selected-user-panel">
            <ShieldCheck aria-hidden="true" />
            <h2>Nenhum usuário cadastrado</h2>
            <p>Quando houver contas disponíveis, selecione uma para revisar papel e permissões.</p>
          </section>
        )}
      </div>
    </div>
  );
}
