type SearchableInventoryItem = {
  identifier?: string | null;
  product?: string | null;
  project?: string | null;
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function compactSearchText(value: string) {
  return value.replace(/[\s/\-–—]+/g, "");
}

/** Searches the full loaded inventory without changing rows or their price order. */
export function filterInventoryBySearch<T extends SearchableInventoryItem>(
  inventory: T[],
  query: string,
): T[] {
  const terms = normalizeSearchText(query).split(/\s+/).map(compactSearchText).filter(Boolean);
  if (terms.length === 0) return inventory;

  return inventory.filter((item) => {
    const fields = [item.identifier, item.product, item.project].map((value) =>
      compactSearchText(normalizeSearchText(value ?? "")),
    );
    return terms.every((term) => fields.some((field) => field.includes(term)));
  });
}
