import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RoutineSettings } from "@/app/(protected)/app/gestao/rotina/RoutineSettings";

describe("Rotina", () => {
  it("renders every routine option and keeps only regional house populated by default", () => {
    const markup = renderToStaticMarkup(<RoutineSettings />);
    for (const text of [
      "Rotina",
      "Gerente regional house",
      "Gerente regional imob",
      "Gerente house",
      "Coordenador de vendas",
      "Coordenador de parcerias",
      "Corretor",
      "Classificação da semana",
      "Salvar alterações",
      "Inserir linha",
      "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    ])
      expect(markup).toContain(text);
    expect(markup).toContain("Nulo");
  });

  it("keeps editable controls and local save behavior in the client component", () => {
    const source = readFileSync("app/(protected)/app/gestao/rotina/RoutineSettings.tsx", "utf8");
    expect(source).toContain('"use client"');
    expect(source).toContain("window.localStorage.setItem");
    expect(source).toContain("function addRow()");
    expect(source).toContain("<textarea");
  });

  it("guards the page on the server before rendering the routine workspace", () => {
    const source = readFileSync("app/(protected)/app/gestao/rotina/page.tsx", "utf8");
    expect(source).toContain('await enforcePermission("crm.settings.manage")');
    expect(source).toContain('getProtectedPageGate("/app/gestao/rotina")?.releaseEnabled');
    expect(source).toContain("forbidden()");
  });
});
