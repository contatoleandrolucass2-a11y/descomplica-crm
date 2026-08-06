import { describe, expect, it } from "vitest";

import {
  DATA_UNAVAILABLE_LABEL,
  GOALS_UNAVAILABLE_LABEL,
  availableCommercialValue,
} from "../lib/crm/source-availability";

describe("commercial source availability", () => {
  it("does not present technical zero as an available commercial value", () => {
    expect(availableCommercialValue(false, 0)).toBeNull();
    expect(availableCommercialValue(true, 0)).toBe(0);
  });

  it("uses explicit neutral interface labels", () => {
    expect(GOALS_UNAVAILABLE_LABEL).toBe("Fonte não configurada");
    expect(DATA_UNAVAILABLE_LABEL).toBe("Dados indisponíveis");
  });
});
