import { describe, expect, it, vi } from "vitest";

import { saoPauloDate } from "@/lib/crm/stages/appointments";

const boundaries = [
  ["2026-11-01T02:59:59.999Z", "2026-10-31"],
  ["2026-11-01T03:00:00.000Z", "2026-11-01"],
  ["2027-01-01T02:59:59.999Z", "2026-12-31"],
  ["2024-03-01T02:59:59.999Z", "2024-02-29"],
] as const;

describe("datas civis de Agendamentos", () => {
  it.each(boundaries)("preserva a data civil de %s", (timestamp, expected) => {
    expect(saoPauloDate(timestamp)).toBe(expected);
  });

  it("reutiliza o formato fixo ao converter datas repetidamente", () => {
    const constructor = vi.spyOn(Intl, "DateTimeFormat");
    try {
      for (let repeat = 0; repeat < 10; repeat += 1) {
        for (const [timestamp, expected] of boundaries) {
          expect(saoPauloDate(timestamp)).toBe(expected);
        }
      }
      expect(constructor).not.toHaveBeenCalled();
    } finally {
      constructor.mockRestore();
    }
  });

  it("mantém a rejeição de timestamp inválido", () => {
    expect(() => saoPauloDate("data inválida")).toThrow(RangeError);
  });
});
