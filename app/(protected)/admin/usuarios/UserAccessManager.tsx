"use client";

import { useActionState, useMemo, useState, type FormEvent } from "react";

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
  removePermissionOverrideAction,
  setPermissionOverrideAction,
  setUserActiveAction,
  type AdminActionState,
} from "./actions";

const INITIAL_STATE: AdminActionState = { status: "idle", message: "" };

export interface UserPermissionOverride {
  permissionKey: PermissionKey;
  effect: "allow" | "deny";
  reason: string | null;
}

export interface ManagedUser {
  userId: string;
  email: string | null;
  isActive: boolean;
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
      className={`rounded-lg px-3 py-2 text-sm ${
        state.status === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
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
        <label className="text-sm font-medium text-slate-800" htmlFor={`role-${user.userId}`}>
          Papel
        </label>
        <select
          id={`role-${user.userId}`}
          name="roleKey"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as RoleKey)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {roles.map((roleKey) => (
            <option key={roleKey} value={roleKey}>
              {getRoleLabel(roleKey)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{ROLES[selectedRole].description}</p>
      </div>
      <div>
        <label
          className="text-sm font-medium text-slate-800"
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
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <strong className="text-slate-800">Resumo:</strong> acessos adicionados:{" "}
        {formatPermissionList(change.added)}; acessos removidos:{" "}
        {formatPermissionList(change.removed)}.
      </div>
      <button
        type="submit"
        disabled={pending || unchanged}
        className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="text-sm font-medium text-slate-800"
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
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{summary}</p>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
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
            className="text-sm font-medium text-slate-800"
            htmlFor={`permission-${user.userId}`}
          >
            Permissão
          </label>
          <select
            id={`permission-${user.userId}`}
            name="permissionKey"
            value={permissionKey}
            onChange={(event) => setPermissionKey(event.target.value as PermissionKey)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {permissions.map((key) => (
              <option key={key} value={key}>
                {getPermissionLabel(key)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{PERMISSIONS[permissionKey].description}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-800" htmlFor={`effect-${user.userId}`}>
            Efeito
          </label>
          <select
            id={`effect-${user.userId}`}
            name="effect"
            value={effect}
            onChange={(event) => setEffect(event.target.value as "allow" | "deny")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="allow">Permitir individualmente</option>
            <option value="deny">Negar individualmente</option>
          </select>
        </div>
      </div>
      <div>
        <label
          className="text-sm font-medium text-slate-800"
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
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{summary}</p>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
      >
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
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
}: UserAccessManagerProps & { user: ManagedUser }) {
  const inherited = user.roleKey ? ROLE_INHERITED_PERMISSIONS[user.roleKey] : [];
  const hasControls =
    user.isManageable && (canManageRoles || canManagePermissions || canManageUsers);

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4 marker:hidden sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate font-medium text-slate-950">
              {user.email ?? "E-mail não informado"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {user.roleKey ? getRoleLabel(user.roleKey) : "Sem papel"}
              {user.isSelf ? " · Sua conta" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              className={`rounded-full px-2.5 py-1 ${
                user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {user.isActive ? "Ativo" : "Inativo"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {user.overrides.length} {user.overrides.length === 1 ? "exceção" : "exceções"}
            </span>
            <span aria-hidden="true" className="text-lg text-slate-500">
              ▾
            </span>
          </div>
        </summary>

        <div className="border-t border-slate-200 px-4 py-5 sm:px-5">
          <section aria-labelledby={`role-title-${user.userId}`}>
            <h3 id={`role-title-${user.userId}`} className="font-semibold text-slate-900">
              {user.roleKey ? getRoleLabel(user.roleKey) : "Sem papel"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {user.roleKey
                ? ROLES[user.roleKey].description
                : "A conta não possui um conjunto de acessos herdados."}
            </p>
          </section>

          <section className="mt-5" aria-labelledby={`inherited-title-${user.userId}`}>
            <h3 id={`inherited-title-${user.userId}`} className="font-semibold text-slate-900">
              Permissões herdadas do papel
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {inherited.map((permissionKey) => (
                <li key={permissionKey} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <strong className="text-slate-800">{getPermissionLabel(permissionKey)}</strong>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {PERMISSIONS[permissionKey].description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5" aria-labelledby={`exceptions-title-${user.userId}`}>
            <h3 id={`exceptions-title-${user.userId}`} className="font-semibold text-slate-900">
              Exceções individuais
            </h3>
            {user.overrides.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Nenhuma exceção configurada.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {user.overrides.map((override) => (
                  <li key={override.permissionKey} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <strong className="text-slate-900">
                      {getPermissionLabel(override.permissionKey)}
                    </strong>
                    <p className="mt-1 text-slate-600">
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

          <details className="mt-6 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-semibold text-slate-900">
              Configurações avançadas
            </summary>
            <p className="mt-2 font-mono text-xs break-all text-slate-500">ID: {user.userId}</p>
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
              <p className="mt-3 text-sm text-slate-600">
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
  const users = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return props.users;

    return props.users.filter((user) => {
      const role = user.roleKey ? getRoleLabel(user.roleKey) : "sem papel";
      const status = user.isActive ? "ativo" : "inativo";
      return `${user.email ?? ""} ${role} ${status}`.toLocaleLowerCase("pt-BR").includes(query);
    });
  }, [props.users, search]);

  return (
    <div className="mt-8">
      <label className="font-medium text-slate-900" htmlFor="user-search">
        Buscar usuário
      </label>
      <input
        id="user-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="E-mail, papel ou status"
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 sm:max-w-xl"
      />
      <p className="mt-2 text-sm text-slate-500" aria-live="polite">
        {users.length} {users.length === 1 ? "usuário encontrado" : "usuários encontrados"}
      </p>

      {users.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {users.map((user) => (
            <UserRow key={user.userId} user={user} {...props} />
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-white p-5 text-slate-600 ring-1 ring-slate-200">
          Nenhum usuário corresponde à busca.
        </p>
      )}
    </div>
  );
}
