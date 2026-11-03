import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium } from "@playwright/test";

test(
  "Admin geometry is independent of global/module CSS delivery order",
  { timeout: 120_000 },
  async () => {
    const root = process.cwd();
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const adminPath = "app/(protected)/admin/admin-canvas.css";
    const reference = process.env.ADMIN_CSS_SHEET_REF;
    if (reference && !/^[a-zA-Z0-9_./-]+$/.test(reference))
      throw new Error("Invalid local Git reference.");
    const adminCss = reference
      ? execFileSync("git", ["show", `${reference}:${adminPath}`], { cwd: root, encoding: "utf8" })
      : await readFile(path.join(root, adminPath), "utf8");
    const evidenceRoot = path.join(
      root,
      "test-results/admin-css-order",
      reference ? "reference" : "current",
    );
    await mkdir(evidenceRoot, { recursive: true });
    const entry = path.join(root, "tests/admin-css-order-memory.tsx").replaceAll("\\", "/");
    const built = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
      oxc: { jsx: { runtime: "automatic", development: false } },
      resolve: { alias: { "@": root } },
      plugins: [
        {
          name: "real-admin-css-order",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("admin-css-order-memory.tsx")) return entry;
            if (id === "next/link") return "\0admin-next-link";
          },
          load(id) {
            const normalized = id.replaceAll("\\", "/");
            if (id === "\0admin-next-link")
              return "import {createElement} from 'react';export default function Link({prefetch,...props}){return createElement('a',props);}";
            if (normalized.endsWith("/admin/usuarios/actions.ts"))
              return "const blocked=async()=>{throw new Error('Synthetic QA never executes actions')};export const assignRoleAction=blocked,approveUserAccessAction=blocked,loadUsersPageAction=blocked,setPermissionOverridesBulkAction=blocked,setUserActiveAction=blocked;";
            if (normalized.endsWith("/admin/paginas/actions.ts"))
              return "export const setPageVisibilityAction=async()=>{throw new Error('Synthetic QA never executes actions')};";
            if (normalized.endsWith("/lib/authorization/enforce.ts"))
              return "import {PERMISSIONS} from '@/lib/authorization/permissions';export const enforcePermission=async()=>({roleKey:'master',level:100,permissions:Object.keys(PERMISSIONS)});";
            if (normalized.endsWith("/lib/authorization/guards.ts"))
              return "export const hasPermission=(context,key)=>context.permissions.includes(key);";
            if (normalized.endsWith("/lib/navigation/pages.ts"))
              return "import {PAGE_REGISTRY} from '@/lib/navigation/registry';const pages=PAGE_REGISTRY.filter(p=>p.releaseEnabled).map(p=>({...p,key:p.pageKey,permissionKey:p.permission,isActive:true}));export const getAuthorizedNavigation=async()=>pages;export const getManageablePages=async()=>pages;";
            if (id === entry)
              return `import {renderToStaticMarkup} from 'react-dom/server';
                import {ManagementPage,ManagementPageHeader,ManagementStatusBadge,managementStyles as styles} from '@/app/(protected)/_components/ManagementCanvas';
                import AdminHome from '@/app/(protected)/admin/page';
                import PagesAdmin from '@/app/(protected)/admin/paginas/page';
                import {UserAccessManager} from '@/app/(protected)/admin/usuarios/UserAccessManager';
                import {PERMISSIONS} from '@/lib/authorization/permissions';
                import {ROLE_INHERITED_PERMISSIONS} from '@/lib/authorization/access-presentation';
                import '@/app/globals.css';window.adminQaStyles=styles;
                const permissions=Object.keys(PERMISSIONS);
                const master={userId:'81000000-0000-4000-8000-000000000001',email:'master-sintetico@example.test',isActive:true,accessStatus:'approved',roleKey:'master',isSelf:true,isManageable:false,inheritedPermissions:permissions,overrides:[],permissionDetailsAvailable:true};
                const broker={...master,userId:'81000000-0000-4000-8000-000000000002',email:'corretor-sintetico@example.test',roleKey:'broker_house',isSelf:false,isManageable:true,inheritedPermissions:ROLE_INHERITED_PERMISSIONS.broker_house};
                const props={initialRoleDefaults:ROLE_INHERITED_PERMISSIONS,initialHasMore:false,initialNextOffset:null,initialTotalCount:2,initialSummary:{total:2,active:2,pending:0,revoked:0},assignableRoles:['admin','coordinator','manager_house','manager_imob','broker_house','broker_imob'],manageablePermissions:permissions,canManageRoles:true,canManagePermissions:true,isMasterPermissionManager:true,canManageUsers:true,canApproveUsers:false,reportingScopes:[]};
                window.renderAdminFixture=async(kind)=>renderToStaticMarkup(kind==='home'?await AdminHome():kind==='pages'?await PagesAdmin():<ManagementPage className="admin-canvas admin-users-page"><ManagementPageHeader title="Usuários e acessos" description="Escolha uma pessoa e revise o que ela pode acessar." status={<ManagementStatusBadge>Hierarquia respeitada</ManagementStatusBadge>}/><UserAccessManager {...props} users={kind==='users-editable'?[broker,master]:[master,broker]}/></ManagementPage>);`;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        lib: { entry, name: "AdminCssOrderQa", formats: ["iife"] },
      },
    });
    const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
    const moduleCss = output
      .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
      .map((item) => String(item.source))
      .join("\n");
    const script = output
      .filter((item) => item.type === "chunk")
      .map((item) => item.code)
      .join("\n");
    assert.ok(moduleCss && script, "Real CSS modules must be compiled rather than reconstructed.");
    const evidence = {
      source: reference ?? "working-tree",
      environment:
        "isolated Chromium; real SSR Admin components and CSS; synthetic data/gates; actions never execute; no authentication or backend",
      passed: false,
      checks: [],
      failures: [],
    };
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ reducedMotion: "reduce" });
      await page.route("**/*", (route) => route.abort("blockedbyclient"));
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "balanced", "dark"]) {
          for (const surface of ["home", "users", "users-editable", "pages"]) {
            const readings = [];
            for (const order of ["global-first", "module-first"]) {
              const sheets =
                order === "global-first" ? [adminCss, moduleCss] : [moduleCss, adminCss];
              await page.setContent(
                `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin CSS synthetic QA</title>${sheets.map((css) => `<style>${css}</style>`).join("")}</head><body><div id="root"></div><script>${script}</script></body></html>`,
              );
              await page.evaluate(async (kind) => {
                const s = window.adminQaStyles;
                const root = document.getElementById("root");
                root.innerHTML = await window.renderAdminFixture(kind);
                const mark = (selector, key) => {
                  const element = root.querySelector(selector);
                  if (element) element.setAttribute(key, "");
                };
                mark("main", "data-qa-page");
                mark(".admin-home-card", "data-qa-panel");
                mark(".admin-users-summary", "data-qa-summary");
                mark(".admin-pages-toolbar", "data-qa-toolbar");
                mark(".admin-pages-results", "data-qa-results");
                if (!root.querySelector("." + s.page))
                  throw new Error("Real ManagementPage did not render.");
              }, surface);
              await page.evaluate(() => document.fonts.ready);
              await page
                .locator(
                  "main a[href],main button:not([disabled]),main input:not([disabled]),main select,main summary",
                )
                .first()
                .focus();
              // Read the settled focus state, not one order's first transition
              // frame. Even reduced-motion transitions can last a fraction of a frame.
              await page.evaluate(async () => {
                await new Promise(requestAnimationFrame);
                await Promise.all(
                  document
                    .getAnimations()
                    .filter(
                      (animation) => animation.effect?.getComputedTiming().iterations !== Infinity,
                    )
                    .map((animation) => animation.finished.catch(() => {})),
                );
              });
              const reading = await page.evaluate(() => {
                const inspect = (selector) => {
                  const element = document.querySelector(selector);
                  if (!element) return null;
                  const style = getComputedStyle(element);
                  const box = element.getBoundingClientRect();
                  return {
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    padding: style.padding,
                    margin: style.margin,
                    borderWidth: style.borderWidth,
                    borderStyle: style.borderStyle,
                    borderColor: style.borderColor,
                    borderRadius: style.borderRadius,
                    background: style.backgroundColor,
                    gap: style.gap,
                    flexWrap: style.flexWrap,
                    paddingTop: Number.parseFloat(style.paddingTop),
                    paddingLeft: Number.parseFloat(style.paddingLeft),
                    paddingBottom: Number.parseFloat(style.paddingBottom),
                  };
                };
                return {
                  viewport: innerWidth,
                  scrollWidth: document.documentElement.scrollWidth,
                  page: inspect("[data-qa-page]"),
                  panel: inspect("[data-qa-panel]"),
                  summary: inspect("[data-qa-summary]"),
                  summaryFirstCard: inspect("[data-qa-summary] > article:first-child"),
                  summarySecondCard: inspect("[data-qa-summary] > article:nth-child(2)"),
                  toolbar: inspect("[data-qa-toolbar]"),
                  toolbarRow: inspect("[data-qa-toolbar] > div"),
                  results: inspect("[data-qa-results]"),
                  tableHeader: inspect("[data-qa-results] thead th"),
                  tableRow: inspect("[data-qa-results] tbody tr"),
                  tableCell: inspect("[data-qa-results] tbody td"),
                  tableAction: inspect(".admin-page-action"),
                  tree: [...document.querySelectorAll("main, main *")].map((element, index) => {
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    const properties = [
                      "display",
                      "visibility",
                      "position",
                      "box-sizing",
                      "width",
                      "height",
                      "min-width",
                      "max-width",
                      "gap",
                      "grid-template-columns",
                      "grid-template-rows",
                      "align-items",
                      "justify-content",
                      "flex-wrap",
                      "padding",
                      "margin",
                      "border-width",
                      "border-style",
                      "border-color",
                      "border-radius",
                      "outline-style",
                      "outline-width",
                      "outline-color",
                      "outline-offset",
                      "background-color",
                      "box-shadow",
                      "color",
                      "font-size",
                      "font-weight",
                      "line-height",
                      "overflow-x",
                      "overflow-y",
                    ];
                    return {
                      index,
                      tag: element.tagName,
                      className: element.getAttribute("class"),
                      rect: {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                      },
                      styles: Object.fromEntries(
                        properties.map((key) => [key, style.getPropertyValue(key)]),
                      ),
                    };
                  }),
                };
              });
              readings.push(reading);
              if (order === "global-first")
                await page.screenshot({
                  path: path.join(evidenceRoot, `${surface}-${theme}-${width}.png`),
                  fullPage: true,
                });
            }
            const same = JSON.stringify(readings[0]) === JSON.stringify(readings[1]);
            const treeDeltas = readings[0].tree
              .filter(
                (element, index) =>
                  JSON.stringify(element) !== JSON.stringify(readings[1].tree[index]),
              )
              .slice(0, 30)
              .map((element) => ({ before: element, after: readings[1].tree[element.index] }));
            const noOverflow = readings.every((item) => item.scrollWidth <= item.viewport + 1);
            const expected =
              width === 390
                ? { top: 14.4, left: 12, bottom: 24 }
                : { top: 17.6, left: 28, bottom: 32 };
            const approvedPadding = readings.every(
              (item) =>
                Math.abs(item.page.paddingTop - expected.top) < 0.05 &&
                Math.abs(item.page.paddingLeft - expected.left) < 0.05 &&
                Math.abs(item.page.paddingBottom - expected.bottom) < 0.05,
            );
            const approvedTablePadding =
              surface !== "pages" ||
              width === 390 ||
              readings.every(
                (item) =>
                  Math.abs(item.tableCell.paddingTop - 8.8) < 0.05 &&
                  Math.abs(item.tableCell.paddingBottom - 8.8) < 0.05,
              );
            const approvedSummaryGap =
              !surface.startsWith("users") ||
              readings.every((item) => Math.abs(Number.parseFloat(item.summary.gap) - 10.4) < 0.05);
            evidence.checks.push({
              width,
              theme,
              surface,
              same,
              noOverflow,
              approvedPadding,
              approvedTablePadding,
              approvedSummaryGap,
              readings,
              treeDeltas,
            });
            if (
              !same ||
              !noOverflow ||
              !approvedPadding ||
              !approvedTablePadding ||
              !approvedSummaryGap
            )
              evidence.failures.push({
                width,
                theme,
                surface,
                same,
                noOverflow,
                approvedPadding,
                approvedTablePadding,
                approvedSummaryGap,
              });
          }
        }
      }
      assert.deepEqual(
        evidence.failures,
        [],
        "CSS order must preserve approved Admin geometry, borders and toolbar padding without overflow",
      );
      evidence.passed = true;
    } finally {
      await browser.close();
      await writeFile(path.join(evidenceRoot, "evidence.json"), JSON.stringify(evidence, null, 2));
      console.log(
        JSON.stringify({
          source: evidence.source,
          passed: evidence.passed,
          checks: evidence.checks.length,
          failures: evidence.failures.length,
          evidence: path.join(evidenceRoot, "evidence.json"),
        }),
      );
    }
  },
);
