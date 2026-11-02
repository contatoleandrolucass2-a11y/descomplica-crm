import {
  appointmentDetailQueryKey,
  type AppointmentDetailActions,
  type AppointmentDetailRequest,
  type AppointmentDetailResult,
  type AppointmentDetailSource,
} from "./appointments-detail-contract";

/** Client data already authorized for this dashboard/snapshot, never a permission cache. */
export function createAppointmentDetailController(
  actions: AppointmentDetailActions,
  source: AppointmentDetailSource,
) {
  const pages = new Map<string, AppointmentDetailResult>();
  const current = new Map<string, AppointmentDetailResult>([
    [source.initialQueryKey, source.initialPage],
  ]);
  const inFlight = new Map<string, Promise<AppointmentDetailResult>>();
  const intents = new Map<string, number>();
  const listeners = new Set<() => void>();
  const stale: AppointmentDetailResult = { status: "snapshot_changed" };
  let invalidated = false;
  let version = 0;
  let nextIntent = 0;
  const boundedSet = <T>(map: Map<string, T>, key: string, value: T) => {
    map.delete(key);
    map.set(key, value);
    while (map.size > 8) map.delete(map.keys().next().value!);
  };
  const publish = () => {
    version++;
    for (const listener of listeners) listener();
  };
  const invalidate = () => {
    invalidated = true;
    pages.clear();
    current.clear();
    publish();
  };
  const keyFor = (query: string, cursor?: string | null) => `${query}\0${cursor ?? ""}`;
  if (source.initialPage.status === "ready")
    pages.set(keyFor(source.initialQueryKey), source.initialPage);
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
    peek: (queryKey: string): AppointmentDetailResult | null =>
      invalidated ? stale : (current.get(queryKey) ?? null),
    async loadDetails(input: AppointmentDetailRequest): Promise<AppointmentDetailResult> {
      if (invalidated) return stale;
      if (input.snapshot !== source.snapshot) return actions.loadDetails(input);
      const queryKey = appointmentDetailQueryKey(input.query);
      const intent = ++nextIntent;
      boundedSet(intents, queryKey, intent);
      const key = keyFor(queryKey, input.cursor);
      let pending = inFlight.get(key);
      const cached = pages.get(key);
      if (cached) pending = Promise.resolve(cached);
      if (!pending) {
        pending = Promise.resolve()
          .then(() => actions.loadDetails(input))
          .catch((): AppointmentDetailResult => ({ status: "unavailable" }))
          .then((result): AppointmentDetailResult => {
            if (
              result.status === "snapshot_changed" ||
              (result.status === "ready" && result.snapshot !== source.snapshot)
            ) {
              invalidate();
              return stale;
            }
            if (result.status === "ready") boundedSet(pages, key, result);
            return result;
          })
          .finally(() => {
            inFlight.delete(key);
          });
        inFlight.set(key, pending);
      }
      const result = await pending;
      if (intents.get(queryKey) === intent) {
        boundedSet(current, queryKey, result);
        publish();
      }
      return result;
    },
    // Full export always revalidates the server. CSV is never cached here.
    async exportDetails(input: AppointmentDetailRequest) {
      const result = await actions.exportDetails(input);
      if (result.status === "snapshot_changed") invalidate();
      return result;
    },
  };
}
export type AppointmentDetailController = ReturnType<typeof createAppointmentDetailController>;
