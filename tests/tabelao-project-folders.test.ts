import { describe, expect, it } from "vitest";
import { resolveTabelaoProjectFolder } from "@/lib/archive-investor/tabelao-project-folders";

describe("pastas dos empreendimentos no Tabelão", () => {
  it.each([
    ["Direcional Conquista Clube Itaim Paulista", "1B9AmelZFegfRuJjmEcQBcnKaTJPCyD36"],
    ["Direcional Conquista Clube São Miguel", "1gtBnmi2fHlPboFehp-McUIFE3wVAZDEp"],
    ["Alto Liviero Condomínio Clube", "1WpZpdHKkbSDxVpEJ1zcbnCVFsLvKtMI3"],
    ["Direcional Conquista Clube Sacomã", "1ZH6XVzSreLvVH9tkNJSIOZuNzoAuaPir"],
    ["Raiz Home Clube", "1NDF_tf1llswJ1QzqtyFi27h2TSeuFZez"],
    ["Conquista Clube Butantã", "1lP5ya1-Ed9-FuBP_4KDIWH0cc3qpgii9"],
    ["Riva Prizma", "1atqn60Vok8yFHoPcSf5qVgeaBLhasxSY"],
    ["Mirante Jardim das Esmeraldas", "1uyq5EiKoFNRe8PxYF-QvP64_yY5xAYI-"],
    ["Terrasse Vila Ema", "1kx1bWdwqDVShpeEurtnvgCUeDtdSlp_F"],
  ])("associa %s à pasta conferida", (project, folderId) => {
    expect(resolveTabelaoProjectFolder(project)).toBe(
      `https://drive.google.com/drive/folders/${folderId}`,
    );
  });

  it("aceita variações de caixa, acentos compostos e espaços sem mudar o destino", () => {
    expect(resolveTabelaoProjectFolder("  DIRECIONAL   CONQUISTA CLUBE SA\u0303O MIGUEL  ")).toBe(
      resolveTabelaoProjectFolder("Conquista Clube São Miguel"),
    );
  });

  it.each([
    null,
    undefined,
    "",
    "Não informado",
    "Conquista Clube",
    "Prizma II",
    "Raiz Home Clube Fase 2",
    "Outro empreendimento",
  ])("não associa nome ausente, parcial ou diferente: %s", (project) =>
    expect(resolveTabelaoProjectFolder(project)).toBeNull(),
  );
});
