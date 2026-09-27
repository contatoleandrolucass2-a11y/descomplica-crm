type InventorySource = { count: number; items: unknown[] };

type LoadInventoryOptions<T extends InventorySource> = {
  snapshotOnly: boolean;
  signal: AbortSignal;
  canReplace: () => boolean;
  onInventory: (payload: T, reference: T["items"]) => void;
};

export async function loadInvestorInventory<T extends InventorySource>({
  snapshotOnly,
  signal,
  canReplace,
  onInventory,
}: LoadInventoryOptions<T>): Promise<void> {
  let reference: T | null = null;
  let applied = false;

  async function fetchInventory(source: string): Promise<T> {
    const response = await fetch(source, {
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    });
    if (!response.ok) throw new Error("inventory_unavailable");
    const payload = (await response.json()) as T | null;
    if (
      !payload ||
      !Array.isArray(payload.items) ||
      payload.items.length !== Number(payload.count)
    ) {
      throw new Error("inventory_payload_invalid");
    }
    return payload;
  }

  function apply(payload: T) {
    if (signal.aborted || (applied && !canReplace())) return;
    onInventory(payload, reference?.items ?? []);
    applied = true;
  }

  async function loadSnapshot() {
    reference = await fetchInventory("/api/inventory/snapshot");
    apply(reference);
  }

  if (snapshotOnly) {
    await loadSnapshot();
    return;
  }

  const snapshotRequest = loadSnapshot().catch(() => undefined);
  async function loadLive() {
    const live = await fetchInventory("/api/inventory");
    // Fetch concurrently, but keep the commercial enrichment before selection.
    await snapshotRequest;
    apply(live);
  }

  await Promise.allSettled([snapshotRequest, loadLive()]);
  if (!applied && !signal.aborted) throw new Error("inventory_unavailable");
}
