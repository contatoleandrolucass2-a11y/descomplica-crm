import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { ROLES, type RoleKey } from "@/lib/authorization/roles";

import {
  assignRoleAction,
  removePermissionOverrideAction,
  setPermissionOverrideAction,
  setUserActiveAction,
} from "./actions";

export const metadata = { title: "Usuários e acessos" };

const profileSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});
const roleAssignmentSchema = z.object({ user_id: z.string().uuid(), role_key: z.string() });
const overrideSchema = z.object({
  user_id: z.string().uuid(),
  permission_key: z.string(),
  effect: z.enum(["allow", "deny"]),
  reason: z.string().nullable(),
});

function isRoleKey(value: string | undefined): value is RoleKey {
  return value !== undefined && Object.prototype.hasOwnProperty.call(ROLES, value);
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export default async function UsersAdminPage() {
  const context = await enforcePermission("users.view");
  const supabase = await createClient();
  const [profilesResult, rolesResult, overridesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,email,is_active,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id,role_key"),
    supabase.from("user_permission_overrides").select("user_id,permission_key,effect,reason"),
  ]);

  if (profilesResult.error || rolesResult.error || overridesResult.error) {
    throw new Error("Não foi possível carregar a administração de usuários.");
  }

  const profiles = z.array(profileSchema).parse(profilesResult.data ?? []);
  const assignments = z.array(roleAssignmentSchema).parse(rolesResult.data ?? []);
  const overrides = z.array(overrideSchema).parse(overridesResult.data ?? []);
  const rolesByUser = new Map(assignments.map((row) => [row.user_id, row.role_key]));
  const assignableRoles = Object.entries(ROLES).filter(([, role]) => role.level < context.level);
  const manageablePermissions = Object.entries(PERMISSIONS).filter(
    ([key, permission]) =>
      context.permissions.includes(key as PermissionKey) && permission.minLevel < context.level,
  );
  const canManageRoles = hasPermission(context, "roles.manage");
  const canManagePermissions = hasPermission(context, "permissions.manage");
  const canManageUsers = hasPermission(context, "users.manage");

  return (
    <main className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold text-slate-950">Usuários e acessos</h1>
        <p className="mt-2 text-slate-600">
          Todas as alterações passam por RPCs hierárquicas e geram registro de auditoria.
        </p>

        <div className="mt-8 grid gap-5">
          {profiles.map((profile) => {
            const rawRoleKey = rolesByUser.get(profile.user_id);
            const roleKey = isRoleKey(rawRoleKey) ? rawRoleKey : null;
            const targetLevel = roleKey ? ROLES[roleKey].level : 0;
            const isSelf = profile.user_id === context.userId;
            const targetIsManageable = !isSelf && targetLevel < context.level;
            const userOverrides = overrides.filter((row) => row.user_id === profile.user_id);

            return (
              <article
                key={profile.user_id}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-slate-950">
                      {profile.email ?? "E-mail não informado"}
                    </h2>
                    <p className="mt-1 font-mono text-xs break-all text-slate-500">
                      {profile.user_id}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs font-medium">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                      {roleKey ?? "sem papel"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 ${
                        profile.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {profile.is_active ? "ativo" : "inativo"}
                    </span>
                  </div>
                </div>

                {targetIsManageable && (canManageRoles || canManageUsers) ? (
                  <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 lg:grid-cols-2">
                    {canManageRoles ? (
                      <form
                        action={assignRoleAction.bind(null, profile.user_id)}
                        className="grid gap-2"
                      >
                        <label
                          className="text-sm font-medium text-slate-800"
                          htmlFor={`role-${profile.user_id}`}
                        >
                          Papel
                        </label>
                        <select
                          id={`role-${profile.user_id}`}
                          name="roleKey"
                          defaultValue={roleKey ?? "user"}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          {assignableRoles.map(([key]) => (
                            <option key={key} value={key}>
                              {key}
                            </option>
                          ))}
                        </select>
                        <input
                          name="reason"
                          maxLength={240}
                          placeholder="Motivo (opcional)"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                          Salvar papel
                        </button>
                      </form>
                    ) : null}

                    {canManageUsers ? (
                      <form
                        action={setUserActiveAction.bind(null, profile.user_id, !profile.is_active)}
                        className="grid content-start gap-2"
                      >
                        <label
                          className="text-sm font-medium text-slate-800"
                          htmlFor={`status-reason-${profile.user_id}`}
                        >
                          Status da conta
                        </label>
                        <input
                          id={`status-reason-${profile.user_id}`}
                          name="reason"
                          maxLength={240}
                          placeholder="Motivo (opcional)"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                          {profile.is_active ? "Desativar usuário" : "Reativar usuário"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}

                {targetIsManageable && canManagePermissions ? (
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <form
                      action={setPermissionOverrideAction.bind(null, profile.user_id)}
                      className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
                    >
                      <select
                        aria-label="Permissão"
                        name="permissionKey"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {manageablePermissions.map(([key]) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Efeito"
                        name="effect"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="allow">Permitir</option>
                        <option value="deny">Negar</option>
                      </select>
                      <input
                        aria-label="Motivo da exceção"
                        name="reason"
                        maxLength={240}
                        placeholder="Motivo (opcional)"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                        Aplicar exceção
                      </button>
                    </form>

                    {userOverrides.length > 0 ? (
                      <ul className="mt-4 grid gap-2">
                        {userOverrides.map((override) => {
                          if (!isPermissionKey(override.permission_key)) return null;
                          return (
                            <li
                              key={override.permission_key}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                            >
                              <span>
                                <strong>{override.permission_key}</strong>: {override.effect}
                                {override.reason ? ` — ${override.reason}` : ""}
                              </span>
                              <form
                                action={removePermissionOverrideAction.bind(
                                  null,
                                  profile.user_id,
                                  override.permission_key,
                                )}
                              >
                                <input type="hidden" name="reason" value="Remoção pelo painel" />
                                <button className="font-medium text-red-700 hover:text-red-900">
                                  Remover
                                </button>
                              </form>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
