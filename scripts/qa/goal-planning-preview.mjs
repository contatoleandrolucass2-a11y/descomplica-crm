import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(root, "test-results/goal-planning-preview");
const goalsPath = "/app/configuracoes/metas";
const fixture = {
  profileKey: "dv",
  effectiveMonth: "2026-10-01",
  opportunities: 108,
  appointments: 12,
  visits: 5,
  folders: 4,
  approvedFolders: 1,
  sales: 1,
  opportunitiesRate: 896,
  appointmentsRate: 242,
  visitsRate: 135,
  foldersRate: 292,
  approvedFoldersRate: 126,
  brokerMinimumMonth1: 4,
  brokerMinimumMonth2: 6,
  brokerMinimumMonth3: 8,
  brokerMinimumMonth4Plus: 10,
  brokerWeeklyAppointments: 6,
  brokerWeeklyVisits: 2,
  brokerWeeklyFolders: 1,
  productiveTeamAppointments: 100,
  productiveTeamVisits: 100,
  productiveTeamFolders: 100,
  productiveTeamSales: 60,
  updatedAt: "2026-10-15T12:00:00Z",
};

/** Reuse only the Latin Geist face from an existing local Next build. */
export async function loadGoalPreviewGeistFont(buildRoot = path.join(root, ".next")) {
  const require = createRequire(import.meta.url);
  const nextRequire = createRequire(require.resolve("next/package.json"));
  const postcss = nextRequire("postcss");
  const chunks = path.join(buildRoot, "static/chunks");
  let cssFiles;
  try {
    cssFiles = (await readdir(chunks)).filter((file) => file.endsWith(".css")).sort();
  } catch {
    throw new Error(
      `Geist preview requires an existing local Next build: CSS chunks missing at ${chunks}. No build or font download is performed.`,
    );
  }
  const assets = new Map();
  const faces = [];
  const sources = [];
  let family;
  for (const filename of cssFiles) {
    const cssPath = path.join(chunks, filename);
    const stylesheet = postcss.parse(await readFile(cssPath, "utf8"), { from: cssPath });
    const candidates = [];
    stylesheet.walkAtRules("font-face", (face) => {
      const declarations = Object.fromEntries(
        face.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value]),
      );
      const candidateFamily = declarations["font-family"]?.replace(/^["']|["']$/g, "");
      if (!/^Geist(?:_[a-z0-9]+)?$/i.test(candidateFamily ?? "")) return;
      const latin = (declarations["unicode-range"] ?? "").split(",").some((range) => {
        const match = /^\s*U\+([0-9a-f?]+)(?:-([0-9a-f]+))?\s*$/i.exec(range);
        if (!match) return false;
        const start = parseInt(match[1].replaceAll("?", "0"), 16);
        const end = parseInt(match[2] ?? match[1].replaceAll("?", "f"), 16);
        return start <= 0x41 && end >= 0x7a;
      });
      if (!latin) return;
      const url =
        /^url\(\s*["']?(\.\.\/media\/[a-z0-9._-]+\.woff2)["']?\s*\)\s*format\(["']woff2["']\)$/i.exec(
          declarations.src ?? "",
        );
      if (!url) throw new Error(`Geist Latin source must be one local WOFF2 file: ${cssPath}`);
      candidates.push({ face, relative: url[1], family: candidateFamily });
    });
    for (const candidate of candidates) {
      assert.ok(
        !family || family === candidate.family,
        "Existing build contains conflicting Geist Latin families",
      );
      family = candidate.family;
      const fontPath = path.resolve(chunks, candidate.relative);
      const mediaRoot = path.resolve(buildRoot, "static/media");
      assert.equal(
        path.dirname(fontPath),
        mediaRoot,
        "Font must stay inside the existing local build media directory",
      );
      let bytes;
      try {
        bytes = await readFile(fontPath);
      } catch {
        throw new Error(
          `Geist preview requires the existing local build font: ${fontPath}. No remote fallback is permitted.`,
        );
      }
      const endpoint = `/qa-fonts/${path.basename(fontPath)}`;
      const face = candidate.face.clone();
      face.walkDecls("src", (declaration) => {
        declaration.value = `url("${endpoint}") format("woff2")`;
      });
      if (!assets.has(endpoint)) {
        assets.set(endpoint, bytes);
        faces.push(face.toString());
        sources.push({
          cssFile: path.relative(root, cssPath),
          fontFile: path.relative(root, fontPath),
          modifiedAt: (await stat(cssPath)).mtime.toISOString(),
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  assert.ok(
    family && faces.length,
    `Geist Latin font-face missing from existing local Next build at ${chunks}. No build or remote font download is performed.`,
  );
  return {
    assets,
    css: `${faces.join("\n")}\n:root,body{--font-geist-sans:"${family}",Arial,sans-serif;}`,
    evidence: {
      origin: "existing local Next build; AST-selected Latin non-Mono face only",
      family,
      sources,
    },
  };
}

export async function readGoalVisualLegibility(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (channels) =>
      channels
        .slice(0, 3)
        .map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        })
        .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    const donuts = [...document.querySelectorAll(".goal-productive-card")].map((card) => {
      const donut = card.querySelector(".goal-donut");
      const value = donut.querySelector("strong");
      const center = getComputedStyle(donut, "::before");
      const text = getComputedStyle(value);
      const background = rgba(center.backgroundColor);
      const foreground = rgba(text.color);
      const blended = foreground
        .slice(0, 3)
        .map(
          (channel, index) =>
            (channel * foreground[3]) / 255 + background[index] * (1 - foreground[3] / 255),
        );
      const backgroundLuminance = luminance(background);
      const textLuminance = luminance(blended);
      const bounds = value.getBoundingClientRect();
      const donutBounds = donut.getBoundingClientRect();
      const diameter = parseFloat(center.width);
      return {
        label: card.querySelector(".goal-productive-label").textContent.trim(),
        text: value.textContent.trim(),
        expectedText: `${card.querySelector(".goal-productive-input input").value}%`,
        centerColor: center.backgroundColor,
        textColor: text.color,
        centerOpaque: background[3] === 255,
        centerLuminance: backgroundLuminance,
        contrast:
          (Math.max(backgroundLuminance, textLuminance) + 0.05) /
          (Math.min(backgroundLuminance, textLuminance) + 0.05),
        visible: value.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        textFitsCenter:
          bounds.width <= diameter + 1 &&
          bounds.height <= diameter + 1 &&
          bounds.left >= donutBounds.left - 1 &&
          bounds.right <= donutBounds.right + 1,
      };
    });
    const channels = [...document.querySelectorAll(".goal-profile-tabs a > span")].map((label) => {
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const bounds = label.getBoundingClientRect();
      return {
        text: label.textContent.trim(),
        visible: label.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        clientWidth: label.clientWidth,
        scrollWidth: label.scrollWidth,
        textWidth: text.width,
        textFits:
          label.scrollWidth <= label.clientWidth + 1 &&
          text.width <= bounds.width + 1 &&
          text.left >= bounds.left - 1 &&
          text.right <= bounds.right + 1,
      };
    });
    const percentageInputs = [
      ...document.querySelectorAll(".goal-rate-input input, .goal-productive-input input"),
    ].map((input) => {
      const style = getComputedStyle(input);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      // Native Chromium number controls reserve space even when arrows appear only on hover.
      // Only an explicit textfield/none appearance proves that the spinner consumes no space.
      const appearance = style.appearance || style.webkitAppearance;
      const spinnerReserve =
        input.type === "number" && !["none", "textfield"].includes(appearance)
          ? Math.max(18, parseFloat(style.fontSize))
          : 0;
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const canvasWidth = context.measureText(input.value).width;
      // A real text probe also preserves tabular numerals and letter spacing, unlike canvas font shorthand.
      const probe = document.createElement("span");
      Object.assign(probe.style, {
        position: "fixed",
        left: "-10000px",
        whiteSpace: "pre",
        visibility: "hidden",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        fontVariantNumeric: style.fontVariantNumeric,
        fontFeatureSettings: style.fontFeatureSettings,
        letterSpacing: style.letterSpacing,
      });
      probe.textContent = input.value;
      document.body.append(probe);
      const textWidth = Math.max(canvasWidth, probe.getBoundingClientRect().width);
      probe.remove();
      const availableWidth = input.clientWidth - padding - spinnerReserve;
      return {
        name: input.name,
        value: input.value,
        appearance,
        font: context.font,
        clientWidth: input.clientWidth,
        padding,
        spinnerReserve,
        textWidth,
        availableWidth,
        visible: input.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        fullValueFits: textWidth <= availableWidth + 0.5,
      };
    });
    const calendarSelects = [...document.querySelectorAll(".goal-calendar-filters select")].map(
      (select) => {
        const style = getComputedStyle(select);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const appearance = style.appearance || style.webkitAppearance;
        const arrowReserve = ["none", "textfield"].includes(appearance) ? 0 : 18;
        const availableWidth = select.clientWidth - padding - arrowReserve;
        const probe = document.createElement("span");
        Object.assign(probe.style, {
          position: "fixed",
          left: "-10000px",
          visibility: "hidden",
          whiteSpace: "pre",
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          fontVariantNumeric: style.fontVariantNumeric,
          fontFeatureSettings: style.fontFeatureSettings,
          letterSpacing: style.letterSpacing,
          textTransform: style.textTransform,
        });
        document.body.append(probe);
        const options = [...select.options].map((option) => {
          probe.textContent = option.label;
          const textWidth = probe.getBoundingClientRect().width;
          return { text: option.label, textWidth, fullTextFits: textWidth <= availableWidth + 0.5 };
        });
        probe.remove();
        return {
          label: select.getAttribute("aria-label"),
          selectedText: select.selectedOptions[0].label,
          visible: select.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
          appearance,
          padding,
          arrowReserve,
          clientWidth: select.clientWidth,
          availableWidth,
          options,
        };
      },
    );
    return { donuts, channels, percentageInputs, calendarSelects };
  });
}

export async function checkGoalFractionalRates(page, profile) {
  const rates = page.locator(".goal-rate-input input");
  const originals = await rates.evaluateAll((inputs) =>
    inputs.map((input) => ({ name: input.name, value: input.value })),
  );
  assert.equal(
    originals.length,
    profile === "dv" ? 5 : 3,
    "Only the visible funnel rates are exercised",
  );
  const originalFunnel = await page.locator(".goal-premium-stage output").allTextContents();
  const counts = await page
    .locator('.goal-studio input[type="number"]')
    .evaluateAll((inputs) =>
      inputs
        .filter((input) => !input.closest(".goal-rate-input"))
        .map((input) => ({ name: input.name, step: input.step })),
    );
  assert.equal(
    counts.length,
    profile === "dv" ? 12 : 10,
    "Existing sales, team and production controls remain present",
  );
  for (const count of counts)
    assert.equal(
      count.step,
      "1",
      `Integer controls retain their native step: ${profile}/${count.name}`,
    );
  const checks = [];
  try {
    for (let index = 0; index < originals.length; index += 1) {
      const input = rates.nth(index);
      for (const fractional of ["1.67", "2.42"]) {
        await input.fill(fractional);
        await expect(input).toHaveValue(fractional);
        const native = await input.evaluate((field) => ({
          name: field.name,
          value: field.value,
          number: field.valueAsNumber,
          step: field.step,
          valid: field.checkValidity(),
          stepMismatch: field.validity.stepMismatch,
        }));
        checks.push(native);
        assert.equal(
          native.value,
          fractional,
          `Fractional rate must not be rounded: ${profile}/${native.name}`,
        );
        assert.equal(
          native.number,
          Number(fractional),
          `Native numeric value must retain the fraction: ${profile}/${native.name}`,
        );
        assert.equal(
          native.stepMismatch,
          false,
          `Fractional rate must not cause stepMismatch: ${profile}/${native.name}=${fractional} step=${native.step}`,
        );
        assert.equal(
          native.valid,
          true,
          `Rate input itself must be natively valid: ${profile}/${native.name}=${fractional}`,
        );
      }
    }
  } finally {
    for (let index = 0; index < originals.length; index += 1) {
      await rates.nth(index).fill(originals[index].value);
      await expect(rates.nth(index)).toHaveValue(originals[index].value);
    }
  }
  await expect(page.locator(".goal-premium-stage output")).toHaveText(originalFunnel);
  return { checks, integerControls: counts, restoredOriginals: originals };
}

/** Keep Next's compiled selectors verbatim, including any minifier defects. */
export async function loadGoalPreviewProductionCss(viteCss) {
  const require = createRequire(import.meta.url);
  const nextRequire = createRequire(require.resolve("next/package.json"));
  const postcss = nextRequire("postcss");
  const sourcePaths = ["GoalPlanning.module.css", "GoalPlanning.tsx"].map((name) =>
    path.join(root, "app/(protected)/app/configuracoes/metas/_components", name),
  );
  const sourceTimes = await Promise.all(sourcePaths.map((file) => stat(file)));
  let buildTime = null;
  try {
    buildTime = (await stat(path.join(root, ".next/BUILD_ID"))).mtime;
  } catch {
    throw new Error(
      "Compiled GoalPlanning preview requires an existing completed local Next build (.next/BUILD_ID). Run pnpm build before visual QA.",
    );
  }
  const stale = !buildTime || sourceTimes.some((source) => source.mtimeMs > buildTime.getTime());
  if (stale)
    throw new Error(
      "Compiled GoalPlanning preview is stale: GoalPlanning CSS/TSX changed after the existing local Next build. Run pnpm build before visual QA; Vite styles cannot substitute production CSS.",
    );
  const chunks = path.join(root, ".next/static/chunks");
  const selected = postcss.root();
  const files = [];
  let nextClass;
  for (const name of (await readdir(chunks)).filter((file) => file.endsWith(".css")).sort()) {
    const filename = path.join(chunks, name);
    const text = await readFile(filename, "utf8");
    const parsed = postcss.parse(text, { from: filename });
    const roots = new Set();
    parsed.walkRules((rule) => {
      for (const match of rule.selector.matchAll(/\.([\w-]*GoalPlanning[\w-]*__planning)\b/g))
        roots.add(match[1]);
    });
    if (!roots.size) continue;
    assert.equal(roots.size, 1, "Compiled GoalPlanning must have one scoped root class");
    const scoped = [...roots][0];
    assert.ok(!nextClass || nextClass === scoped, "Compiled GoalPlanning roots must agree");
    nextClass = scoped;
    const prune = (node) => {
      if (node.type === "rule") return node.selector.includes(`.${scoped}`) ? node.clone() : null;
      if (node.type !== "atrule" && node.type !== "root") return null;
      const children = (node.nodes ?? []).map(prune).filter(Boolean);
      if (!children.length) return null;
      return node.clone({ nodes: children });
    };
    const filtered = prune(parsed);
    selected.append(filtered.nodes);
    files.push({
      file: path.relative(root, filename),
      sha256: createHash("sha256").update(text).digest("hex"),
    });
  }
  assert.ok(
    nextClass && selected.nodes.length,
    "Existing Next build has no scoped GoalPlanning CSS. Run pnpm build before visual QA.",
  );
  const compiledCss = selected.toString();
  const hash = createHash("sha256").update(compiledCss).digest("hex");
  await mkdir(outputRoot, { recursive: true });
  const snapshot = path.join(outputRoot, `compiled-goal-css-${hash}.css`);
  await writeFile(snapshot, compiledCss);
  const parsedVite = postcss.parse(viteCss);
  const viteRoots = new Set();
  parsedVite.walkRules((rule) => {
    for (const match of rule.selector.matchAll(/\.([\w-]+)\s+\.goal-studio\b/g))
      viteRoots.add(match[1]);
  });
  assert.equal(
    viteRoots.size,
    1,
    "Vite GoalPlanning root must be identified before replacing its CSS",
  );
  const viteClass = [...viteRoots][0];
  let removed = 0;
  parsedVite.walkRules((rule) => {
    if (rule.selector.includes(`.${viteClass}`)) {
      rule.remove();
      removed += 1;
    }
  });
  assert.ok(
    removed,
    "Unminified Vite GoalPlanning rules must be removed so they cannot mask production defects",
  );
  selected.walkRules((rule) => {
    rule.selector = rule.selector.replaceAll(`.${nextClass}`, `.${viteClass}`);
  });
  const evidence = {
    origin:
      "existing completed local Next build; only scoped GoalPlanning rules; Vite equivalents removed",
    buildCompletedAt: buildTime?.toISOString() ?? null,
    sourceFiles: sourcePaths.map((file, index) => ({
      file: path.relative(root, file),
      modifiedAt: sourceTimes[index].mtime.toISOString(),
    })),
    stale,
    files,
    nextClass,
    viteClass,
    removedViteRules: removed,
    selectedCssSha256: hash,
    snapshot: path.relative(root, snapshot),
  };
  await writeFile(`${snapshot}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  return { css: `${parsedVite.toString()}\n${selected.toString()}`, evidence };
}

export async function runGoalPlanningPreview() {
  const geist = await loadGoalPreviewGeistFont();
  await mkdir(outputRoot, { recursive: true });
  const evidence = {
    environment:
      "loopback synthetic real GoalPlanning and ProtectedLayout; no auth or remote writes",
    node: process.version,
    today: "2026-10-15",
    passed: false,
    screens: [],
    consoleErrors: [],
    blockedExternalRequests: [],
    unexpectedRequests: [],
    font: geist.evidence,
    presence: "UserPresenceHeartbeat replaced by a synthetic no-op; no presence requests or writes",
  };
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path.join(root, "scripts/qa/goal-planning-memory.tsx").replaceAll("\\", "/");
  const pages = [
    ["crm.dashboard", "/app", "Dashboard", "crm", null],
    ["crm.management", "/app/gestao", "Gestão", "management", null],
    ["crm.settings", "/app/configuracoes", "Configurações", "settings", null],
    ["crm.settings.goals", goalsPath, "Metas do funil", "settings", "crm.settings"],
    [
      "crm.settings.partnerships",
      `${goalsPath}/parcerias`,
      "Parcerias",
      "settings",
      "crm.settings",
    ],
  ].map(([key, route, name, section, parentKey], index) => ({
    key,
    path: route,
    name,
    section,
    parentKey,
    description: "Navegação QA sintética",
    sortOrder: index * 10,
    isNavigation: true,
    isActive: true,
  }));
  const boundaries = new Map([
    ["next/headers", "export async function cookies(){return {get:()=>undefined}}"],
    [
      "@/lib/authorization/enforce",
      "export async function enforceAuthorization(){return {roleKey:'user',permissions:[],level:10}}",
    ],
    [
      "@/lib/authorization/guards",
      "export async function getCurrentUser(){return {email:'goals.qa@nonexistent.invalid',user_metadata:{name:'QA Metas'}}}",
    ],
    ["@/lib/auth/actions/logout", "export const logoutAction='/qa-logout-disabled'"],
    [
      "@/lib/navigation/pages",
      `export async function getAuthorizedNavigation(){return ${JSON.stringify(pages)}} export function getDisabledNavigationItems(){return []}`,
    ],
  ]);
  const virtual = new Map(
    [...boundaries].map(([id, source], i) => [`\0goals-boundary-${i}`, { id, source }]),
  );
  const actionId = "\0goals-safe-action";
  const presenceId = "\0goals-safe-presence";
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
    resolve: {
      alias: [
        ...[...virtual].map(([replacement, { id }]) => ({ find: id, replacement })),
        { find: "@", replacement: root },
      ],
    },
    oxc: { jsx: { runtime: "automatic" } },
    plugins: [
      {
        name: "goal-planning-synthetic-preview",
        enforce: "pre",
        resolveId(id, importer) {
          if (virtual.has(id) || id === actionId || id === presenceId) return id;
          if (
            id === "./_components/UserPresenceHeartbeat" &&
            importer?.replaceAll("\\", "/").endsWith("/app/(protected)/layout.tsx")
          )
            return presenceId;
          if (id === "../actions" && importer?.replaceAll("\\", "/").endsWith("/GoalPlanning.tsx"))
            return actionId;
          if (id.endsWith("goal-planning-memory.tsx")) return entry;
        },
        load(id) {
          if (virtual.has(id)) return virtual.get(id).source;
          if (id === presenceId) return "export function UserPresenceHeartbeat(){return null;}";
          if (id === actionId)
            return "export async function prepareFunnelGoalsDraftAction(){return {status:'error',message:'QA sintético: persistência desabilitada.'}}";
          if (id === entry)
            return `
          import {createRoot} from 'react-dom/client';
          import ProtectedLayout from '@/app/(protected)/layout';
          import {GoalPlanning} from '@/app/(protected)/app/configuracoes/metas/_components/GoalPlanning';
          import {PathnameContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
          import '@/app/globals.css';
          void(async()=>{
            const profile=location.pathname.endsWith('/parcerias')?'partnerships':'dv';
            const empty=new URLSearchParams(location.search).has('empty');
            const values=empty?null:{...${JSON.stringify(fixture)},profileKey:profile};
            const content=<main><GoalPlanning profile={profile} initialValues={values} canManageDraft={!empty} revision={0} today="2026-10-15" /></main>;
            const shell=await ProtectedLayout({children:content});
            createRoot(document.getElementById('root')).render(<PathnameContext.Provider value={location.pathname}>{shell}</PathnameContext.Provider>);
          })();`;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "GoalPlanningQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const stylesheets = [...files.keys()].filter((name) => name.endsWith(".css"));
  const productionStyles = await loadGoalPreviewProductionCss(
    stylesheets.map((name) => String(files.get(name))).join("\n"),
  );
  for (const name of stylesheets) files.delete(name);
  files.set("/goal-preview-production.css", productionStyles.css);
  evidence.productionCss = productionStyles.evidence;
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script);
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Metas QA sintético</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${geist.css}</style>${[
    ...files.keys(),
  ]
    .filter((file) => file.endsWith(".css"))
    .map((file) => `<link rel="stylesheet" href="${file}">`)
    .join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  for (const name of ["descomplica-wordmark-light.svg", "descomplica-wordmark-dark.svg"]) {
    files.set(`/brand/${name}`, await readFile(path.join(root, "public/brand", name)));
  }
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (request.method !== "GET") {
      evidence.unexpectedRequests.push(`${request.method} ${pathname}`);
      response.writeHead(405).end();
    } else if (pathname === "/favicon.ico") response.writeHead(204).end();
    else if (geist.assets.has(pathname))
      response
        .writeHead(200, { "content-type": "font/woff2", "cache-control": "no-store" })
        .end(geist.assets.get(pathname));
    else if (files.has(pathname))
      response
        .writeHead(200, {
          "content-type": pathname.endsWith(".svg")
            ? "image/svg+xml"
            : pathname.endsWith(".css")
              ? "text/css"
              : "text/javascript",
        })
        .end(files.get(pathname));
    else if ([goalsPath, `${goalsPath}/parcerias`].includes(pathname))
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    else {
      evidence.unexpectedRequests.push(pathname);
      response.writeHead(404).end();
    }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    evidence.browser = browser.version();
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.blockedExternalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") evidence.consoleErrors.push(message.text());
    });
    for (const profile of ["dv", "partnerships"]) {
      for (const width of [1440, 1280, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${origin}${goalsPath}${profile === "partnerships" ? "/parcerias" : ""}`);
        await expect(
          page.getByRole("heading", { name: "Planejamento de metas", exact: true }),
        ).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        assert.equal(
          await page.evaluate(
            (family) =>
              document.fonts.check(`16px "${family}"`) &&
              [...document.fonts].some(
                (face) =>
                  face.family.replace(/^["']|["']$/g, "") === family && face.status === "loaded",
              ),
            geist.evidence.family,
          ),
          true,
          "Local Geist font must load before screenshots",
        );
        if (width === 1440 && profile === "dv") {
          const management = page.getByRole("button", { name: "Gestão", exact: true });
          await management.click();
          const meta = page
            .locator('[data-navigation-panel-for="crm.management"] a')
            .filter({ hasText: "Meta" });
          await expect(meta).toBeVisible();
          await expect(meta).toHaveAttribute("href", goalsPath);
          await meta.click();
          await expect(
            page.getByRole("heading", { name: "Planejamento de metas", exact: true }),
          ).toBeVisible();
          evidence.navigation = "Gestão > Meta clicked; authorized fixture route displayed";
        }
        if (profile === "partnerships") {
          await expect(
            page.getByRole("heading", { name: "Imobiliárias por coordenador", exact: true }),
          ).toBeVisible();
          await expect(page.getByText("Meta por tempo de parceria", { exact: true })).toBeVisible();
          await expect(page.getByText("Ritmo de visitas", { exact: true })).toBeVisible();
          await expect(page.locator(".goal-rate-card")).toHaveCount(3);
          await expect(
            page.locator(
              ".goal-broker-production-panel .goal-productivity-fields input:not([type=hidden])",
            ),
          ).toHaveCount(2);
          await expect(page.locator(".goal-productive-card")).toHaveCount(3);
          if (width === 1440) {
            const columns = await page.evaluate(() => {
              const count = (selector) =>
                getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(" ")
                  .length;
              return {
                weekly: count(".goal-broker-production-panel .goal-productivity-fields"),
                productive: count(".goal-productive-grid"),
              };
            });
            assert.deepEqual(
              columns,
              { weekly: 2, productive: 3 },
              "Partnerships must not reserve empty columns",
            );
            evidence.partnershipColumns = columns;
          }
        }
        for (const theme of ["light", "balanced", "dark"]) {
          const labels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
          const desktopTheme = page.getByRole("button", { name: labels[theme], exact: true });
          if (await desktopTheme.isVisible()) {
            await desktopTheme.click();
          } else {
            for (let attempt = 0; attempt < 3; attempt += 1) {
              if ((await page.locator("html").getAttribute("data-theme")) === theme) break;
              await page.locator("[data-theme-cycle-mobile]").click();
            }
          }
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const overflow = await page.evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          const legibility = await readGoalVisualLegibility(page);
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          const screenshot = path.join(
            outputRoot,
            `${profile === "dv" ? "goals" : "partnerships"}-${theme}-${width}.png`,
          );
          await page.screenshot({ path: screenshot, fullPage: true });
          if (profile === "dv" && width === 1440 && theme === "dark") {
            await page.screenshot({
              path: path.join(outputRoot, "goals-dark-desktop.png"),
              fullPage: false,
            });
          }
          evidence.screens.push({
            width,
            profile,
            theme,
            overflow,
            legibility,
            violations: axe.violations.map(({ id, impact, nodes }) => ({
              id,
              impact,
              nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
            })),
            screenshot,
          });
        }
        evidence.fractionalRates ??= [];
        evidence.fractionalRates.push({
          width,
          profile,
          ...(await checkGoalFractionalRates(page, profile)),
        });
        await page
          .getByRole("spinbutton", { name: "Meta mensal de vendas", exact: true })
          .fill("2");
        await expect(page.locator(".goal-premium-stage output").first()).toHaveText(
          profile === "dv" ? "215" : "10",
        );
        evidence.interactions ??= [];
        evidence.interactions.push({
          width,
          profile,
          sales: 2,
          opportunities: await page.locator(".goal-premium-stage output").first().textContent(),
        });
        await page
          .getByRole("combobox", { name: "Selecionar mês", exact: true })
          .selectOption("10");
        await expect(
          page.getByRole("combobox", { name: "Selecionar mês", exact: true }),
        ).toHaveValue("10");
        await expect(page.locator(".goal-calendar-heading")).toContainText(/novembro/i);
      }
    }
    for (const interaction of evidence.interactions)
      assert.equal(
        interaction.opportunities,
        interaction.profile === "dv" ? "215" : "10",
        "Sales=2 projected first-stage volume",
      );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}${goalsPath}?empty=1`);
      await expect(
        page.getByText(
          "Metas ainda não configuradas. Preencha os campos para planejar; nenhum valor demonstrativo foi aplicado.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("spinbutton", { name: "Meta mensal de vendas", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".goal-premium-stage output")).toHaveText([
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
      ]);
      await expect(
        page.getByRole("button", { name: "Salvar rascunho de metas", exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path: path.join(outputRoot, `unconfigured-readonly-${width}.png`),
        fullPage: true,
      });
    }
    evidence.unconfiguredReadOnly =
      "1440/390: no fabricated values; disabled fields; no save button";
    assert.deepEqual(evidence.consoleErrors, [], "Browser errors");
    assert.deepEqual(evidence.unexpectedRequests, [], "Unexpected local requests");
    assert.deepEqual(evidence.blockedExternalRequests, [], "External requests must not be needed");
    for (const screen of evidence.screens) {
      const context = `${screen.profile}/${screen.theme}/${screen.width}`;
      assert.equal(
        screen.legibility.donuts.length,
        screen.profile === "dv" ? 4 : 3,
        `Complete productivity cards: ${context}`,
      );
      for (const donut of screen.legibility.donuts) {
        assert.equal(
          donut.text,
          donut.expectedText,
          `Visible percentage matches its input: ${context}/${donut.label}`,
        );
        assert.ok(
          donut.visible && donut.textFitsCenter && donut.centerOpaque,
          `Donut percentage must fit an opaque center: ${context}/${donut.label}`,
        );
        assert.ok(
          donut.contrast >= 4.5,
          `Donut percentage contrast ${donut.contrast.toFixed(2)} must reach 4.5: ${context}/${donut.label}`,
        );
        if (screen.theme === "dark")
          assert.ok(
            donut.centerLuminance < 0.3,
            `Dark theme donut center must stay dark: ${context}/${donut.label}`,
          );
      }
      assert.deepEqual(
        screen.legibility.channels.map((channel) => channel.text),
        ["Direcional Vendas", "Canal Parcerias", "Meta por pontos"],
        `Complete channel labels: ${context}`,
      );
      for (const channel of screen.legibility.channels)
        assert.ok(
          channel.visible && channel.textFits,
          `Channel label must be visible without ellipsis or clipping: ${context}/${channel.text}`,
        );
      assert.equal(
        screen.legibility.percentageInputs.length,
        screen.profile === "dv" ? 9 : 6,
        `Complete percentage controls: ${context}`,
      );
      for (const input of screen.legibility.percentageInputs) {
        assert.ok(
          input.visible && input.fullValueFits,
          `Full percentage value must fit inside its control: ${context}/${input.name}=${input.value}; text=${input.textWidth.toFixed(2)}px available=${input.availableWidth.toFixed(2)}px padding=${input.padding}px spinner=${input.spinnerReserve}px appearance=${input.appearance}`,
        );
      }
      assert.deepEqual(
        screen.legibility.calendarSelects.map((select) => select.label),
        ["Selecionar mês", "Selecionar ano"],
        `Both calendar controls are present: ${context}`,
      );
      for (const select of screen.legibility.calendarSelects) {
        assert.ok(select.visible, `Calendar select is visible: ${context}/${select.label}`);
        assert.equal(
          select.options.length,
          select.label === "Selecionar mês" ? 12 : 11,
          `Complete calendar options: ${context}/${select.label}`,
        );
        for (const option of select.options)
          assert.ok(
            option.fullTextFits,
            `Complete calendar option must fit selected-text area: ${context}/${select.label}/${option.text}; text=${option.textWidth.toFixed(2)}px available=${select.availableWidth.toFixed(2)}px padding=${select.padding}px nativeArrow=${select.arrowReserve}px`,
          );
      }
      assert.ok(
        screen.overflow.scrollWidth <= screen.overflow.width + 1,
        `Horizontal overflow: ${screen.theme}/${screen.width}`,
      );
      assert.deepEqual(screen.violations, [], `Axe violations: ${screen.theme}/${screen.width}`);
    }
    evidence.passed = true;
  } finally {
    await writeFile(path.join(outputRoot, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  process.stdout.write(
    `${JSON.stringify({ passed: evidence.passed, screens: evidence.screens.length, outputRoot })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runGoalPlanningPreview();
