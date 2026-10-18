import {
  emptyMetaAdsConnectionSnapshot,
  META_ADS_STATUS_PATH,
  metaAdsConnectionSnapshotSchema,
  type MetaAdsConnectionSnapshot,
} from "@/lib/crm/meta-ads/connection-contract";

const POLL_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;

export function startMetaAdsConnectionMonitor({
  configured,
  onSnapshot,
  onChecking,
}: {
  configured: boolean;
  onSnapshot: (snapshot: MetaAdsConnectionSnapshot) => void;
  onChecking: (checking: boolean) => void;
}) {
  let disposed = false;
  let controller: AbortController | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  async function verify(manual = false) {
    if (disposed || controller || document.hidden || (!configured && !manual)) return;
    clearTimeout(pollTimer);
    const request = new AbortController();
    controller = request;
    onChecking(true);
    timeoutTimer = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(META_ADS_STATUS_PATH, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: request.signal,
      });
      if (!response.ok) throw new Error("Status unavailable");
      const snapshot = metaAdsConnectionSnapshotSchema.parse(await response.json());
      if (snapshot.state === "connected" && (!snapshot.checkedAt || !snapshot.receivedAt))
        throw new Error("Missing session evidence");
      if (!disposed && controller === request && !request.signal.aborted) onSnapshot(snapshot);
    } catch {
      if (!disposed && controller === request)
        onSnapshot(emptyMetaAdsConnectionSnapshot("unavailable"));
    } finally {
      if (!disposed && controller === request) {
        clearTimeout(timeoutTimer);
        controller = null;
        onChecking(false);
        if (configured && !document.hidden)
          pollTimer = setTimeout(() => void verify(), POLL_INTERVAL_MS);
      }
    }
  }

  function cancelRequest() {
    const request = controller;
    controller = null;
    clearTimeout(pollTimer);
    clearTimeout(timeoutTimer);
    request?.abort();
  }

  function onVisibilityChange() {
    cancelRequest();
    onChecking(false);
    onSnapshot(emptyMetaAdsConnectionSnapshot(configured ? "waiting" : "unconfigured"));
    if (!document.hidden) void verify();
  }

  // A configuration change starts a new monitor without reusing the previous session evidence.
  onSnapshot(emptyMetaAdsConnectionSnapshot(configured ? "waiting" : "unconfigured"));
  onChecking(false);
  document.addEventListener("visibilitychange", onVisibilityChange);
  void verify();
  return {
    verify: () => void verify(true),
    dispose() {
      disposed = true;
      cancelRequest();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
