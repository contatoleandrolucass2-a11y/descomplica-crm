import { AsyncLocalStorage } from "node:async_hooks";
const requestContext = new AsyncLocalStorage();
export function runLeadRequestAuditContext(actor, viewed, callback) {
  const snapshot = Object.freeze({
    actorId: actor.id,
    authId: actor.auth_id,
    actorName: actor.name,
    viewedId: viewed.id,
    viewedName: viewed.name,
    impersonating: actor.id !== viewed.id,
  });
  return requestContext.run(snapshot, callback);
}
export function leadRequestAuditDetail(detail = {}) {
  const context = requestContext.getStore();
  if (!context) return detail;
  return {
    ...detail,
    auth_user_id: context.authId,
    actor_user_id: context.actorId,
    actor_name: context.actorName,
    viewed_user_id: context.viewedId,
    viewed_user_name: context.viewedName,
    impersonating: context.impersonating,
  };
}
