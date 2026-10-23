import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".wrangler/**",
    "supabase/.temp/**",
    "next-env.d.ts",
    "public/descomplica-ads-compact/assets/leaflet/**",
    "public/descomplica-ads-compact/assets/jspdf/**",
  ]),
]);

export default eslintConfig;
