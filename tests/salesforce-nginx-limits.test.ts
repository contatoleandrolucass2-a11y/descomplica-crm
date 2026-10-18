import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Salesforce-only Nginx transport exception", () => {
  for (const host of ["crm", "homolog"] as const) {
    for (const suffix of ["http.conf", "https.conf.example"] as const) {
      it(`keeps ${host} ${suffix} proxy and access policy unchanged outside the exact endpoint`, () => {
        const config = readFileSync(
          new URL(`../deploy/nginx/${host}.descomplicapro.com.br.${suffix}`, import.meta.url),
          "utf8",
        );
        const exact = [...config.matchAll(/location = \/api\/ingest\/salesforce\s*\{([^}]+)\}/g)];
        const defaults = [...config.matchAll(/location \/\s*\{([^}]+)\}/g)];
        expect(exact).toHaveLength(suffix === "http.conf" ? 1 : 2);
        expect(exact).toHaveLength(defaults.length);
        for (const [index, block] of exact.entries()) {
          expect(block[1]).toContain("client_max_body_size 8m;");
          const directives = (value: string) =>
            value
              .trim()
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean);
          expect(directives(block[1]!.replace("client_max_body_size 8m;", ""))).toEqual(
            directives(defaults[index]![1]!),
          );
        }
        const outside = config.replace(/location = \/api\/ingest\/salesforce\s*\{[^}]+\}/g, "");
        expect(outside).not.toContain("client_max_body_size 8m;");
        if (suffix === "https.conf.example") {
          expect(outside).toContain("client_max_body_size 1m;");
          expect(exact[0]![1]).toContain("return 301 https://$host$request_uri;");
          expect(exact[1]![1]).toContain(
            `proxy_pass http://127.0.0.1:${host === "crm" ? 3000 : 3100};`,
          );
        } else {
          expect(exact[0]![1]).toContain("return 503;");
          expect(exact[0]![1]).not.toContain("proxy_pass");
        }
        if (host === "homolog" && suffix === "https.conf.example") {
          expect(outside).toContain('auth_basic "Descomplica CRM - Homologacao";');
          expect(config).not.toContain("auth_basic off;");
          expect(exact[1]![1]).toContain('proxy_set_header Authorization "";');
        }
      });
    }
  }
});
