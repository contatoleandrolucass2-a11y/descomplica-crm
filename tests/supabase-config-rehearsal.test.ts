import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { patchLocalSupabaseConfig } from "../scripts/release/supabase-config.mjs";

const ports = {
  shadow: 54327,
  api: 60001,
  database: 60002,
  studio: 60003,
  mail: 60004,
  analytics: 60005,
  pooler: 60006,
  inspector: 60007,
};

describe("local Supabase rehearsal config", () => {
  it("patches original ports in one pass when a generated port equals another default", async () => {
    const source = await readFile(path.join(process.cwd(), "supabase/config.toml"), "utf8");

    const patched = patchLocalSupabaseConfig(source, "restore-collision-test", ports);

    expect(patched).toContain('project_id = "restore-collision-test"');
    expect(patched).toContain("shadow_port = 54327");
    expect(patched).toContain("port = 60005");
    expect(patched).not.toContain("shadow_port = 60005");
    expect(patched).toMatch(/\[db\.seed\][\s\S]*?enabled = false/);
  });

  it("rejects a missing or duplicated original default port", async () => {
    const source = await readFile(path.join(process.cwd(), "supabase/config.toml"), "utf8");

    expect(() =>
      patchLocalSupabaseConfig(source.replace("port = 54327", "port = 54328"), "missing", ports),
    ).toThrow("Supabase config port 54327 must occur exactly once.");
    expect(() =>
      patchLocalSupabaseConfig(`${source}\n# duplicate 54327\n`, "duplicate", ports),
    ).toThrow("Supabase config port 54327 must occur exactly once.");
  });
});
