import { getLeadPlusStore, tickLeadPlus } from "../../lib/crm/lead-plus/server/runtime.mjs";
let stopped = false;
let store;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
  });
try {
  while (!stopped) {
    try {
      store ||= getLeadPlusStore();
      await store.health();
      await tickLeadPlus();
    } catch {
      console.error("LEAD+ delivery unavailable; persisted events remain queued.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} finally {
  if (store) await store.close().catch(() => {});
}
