const defaultPortKeys = ["54320", "54321", "54322", "54323", "54324", "54327", "54329", "8083"];

export function patchLocalSupabaseConfig(contents, projectId, ports) {
  const replacements = new Map([
    ["54320", String(ports.shadow)],
    ["54321", String(ports.api)],
    ["54322", String(ports.database)],
    ["54323", String(ports.studio)],
    ["54324", String(ports.mail)],
    ["54327", String(ports.analytics)],
    ["54329", String(ports.pooler)],
    ["8083", String(ports.inspector)],
  ]);
  const projectMatches = contents.match(/^project_id\s*=.*$/gm) ?? [];
  if (projectMatches.length !== 1) {
    throw new Error("Supabase config must contain exactly one active project_id.");
  }

  const occurrences = new Map(defaultPortKeys.map((port) => [port, 0]));
  const portPattern = new RegExp(`\\b(?:${defaultPortKeys.join("|")})\\b`, "g");
  let patched = contents
    .replace(/^project_id\s*=.*$/m, `project_id = "${projectId}"`)
    .replace(portPattern, (current) => {
      occurrences.set(current, (occurrences.get(current) ?? 0) + 1);
      return replacements.get(current);
    });

  for (const [port, count] of occurrences) {
    if (count !== 1) {
      throw new Error(`Supabase config port ${port} must occur exactly once.`);
    }
  }

  const seedPattern = /(\[db\.seed\][\s\S]*?^\s*enabled\s*=\s*)true/m;
  if (!seedPattern.test(patched)) {
    throw new Error("Supabase config must contain one enabled db.seed section.");
  }
  patched = patched.replace(seedPattern, "$1false");
  return patched;
}
