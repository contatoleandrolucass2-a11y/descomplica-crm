export const authenticatedVisualRoutes = Object.freeze([
  "/app",
  "/app/etapas/oportunidades",
  "/app/etapas/agendamentos",
  "/app/etapas/visitas",
  "/app/etapas/pastas",
  "/app/etapas/vendas",
  "/app/ranking",
  "/app/canal-de-parcerias",
  "/app/configuracoes",
  "/app/configuracoes/metas",
  "/app/configuracoes/metas/parcerias",
  "/app/configuracoes/metas/pontos",
  "/app/simulacao",
  "/app/simulacao/associativo-fluxo-linear",
  "/app/simulacao/calcular-documentacao",
  "/app/simulacao/caixa",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabelao",
  "/app/simulacao/tabela-investidor",
  "/admin",
  "/admin/usuarios",
  "/admin/paginas",
]);

export function selectVisualRoutes(raw, allRoutes = authenticatedVisualRoutes) {
  if (!raw) return [...allRoutes];

  let requested;
  try {
    requested = JSON.parse(raw);
  } catch {
    throw new Error("QA_VISUAL_ROUTES must be a JSON array of protected routes.");
  }
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new Error("QA_VISUAL_ROUTES must contain at least one protected route.");
  }

  const unique = new Set(requested);
  if (
    unique.size !== requested.length ||
    requested.some((route) => typeof route !== "string" || !allRoutes.includes(route))
  ) {
    throw new Error("QA_VISUAL_ROUTES contains an unknown or duplicate protected route.");
  }
  return allRoutes.filter((route) => unique.has(route));
}
