const numericId = (value) => typeof value === "string" && /^\d{1,64}$/.test(value);
const fail = (message, status = 422) => Object.assign(Error(message), { status });
export function validateCampaignIds(ids) {
  if (
    !Array.isArray(ids) ||
    ids.length > 500 ||
    ids.some((id) => !numericId(id)) ||
    new Set(ids).size !== ids.length
  )
    throw fail("Seleção de campanhas inválida.");
  return [...ids];
}
export async function readCampaignSelection(store) {
  const rows = (await store.listResources("settings")).filter(
    (row) => row.id === "meta-campaign-selection",
  );
  if (!rows.length) return { campaign_ids: [], version: 0 };
  if (rows.length !== 1 || !Number.isSafeInteger(rows[0].version) || rows[0].version < 1)
    throw fail("Configuração de campanhas indisponível.", 503);
  return { campaign_ids: validateCampaignIds(rows[0].campaign_ids), version: rows[0].version };
}
export async function saveCampaignSelection(store, input, catalog) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(",") !== "campaign_ids,version" ||
    !Number.isSafeInteger(input.version) ||
    input.version < 0
  )
    throw fail("Seleção de campanhas inválida.");
  const ids = validateCampaignIds(input.campaign_ids);
  if (!Array.isArray(catalog) || catalog.some((row) => !row || !numericId(row.id)))
    throw fail("Catálogo de campanhas indisponível.", 503);
  const allowed = new Set(catalog.map((row) => row.id));
  if (ids.some((id) => !allowed.has(id))) throw fail("Campanha fora do catálogo autorizado.", 403);
  return store.saveCampaignSelectionCAS(ids, input.version);
}
