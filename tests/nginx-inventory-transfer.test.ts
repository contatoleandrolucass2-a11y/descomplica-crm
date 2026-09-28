import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("inventory transfer proxy", () => {
  it("limits JSON compression to the two authorized inventory endpoints", async () => {
    const config = await readFile(
      "deploy/nginx/crm.descomplicapro.com.br.https.conf.example",
      "utf8",
    );
    const blocks = [
      ...config.matchAll(/# BEGIN inventory-transfer\r?\n([\s\S]+?)\s*# END inventory-transfer/gu),
    ];
    expect(blocks).toHaveLength(1);
    const block = blocks[0]![1]!;
    expect(block).toContain("location ~ ^/api/inventory(?:/snapshot)?$");
    expect(block).toContain("gzip_types application/json;");
    expect(block).toContain("gzip_vary on;");
    expect(block).toContain("gzip_min_length 1024;");
    expect(block).toContain("gzip_comp_level 4;");
    expect(block).toContain("proxy_pass http://127.0.0.1:3000;");
    expect(block).toContain("proxy_set_header X-Forwarded-Proto https;");
    expect(block).toContain("proxy_buffering off;");
    expect(block).not.toMatch(/proxy_cache|proxy_hide_header|Authorization|Set-Cookie|allow all/u);
  });

  it("tests transfer integrity and denial with twenty concurrent synthetic requests", async () => {
    const [driver, ci] = await Promise.all([
      readFile("scripts/qa/nginx-inventory-transfer.mjs", "utf8"),
      readFile(".github/workflows/ci.yml", "utf8"),
    ]);
    expect(driver).toContain("Array.from({ length: 20 }");
    expect(driver).toContain("digest(gunzipSync(result.body)), expectedHash");
    expect(driver).toContain("denied.status, 401");
    expect(driver).toContain('hostname: "127.0.0.1"');
    expect(driver).toContain("productionCapacityProven: false");
    expect(ci).toContain("node scripts/qa/nginx-inventory-transfer.mjs");
  });

  it("builds release images outside production without deployment credentials", async () => {
    const ci = await readFile(".github/workflows/ci.yml", "utf8");
    const job = ci.split("  promotable-image:")[1];
    expect(job).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(job).toContain("needs: validate");
    expect(job).toContain("scripts/release/build-promotable-image.mjs");
    expect(job).toContain("scripts/release/prove-promotable-image.mjs");
    expect(job).toContain("sha256sum image.tar.gz > image.sha256");
    expect(job).not.toMatch(
      /secrets\.|ssh |scp |bind-production-image|compose-with-runtime-secret/u,
    );
  });
});
