type PresenceHeartbeatEnvironment = {
  visibility: Pick<Document, "visibilityState"> & EventTarget;
  onlineEvents: EventTarget;
  fetch: typeof fetch;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

export function startUserPresenceHeartbeat(environment: PresenceHeartbeatEnvironment): () => void {
  const fetchPresence = environment.fetch;
  let stopped = false;
  let request: {
    controller: AbortController;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    environment.visibility.removeEventListener("visibilitychange", onActivity);
    environment.onlineEvents.removeEventListener("online", onActivity);
    if (request) {
      clearTimeout(request.timeout);
      request.controller.abort();
      request = null;
    }
  }

  async function heartbeat() {
    if (stopped || request || environment.visibility.visibilityState !== "visible") return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    request = { controller, timeout };
    try {
      const response = await fetchPresence("/api/presence", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      // An expired or forbidden session must not keep polling until this
      // component mounts again with a newly authorized protected shell.
      if (response.status === 401 || response.status === 403) stop();
    } catch {
      // Presence is best effort. Network errors and timeouts retry on the next
      // visible cycle without blocking the page or exposing session details.
    } finally {
      clearTimeout(timeout);
      if (request?.controller === controller) request = null;
    }
  }

  function onActivity() {
    void heartbeat();
  }

  environment.visibility.addEventListener("visibilitychange", onActivity);
  environment.onlineEvents.addEventListener("online", onActivity);
  const interval = setInterval(onActivity, HEARTBEAT_INTERVAL_MS);
  onActivity();
  return stop;
}
