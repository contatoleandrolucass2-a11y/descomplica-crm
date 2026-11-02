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

// The classifier, executor and result gate share this dependency contract. Checks
// outside the capture catalogue remain mandatory in a full run, as before.
const functionalDependencies = Object.freeze({
  keyboard: authenticatedVisualRoutes,
  repasse: ["/app/repasse"],
  marketingResources: ["/app/configuracoes", "/app/configuracoes/recurso-mkt"],
  dashboardRefresh: ["/app"],
  routineSettings: ["/app/gestao", "/app/gestao/rotina"],
  connectedSystems: ["/app/configuracoes", "/app/configuracoes/conectar-sistemas"],
  documentation: ["/app/simulacao/calcular-documentacao"],
  archiveNavigation: [
    "/app/simulacao/associativo-fluxo-linear",
    "/app/simulacao/tabela-direta",
    "/app/simulacao/tabela-investidor",
    "/app/simulacao/tabelao",
  ],
  simulatorValidation: ["/app/simulacao/tabela-investidor"],
  tabelaoValidation: ["/app/simulacao/tabelao"],
  directTableValidation: ["/app/simulacao/tabela-direta"],
  fixtureSourceMarker: ["/app", "/app/etapas/oportunidades"],
});

export function buildVisualCheckPlan(selectedRoutes = authenticatedVisualRoutes) {
  if (
    !Array.isArray(selectedRoutes) ||
    new Set(selectedRoutes).size !== selectedRoutes.length ||
    selectedRoutes.some((route) => !authenticatedVisualRoutes.includes(route))
  ) {
    throw new Error("Invalid routes for the authenticated visual check plan.");
  }
  const routes = authenticatedVisualRoutes.filter((route) => selectedRoutes.includes(route));
  const full = routes.length === authenticatedVisualRoutes.length;
  return {
    contract: "authenticated-visual-checks-v1",
    mode: full ? "full" : routes.length ? "focused" : "none",
    routes,
    checks: Object.entries(functionalDependencies).map(([id, dependencies]) => {
      const affected = dependencies.filter((route) => routes.includes(route));
      return {
        id,
        dependencies: [...dependencies],
        required: full || affected.length > 0,
        reason: full
          ? "full-impact-or-fallback"
          : affected.length
            ? `affected:${affected.join(",")}`
            : "outside-selected-route-dependencies",
      };
    }),
  };
}

export function readVisualCheckPlan(raw, selectedRoutes) {
  const expected = buildVisualCheckPlan(selectedRoutes);
  if (!raw) return expected;
  let received;
  try {
    received = JSON.parse(raw);
  } catch {
    throw new Error("QA_VISUAL_PLAN must be a valid impact plan.");
  }
  if (JSON.stringify(received) !== JSON.stringify(expected)) {
    throw new Error("QA_VISUAL_PLAN disagrees with the current dependency contract or routes.");
  }
  return expected;
}

export function createVisualCheckRunner(plan) {
  const canonical = readVisualCheckPlan(JSON.stringify(plan), plan.routes);
  const results = Object.fromEntries(
    canonical.checks.map(({ id, required, reason, dependencies }) => [
      id,
      {
        status: required ? "failed" : "not_applicable",
        reason: required ? "not-executed" : reason,
        dependencies,
      },
    ]),
  );
  const run = async (id, execute, passed = (result) => result?.passed === true) => {
    const check = canonical.checks.find((entry) => entry.id === id);
    if (!check) throw new Error(`Unknown visual functional check: ${id}`);
    if (!check.required) return null;
    const started = performance.now();
    try {
      const result = await execute();
      results[id] = {
        ...results[id],
        status: passed(result) === true ? "passed" : "failed",
        reason: check.reason,
        durationMs: Math.round(performance.now() - started),
      };
      return result;
    } catch (error) {
      results[id] = { ...results[id], status: "failed", reason: "execution-error" };
      throw error;
    }
  };
  return { results, run };
}

export function visualCheckResultsPassed(plan, results) {
  const canonical = readVisualCheckPlan(JSON.stringify(plan), plan.routes);
  if (!results || Object.keys(results).length !== canonical.checks.length) return false;
  return canonical.checks.every(({ id, required }) => {
    const result = results[id];
    return result?.status === (required ? "passed" : "not_applicable");
  });
}
