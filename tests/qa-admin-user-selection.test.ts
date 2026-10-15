import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Page } from "@playwright/test";
import sharp from "sharp";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/qa/authenticated-visual.mjs", "utf8");
const parsed = ts.createSourceFile(
  "qa.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);

function readQaFunction(name: string, dependencies: Record<string, unknown> = {}) {
  const declaration = parsed.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  if (!declaration) throw new Error(`Missing QA function: ${name}`);
  // Exercise the real helper without starting the authenticated operational harness.
  return new Function(
    ...Object.keys(dependencies),
    `${declaration.getText(parsed)}; return ${name};`,
  )(...Object.values(dependencies));
}

describe("Authenticated admin visual selection", () => {
  it("wires the login email in all four matrices and selects before measuring", () => {
    const calls: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(parsed) === "inspectRoute") {
        calls.push(node);
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      const options = call.arguments[6];
      if (!options) throw new Error("inspectRoute requires authenticated identity options");
      expect(options.getText(parsed)).toContain("expectedAccountEmail: email");
      expect(options.getText(parsed)).toContain("expectedAccountFirstName");
    }
    const inspect = readQaFunction("inspectRoute").toString();
    expect(inspect).toContain('if (route === "/admin/usuarios")');
    expect(inspect).toContain("await selectAuthenticatedAdminUser(page, expectedAccountEmail)");
    expect(inspect.indexOf("await selectAuthenticatedAdminUser")).toBeLessThan(
      inspect.indexOf("const snapshot ="),
    );
    expect(source).toContain('["/admin/usuarios", 1650]');
    expect(inspect).toContain("await page.evaluate(inspectAdminUserAccessWorkspace)");
    expect(inspect).toContain("snapshot.userAccessWorkspaceReady &&");
  });

  it("fails closed without the authenticated identity", async () => {
    await expect(readQaFunction("selectAuthenticatedAdminUser")({}, undefined)).rejects.toThrow(
      "requires the authenticated account email",
    );
  });

  it.runIf(process.env.ADMIN_USER_SELECTION_BROWSER === "1")(
    "selects self in the real component regardless of order, preserving the volatile-list capture",
    async () => {
      const require = createRequire(import.meta.url);
      const vitestRequire = createRequire(require.resolve("vitest/package.json"));
      const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
      const root = path.resolve(".");
      const entry = path.resolve("tests/admin-user-selection-memory.tsx").replaceAll("\\", "/");
      const built = await build({
        root,
        configFile: false,
        envFile: false,
        logLevel: "error",
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        resolve: { alias: { "@": root } },
        oxc: { jsx: { runtime: "automatic", development: false } },
        plugins: [
          {
            name: "admin-user-selection-fixture",
            enforce: "pre",
            resolveId(id: string, importer?: string) {
              if (id.endsWith("admin-user-selection-memory.tsx")) return entry;
              if (id === "./actions" && importer?.endsWith("UserAccessManager.tsx")) {
                return "\0qa-admin-actions";
              }
            },
            load(id: string) {
              if (id === "\0qa-admin-actions")
                return `
              const unexpected = () => { throw new Error("Unexpected server action in visual selection"); };
              export const assignRoleAction = unexpected, approveUserAccessAction = unexpected,
                setPermissionOverridesBulkAction = unexpected, setUserActiveAction = unexpected;
              export async function loadUsersPageAction(input) {
                window.qaPageRequests.push(input);
                await new Promise((resolve) => setTimeout(resolve, 20));
                const users = window.qaAllUsers.slice(input.offset, input.offset + 6);
                const next = input.offset + users.length;
                return { status: "success", page: { users, hasMore: next < window.qaAllUsers.length,
                  nextOffset: next < window.qaAllUsers.length ? next : null,
                  totalCount: window.qaAllUsers.length, onboardingFoundationAvailable: true, summary: null,
                  roleDefaults: window.qaRoleDefaults } };
              }
            `;
              if (id === entry)
                return `
              import { createElement } from "react";
              import { createRoot } from "react-dom/client";
              import "@/app/globals.css";
              import "@/app/(protected)/admin/admin-canvas.css";
              import { PERMISSIONS } from "@/lib/authorization/permissions";
              import { ROLE_INHERITED_PERMISSIONS } from "@/lib/authorization/access-presentation";
              import { ManagementPage } from "@/app/(protected)/_components/ManagementCanvas";
              import { UserAccessManager } from "@/app/(protected)/admin/usuarios/UserAccessManager";
              window.qaRoleDefaults = ROLE_INHERITED_PERMISSIONS;
              createRoot(document.getElementById("root")).render(createElement(ManagementPage,
                { className: "admin-canvas admin-users-page" }, createElement(UserAccessManager, {
                users: window.qaUsers, initialRoleDefaults: ROLE_INHERITED_PERMISSIONS, initialHasMore: window.qaUsers.length < window.qaAllUsers.length,
                initialNextOffset: window.qaUsers.length < window.qaAllUsers.length ? window.qaUsers.length : null,
                initialTotalCount: window.qaAllUsers.length,
                initialSummary: { total: window.qaAllUsers.length, active: window.qaAllUsers.length, pending: 0, revoked: 0 },
                assignableRoles: ["broker_house"],
                manageablePermissions: Object.keys(PERMISSIONS), canManageRoles: true,
                canManagePermissions: true, isMasterPermissionManager: true,
                canManageUsers: true, canApproveUsers: true, reportingScopes: [],
              })));
            `;
            },
          },
        ],
        build: {
          write: false,
          minify: false,
          cssMinify: true,
          lib: { entry, name: "AdminUserSelectionQa", formats: ["iife"] },
        },
      });
      type BundleFile =
        | { type: "chunk"; code: string }
        | { type: "asset"; fileName: string; source: string | Uint8Array };
      const outputs = (Array.isArray(built) ? built : [built]) as Array<{ output: BundleFile[] }>;
      const files = outputs.flatMap((output) => output.output);
      const script = files.flatMap((file) => (file.type === "chunk" ? [file.code] : [])).join("\n");
      const css = files
        .flatMap((file) =>
          file.type === "asset" && file.fileName.endsWith(".css") ? [String(file.source)] : [],
        )
        .join("\n");
      const selectSelf = readQaFunction("selectAuthenticatedAdminUser", { expect: browserExpect });
      const inspectWorkspace = readQaFunction("inspectAdminUserAccessWorkspace") as () => {
        userAccessWorkspaceReady: boolean;
      };
      const capture = readQaFunction("captureComparableScreenshot", {
        archiveSimulatorRoutes: new Set(),
        qaNavigationTimeout: 5_000,
      }) as (page: Page) => Promise<Buffer>;
      const editor = {
        userId: "editor",
        email: "qa.editor@local.invalid",
        isActive: true,
        accessStatus: "approved",
        roleKey: "master",
        isSelf: true,
        isManageable: false,
        inheritedPermissions: ["pages.view"],
        overrides: [],
        permissionDetailsAvailable: true,
      };
      const reader = {
        ...editor,
        userId: "reader",
        email: "qa.editor-reader@local.invalid",
        roleKey: "broker_house",
        isSelf: false,
        isManageable: true,
      };
      const browser = await chromium.launch({ headless: true });
      try {
        for (const width of [1440, 390]) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("**/*", (route) => route.abort());
          const open = async (users: (typeof editor)[], allUsers = users) => {
            await page.goto("about:blank");
            await page.setContent(
              '<html lang="pt-BR" data-theme="light"><body><main id="root"></main></body></html>',
            );
            await page.addStyleTag({ content: css });
            await page.evaluate(
              ({ users, allUsers }) => {
                const fixture = window as unknown as {
                  qaUsers: typeof users;
                  qaAllUsers: typeof users;
                  qaPageRequests: unknown[];
                };
                fixture.qaUsers = users;
                fixture.qaAllUsers = allUsers;
                fixture.qaPageRequests = [];
              },
              { users, allUsers },
            );
            await page.addScriptTag({ content: script });
            await browserExpect(page.locator("#selected-user-panel")).toBeVisible();
          };
          const dimensions = async () => {
            const metadata = await sharp(await capture(page)).metadata();
            return { width: metadata.width, height: metadata.height };
          };
          await open([editor]);
          expect(await page.evaluate(inspectWorkspace)).toEqual({ userAccessWorkspaceReady: true });
          if (width === 1440) {
            const tabs = page.locator(".admin-permission-tabs");
            await tabs.evaluate((element) => element.setAttribute("role", "group"));
            expect(await page.evaluate(inspectWorkspace)).toEqual({
              userAccessWorkspaceReady: false,
            });
            await tabs.evaluate((element) => element.setAttribute("role", "tablist"));
            const hiddenPanel = page.locator(".admin-permission-panel[hidden]").first();
            const hiddenPanelId = await hiddenPanel.getAttribute("id");
            await hiddenPanel.evaluate((element) => element.removeAttribute("hidden"));
            expect(await page.evaluate(inspectWorkspace)).toEqual({
              userAccessWorkspaceReady: false,
            });
            await page
              .locator(`[id="${hiddenPanelId}"]`)
              .evaluate((element) => element.setAttribute("hidden", ""));
            const grid = page.locator(
              ".admin-permission-panel:not([hidden]) .admin-permission-grid",
            );
            await grid.evaluate((element) => {
              (element as HTMLElement).style.gridTemplateColumns = "1fr 1fr";
            });
            expect(await page.evaluate(inspectWorkspace)).toEqual({
              userAccessWorkspaceReady: false,
            });
            await grid.evaluate((element) => element.removeAttribute("style"));
            const panel = page.locator(".admin-permission-panel:not([hidden])");
            await panel.evaluate((element) => {
              (element as HTMLElement).style.maxHeight = "40px";
            });
            expect(await page.evaluate(inspectWorkspace)).toEqual({
              userAccessWorkspaceReady: false,
            });
            await panel.evaluate((element) => element.removeAttribute("style"));
            expect(await page.evaluate(inspectWorkspace)).toEqual({
              userAccessWorkspaceReady: true,
            });
          }
          const selfOnly = await dimensions();
          for (const users of [
            [reader, editor],
            [editor, reader],
          ]) {
            await open(users);
            if (users[0] === reader) {
              await browserExpect(
                page.getByRole("button", { name: "Salvar papel", exact: true }),
              ).toBeVisible();
            }
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await selectSelf(page, editor.email);
            expect(await page.evaluate(() => window.scrollY)).toBe(0);
            await browserExpect(
              page.getByRole("button", { name: "Salvar papel", exact: true }),
            ).toHaveCount(0);
            await browserExpect(page.locator("#user-search")).toHaveValue("");
            const list = page.locator('[data-qa-visual-volatile="user-results"]');
            await browserExpect(list.getByRole("button")).toHaveCount(2);
            expect(await dimensions()).toEqual(selfOnly);
            await browserExpect(list).toBeVisible();
            await browserExpect(list.getByRole("button")).toHaveCount(2);
            expect(await page.locator("[data-qa-visual-hidden]").count()).toBe(0);
          }
          const pagedReaders = Array.from({ length: 6 }, (_, index) => ({
            ...reader,
            userId: `reader-${index}`,
            email: `qa.reader-${index}@local.invalid`,
          }));
          await open(pagedReaders, [...pagedReaders, editor]);
          await selectSelf(page, editor.email);
          await browserExpect(
            page.locator("#selected-user-panel").getByText("Conta atual", { exact: true }),
          ).toBeVisible();
          await browserExpect(page.locator("#user-search")).toHaveValue("");
          await browserExpect(
            page.getByRole("list", { name: "Resultados de usuários" }).getByRole("button"),
          ).toHaveCount(7);
          expect(
            await page.evaluate(
              () => (window as unknown as { qaPageRequests: unknown[] }).qaPageRequests,
            ),
          ).toContainEqual({ offset: 6, search: "", status: "all" });
          expect(errors).toEqual([]);
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
