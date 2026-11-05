import {
  appointmentDetailQueryKey,
  isAppointmentWithoutConfirmedVisit,
  isCompleteAppointmentDetailPage,
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
  const keyFor = (query: string, cursor?: string | null, all = false) =>
    `${query}\0${all ? "all" : "page"}\0${cursor ?? ""}`;
  if (source.initialPage.status === "ready") {
    pages.set(keyFor(source.initialQueryKey), source.initialPage);
    if (isCompleteAppointmentDetailPage(source.initialPage))
      pages.set(keyFor(source.initialQueryKey, null, true), source.initialPage);
  }
  const loadDetails = async (input: AppointmentDetailRequest): Promise<AppointmentDetailResult> => {
    if (invalidated) return stale;
    if (input.snapshot !== source.snapshot) return actions.loadDetails(input);
    const queryKey = appointmentDetailQueryKey(input.query);
    const intent = ++nextIntent;
    boundedSet(intents, queryKey, intent);
    const key = keyFor(queryKey, input.cursor, input.all);
    let pending = inFlight.get(key);
    let cached = pages.get(key);
    if (!cached && input.all && input.query.subset === "without_visit") {
      // A complete authorized result may be reused for its own subset. Never
      // filter a paginated bootstrap, different filters, or another generation.
      const baseQueryKey = appointmentDetailQueryKey({ ...input.query, subset: undefined });
      const base = pages.get(keyFor(baseQueryKey, null, true));
      if (base && isCompleteAppointmentDetailPage(base) && base.snapshot === source.snapshot) {
        const rows = base.rows!.filter(isAppointmentWithoutConfirmedVisit);
        cached = { ...base, rows, total: rows.length };
        boundedSet(pages, key, cached);
      }
    }
    if (cached) pending = Promise.resolve(cached);
    if (!pending) {
      pending = Promise.resolve()
        .then(() => actions.loadDetails(input))
        .catch((): AppointmentDetailResult => ({ status: "unavailable" }))
        .then((result): AppointmentDetailResult => {
          if (
            invalidated ||
            result.status === "snapshot_changed" ||
            (result.status === "ready" && result.snapshot !== source.snapshot)
          ) {
            if (!invalidated) invalidate();
            return stale;
          }
          if (input.all && result.status === "ready" && !isCompleteAppointmentDetailPage(result))
            return { status: "unavailable" };
          if (result.status === "ready") boundedSet(pages, key, result);
          return result;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, pending);
    }
    const result = await pending;
    if (invalidated) return stale;
    if (intents.get(queryKey) === intent) {
      boundedSet(current, queryKey, result);
      publish();
    }
    return result;
  };
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
    loadDetails,
    loadAllDetails(input: Omit<AppointmentDetailRequest, "all" | "cursor">) {
      return loadDetails({ ...input, cursor: null, all: true });
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
