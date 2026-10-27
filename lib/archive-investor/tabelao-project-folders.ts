// Pastas conferidas em 27/10/2026 na pasta compartilhada informada pelo usuário:
// https://drive.google.com/drive/folders/1_rVgsDhMv5vtDzmBvRosQBAaPDtgLO8J
const projectFolders = new Map([
  ["conquista clube sao miguel", "1gtBnmi2fHlPboFehp-McUIFE3wVAZDEp"],
  ["prizma", "1atqn60Vok8yFHoPcSf5qVgeaBLhasxSY"],
  ["mirante jardim das esmeraldas", "1uyq5EiKoFNRe8PxYF-QvP64_yY5xAYI-"],
  ["terrasse vila ema", "1kx1bWdwqDVShpeEurtnvgCUeDtdSlp_F"],
  ["alto liviero condominio clube", "1WpZpdHKkbSDxVpEJ1zcbnCVFsLvKtMI3"],
  ["raiz home clube", "1NDF_tf1llswJ1QzqtyFi27h2TSeuFZez"],
  ["conquista clube butanta", "1lP5ya1-Ed9-FuBP_4KDIWH0cc3qpgii9"],
  ["conquista clube itaim paulista", "1B9AmelZFegfRuJjmEcQBcnKaTJPCyD36"],
  ["conquista clube sacoma", "1ZH6XVzSreLvVH9tkNJSIOZuNzoAuaPir"],
]);

export function resolveTabelaoProjectFolder(project: string | null | undefined): string | null {
  const key = (project ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(?:direcional|riva)\s+/, "");
  const folderId = projectFolders.get(key);
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;
}
