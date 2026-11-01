const roles = new Set(["admin", "superintendent", "manager", "broker"]);
const denied = () =>
  Object.assign(Error("Visualização de usuário não permitida."), { status: 403 });
export function canViewMember(actor, target) {
  if (!actor || !target || target.active !== true || !roles.has(target.role)) return false;
  if (actor.id === target.id) return true;
  if (actor.role === "admin") return true;
  if (actor.role === "superintendent") return ["manager", "broker"].includes(target.role);
  return (
    actor.role === "manager" &&
    target.role === "broker" &&
    !!actor.team &&
    target.team === actor.team
  );
}
export function viewableMembers(users, actor) {
  return users
    .filter((user) => canViewMember(actor, user))
    .map(({ id, name, role, team }) => ({ id, name, role, team: team || "" }));
}
export function resolveViewMember(users, actor, targetId) {
  if (!targetId || targetId === actor.id) return actor;
  if (typeof targetId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(targetId)) throw denied();
  const matches = users.filter((user) => user.id === targetId);
  if (matches.length !== 1 || !canViewMember(actor, matches[0])) throw denied();
  return matches[0];
}
