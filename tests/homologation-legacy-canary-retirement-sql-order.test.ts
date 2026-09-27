import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const migrationPath = path.join(
  repositoryRoot,
  "deploy/homologation/migrations/20260926120000_retire_legacy_simulators_discador_canary.sql",
);

describe("legacy canary retirement SQL ordering", () => {
  it("deletes the dialer child before independent pages and the RESTRICT parent last", async () => {
    const [candidate, pageCatalogFoundation] = await Promise.all([
      readFile(migrationPath, "utf8"),
      readFile(
        path.join(
          repositoryRoot,
          "supabase/migrations/20260804041218_page_catalog_and_crm_permissions.sql",
        ),
        "utf8",
      ),
    ]);
    expect(pageCatalogFoundation).toContain(
      "parent_key      text references public.app_pages(key) on delete restrict",
    );

    const blockStart = candidate.indexOf("do $retire_canary$");
    const blockEnd = candidate.indexOf("$retire_canary$;", blockStart);
    expect(blockStart).toBeGreaterThanOrEqual(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    const mutation = candidate.slice(blockStart, blockEnd);
    const childDelete = mutation.indexOf(
      "where page.key = 'crm.dialer.weekend_forecast'\n    and page.path = '/app/discador/previsao-final-de-semana'",
    );
    const independentDeletes = mutation.indexOf("where (page.key, page.path) in (");
    const parentDelete = mutation.indexOf(
      "where page.key = 'crm.dialer'\n    and page.path = '/app/discador'",
    );

    expect(childDelete).toBeGreaterThanOrEqual(0);
    expect(independentDeletes).toBeGreaterThan(childDelete);
    expect(parentDelete).toBeGreaterThan(independentDeletes);
    expect(mutation).toContain("if v_deleted <> 5 then");
    expect(mutation).toContain(
      "legacy canary retirement did not remove the dialer child page first",
    );
    expect(mutation).toContain(
      "legacy canary retirement did not remove the dialer parent page last",
    );
    expect(mutation).toContain("if v_deleted_total <> 7 then");
  });

  it("keeps the allowlisted candidate hash synchronized with the ordered SQL", async () => {
    const [candidate, manifestContents] = await Promise.all([
      readFile(migrationPath),
      readFile(
        path.join(repositoryRoot, "deploy/homologation/legacy-canary-retirement-allowlist.json"),
        "utf8",
      ),
    ]);
    const manifest = JSON.parse(manifestContents);
    expect(createHash("sha256").update(candidate).digest("hex")).toBe(manifest.candidate.sha256);
  });
});
