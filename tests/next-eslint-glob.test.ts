import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve("eslint-config-next"));
const pluginRequire = createRequire(configRequire.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js") as {
  getRootDirs: (context: { cwd: string; settings: { next?: { rootDir?: unknown } } }) => string[];
};
const plugin = configRequire("@next/eslint-plugin-next");
const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/$/, "");
let root: string;
let web: string;
let admin: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "crm-eslint-glob-"));
  web = path.join(root, "apps", "web");
  admin = path.join(root, "apps", "admin");
  for (const dir of [web, admin, path.join(root, "apps", ".hidden")]) {
    mkdirSync(path.join(dir, "pages"), { recursive: true });
    writeFileSync(path.join(dir, "pages", "about.tsx"), "export default function About() {}\n");
  }
  writeFileSync(path.join(root, "apps", "not-a-directory.txt"), "fixture\n");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

function roots(pattern: unknown) {
  return getRootDirs({ cwd: root, settings: { next: { rootDir: pattern } } }).sort();
}

describe("Next lint directory discovery without the vulnerable braces dependency", () => {
  it("keeps the context directory when no setting is provided", () => {
    expect(getRootDirs({ cwd: root, settings: {} })).toEqual([root]);
  });

  it("matches a literal directory without expanding its children", () => {
    expect(roots(web)).toEqual([normalize(web)]);
  });

  it("normalizes Windows separators", () => {
    expect(roots(normalize(web).replaceAll("/", "\\"))).toEqual([normalize(web)]);
  });

  it("preserves relative patterns and does not add a trailing separator", () => {
    const relative = normalize(path.relative(process.cwd(), web));
    expect(roots(relative)).toEqual([relative]);
  });

  it("matches glob directories without including files or hidden directories", () => {
    expect(roots(`${normalize(root)}/apps/*`)).toEqual([normalize(admin), normalize(web)]);
  });

  it("preserves brace and nested directory patterns", () => {
    expect(roots(`${normalize(root)}/apps/{web,admin}/pages`)).toEqual(
      [path.join(admin, "pages"), path.join(web, "pages")].map(normalize),
    );
  });

  it("preserves arrays and ignores invalid entries and missing directories", () => {
    expect(roots([web, `${normalize(root)}/missing`, 42, admin])).toEqual(
      [admin, web].map(normalize),
    );
  });

  it("keeps a standalone exclusion from becoming a literal path", () => {
    expect(roots("!apps/*")).toEqual([]);
  });

  it("actually resolves tinyglobby and cannot resolve fast-glob from the patched plugin", () => {
    expect(pluginRequire("tinyglobby/package.json").name).toBe("tinyglobby");
    expect(() => pluginRequire.resolve("fast-glob")).toThrow();
    const lock = readFileSync(path.resolve("pnpm-lock.yaml"), "utf8");
    expect(lock).not.toMatch(/^ {2}'?(?:braces|micromatch|fast-glob)@/m);
  });

  it("still reports the Next navigation violation and accepts next/link", async () => {
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: {
        files: ["**/*.jsx"],
        plugins: { "@next/next": plugin },
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        settings: { next: { rootDir: `${normalize(root)}/apps/*` } },
        rules: { "@next/next/no-html-link-for-pages": "error" },
      },
    });
    const [invalid] = await eslint.lintText('export default () => <a href="/about">About</a>', {
      filePath: "component.jsx",
    });
    expect(invalid?.messages.map((message) => message.ruleId)).toContain(
      "@next/next/no-html-link-for-pages",
    );
    const [valid] = await eslint.lintText(
      'import Link from "next/link"; export default () => <Link href="/about">About</Link>',
      { filePath: "component.jsx" },
    );
    expect(valid?.errorCount).toBe(0);
  });
});
