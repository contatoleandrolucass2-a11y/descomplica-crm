import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { checkProtectedTopbar } from "../scripts/qa/associative-compact-layout.mjs";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { AccountMenu } from "../app/(protected)/_components/AccountMenu";
import { AuthorizedNavigation } from "../app/(protected)/_components/AuthorizedNavigation";
import { DescomplicaBrandMark } from "../app/(protected)/_components/DescomplicaBrandMark";
import { ThemeSwitch } from "../app/(protected)/_components/ThemeSwitch";
import styles from "../app/(protected)/_components/ProtectedShell.module.css";

const require = createRequire(import.meta.url);
const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
  parse: (source: string) => {
    walkRules: (callback: (rule: { selector: string }) => void) => void;
    toString: () => string;
  };
};

const stylesheet = parse(
  readFileSync(
    new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
    "utf8",
  ),
);
stylesheet.walkRules((rule) => {
  rule.selector = rule.selector
    .replace(/:global\(([^)]+)\)/g, "$1")
    .replace(/\.([a-zA-Z][\w-]*)/g, (_, name: string) => `.${styles[name]}`);
});

const roots = [
  ["crm.dashboard", "/app", "Dashboard"],
  ["crm.simulation", "/app/simulacao", "Simulacao"],
  ["crm.ranking", "/app/ranking", "Ranking"],
  ["crm.partnerships", "/app/canal-de-parcerias", "Canal de Parcerias"],
  ["crm.settings", "/app/configuracoes", "Configuracoes"],
].map(([key, path, name], sortOrder) => ({
  key: key!,
  path: path!,
  name: name!,
  description: "Navegacao sintetica",
  section: "crm",
  parentKey: null,
  sortOrder,
}));
const pages = [
  ...roots,
  {
    ...roots[0]!,
    key: "crm.repasse",
    path: "/app/repasse",
    name: "Repasse",
    parentKey: "crm.dashboard",
    sortOrder: 60,
  },
  ...roots
    .filter((page) => ["crm.dashboard", "crm.simulation", "crm.settings"].includes(page.key))
    .map((page) => ({
      ...page,
      key: `${page.key}.fixture`,
      path: `${page.path}/fixture`,
      name: "Pagina sintetica",
      parentKey: page.key,
    })),
];

function fixture(displayName: string) {
  return renderToStaticMarkup(
    <header className={styles.topbar} data-protected-topbar>
      <div className={styles.topbarInner}>
        <a className={styles.brand} href="/app">
          <DescomplicaBrandMark className={styles.brandMark} />
          <span className={styles.brandName}>escomplica</span>
        </a>
        <AuthorizedNavigation pages={pages} />
        <ThemeSwitch canPersist={false} />
        <div className={styles.actions}>
          <AccountMenu
            identity="qa.account@example.invalid"
            displayName={displayName}
            role="Corretor"
          >
            <a className={styles.accountLink} href="/conta/seguranca">
              Seguranca
            </a>
          </AccountMenu>
        </div>
      </div>
    </header>,
  );
}

function pointerTargetsReachable(header: HTMLElement) {
  const controls = header.querySelectorAll<HTMLElement>(
    '[data-navigation-root-control], [aria-label="Aparência da página"] button, [aria-controls="protected-account-menu"]',
  );
  return Array.from(controls).every((control) => {
    const box = control.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === control || (hit !== null && control.contains(hit));
  });
}

describe("account menu responsive layout", () => {
  // Browser fixtures are opt-in because the unit CI job has no Chromium installation.
  it.runIf(process.env.ACCOUNT_MENU_BROWSER === "1")(
    "keeps compact account identity without overlapping navigation or themes",
    async () => {
      const browser = await chromium.launch({ headless: true });
      const output = "test-results/account-menu";
      mkdirSync(output, { recursive: true });
      let cases = 0;
      try {
        const page = await browser.newPage();
        for (const width of [320, 375, 600, 760, 768, 1180, 1181, 1280, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          for (const theme of ["light", "balanced", "dark"]) {
            for (const displayName of [
              "Mariana Silva",
              "AlexandrianaMaximilianaConstantina Silva",
            ]) {
              await page.setContent(
                `<html data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}${stylesheet.toString()}</style></head><body>${fixture(displayName)}<main>Conteudo sintetico</main></body></html>`,
              );
              const geometry = await page.evaluate(
                (classes) => {
                  const label = document.querySelector<HTMLElement>(
                    "[data-session-identity-trigger-label]",
                  )!;
                  const trigger = label.closest("button")!;
                  const avatar = trigger.querySelector<HTMLElement>("[data-session-avatar]")!;
                  const labelBox = label.getBoundingClientRect();
                  const triggerBox = trigger.getBoundingClientRect();
                  const labelStyle = getComputedStyle(label);
                  const themeButtons = Array.from(
                    document.querySelectorAll<HTMLButtonElement>(
                      '[role="group"][aria-label="Aparência da página"] button',
                    ),
                  );
                  const visibleThemeButtons = themeButtons.filter(
                    (button) => button.getClientRects().length > 0,
                  );
                  const controls = Array.from(
                    document.querySelectorAll<HTMLElement>(
                      `.${classes.brandName}, .${classes.brandMark}, .${classes.topbar} button, .${classes.topbar} [data-navigation-root-control]`,
                    ),
                  ).filter((element) => element.getBoundingClientRect().width > 0);
                  const collisions: string[] = [];
                  for (let i = 0; i < controls.length; i++) {
                    for (let j = i + 1; j < controls.length; j++) {
                      const brandLink = controls[i]!.closest("a");
                      if (brandLink && brandLink === controls[j]!.closest("a")) continue;
                      const a = controls[i]!.getBoundingClientRect();
                      const b = controls[j]!.getBoundingClientRect();
                      if (
                        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
                      ) {
                        collisions.push(
                          `${controls[i]!.textContent} / ${controls[j]!.textContent}`,
                        );
                      }
                    }
                  }
                  return {
                    text: label.textContent,
                    display: labelStyle.display,
                    position: labelStyle.position,
                    overflow: labelStyle.overflow,
                    labelWidth: labelBox.width,
                    labelHeight: labelBox.height,
                    avatarVisible:
                      avatar.getBoundingClientRect().width > 0 &&
                      avatar.getBoundingClientRect().height > 0,
                    noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
                    touchHeight: triggerBox.height,
                    controlCount: controls.length,
                    visibleThemeButtons: visibleThemeButtons.length,
                    mobileThemeCycle:
                      visibleThemeButtons.length === 1 &&
                      visibleThemeButtons[0]?.hasAttribute("data-theme-cycle-mobile") &&
                      visibleThemeButtons[0].getBoundingClientRect().width >= 44 &&
                      visibleThemeButtons[0].getBoundingClientRect().height >= 44 &&
                      Boolean(visibleThemeButtons[0].querySelector("svg")),
                    collisions,
                  };
                },
                { brandName: styles.brandName, brandMark: styles.brandMark, topbar: styles.topbar },
              );
              const scenario = `${width}px / ${theme} / ${displayName}`;
              expect(geometry.text, scenario).toBe(displayName.split(" ")[0]);
              expect(geometry.display, scenario).not.toBe("none");
              expect(geometry.position, scenario).toBe("absolute");
              expect(geometry.overflow, scenario).toBe("hidden");
              expect(geometry.labelWidth, scenario).toBeLessThanOrEqual(1);
              expect(geometry.labelHeight, scenario).toBeLessThanOrEqual(1);
              expect(geometry.avatarVisible, scenario).toBe(true);
              expect(geometry.noPageOverflow, scenario).toBe(true);
              expect(geometry.touchHeight, scenario).toBeGreaterThanOrEqual(44);
              expect(geometry.controlCount, scenario).toBeGreaterThanOrEqual(7);
              expect(geometry.collisions, scenario).toEqual([]);
              await checkProtectedTopbar(page);
              if (width === 320 && theme === "light" && displayName === "Mariana Silva") {
                await page.locator("[data-protected-topbar]").evaluate((element) => {
                  (element as HTMLElement).style.paddingBottom = "80px";
                });
                await expect(checkProtectedTopbar(page)).rejects.toThrow(
                  "compact vertical spacing",
                );
                await page.locator("[data-protected-topbar]").evaluate((element) => {
                  (element as HTMLElement).style.paddingBottom = "";
                });
              }
              if (width <= 600) {
                expect(geometry.visibleThemeButtons, scenario).toBe(1);
                expect(geometry.mobileThemeCycle, scenario).toBe(true);
              } else {
                expect(geometry.visibleThemeButtons, scenario).toBe(3);
              }
              if (width >= 1181 && displayName.startsWith("Alexandriana")) {
                for (const family of ["system-ui", "Verdana, sans-serif"]) {
                  await page.locator("body").evaluate((body, font) => {
                    body.style.fontFamily = font;
                  }, family);
                  const reachable = await page.locator("header").evaluate(pointerTargetsReachable);
                  expect(reachable, `${scenario} / ${family} / pointer targets`).toBe(true);
                  if (width === 1280 && theme === "light" && family === "Verdana, sans-serif") {
                    const oldLayout = await page.addStyleTag({
                      content: `.${styles.topbarInner}{grid-template-columns:auto minmax(0,1fr) auto auto}.${styles.accountTrigger}{max-width:clamp(8rem,calc(100vw - 1050px),20rem)}`,
                    });
                    expect(await page.locator("header").evaluate(pointerTargetsReachable)).toBe(
                      false,
                    );
                    await oldLayout.evaluate((style) => {
                      style.parentNode?.removeChild(style);
                    });
                  }
                }
                await page.locator("body").evaluate((body) => {
                  body.style.fontFamily = "Arial, sans-serif";
                });
              }
              if ([320, 1440].includes(width) && theme === "light") {
                await page.screenshot({
                  path: `${output}/${width}-${displayName.split(" ")[0]}.png`,
                });
              }
              // Inspect the open panel's CSS only; this static fixture does not hydrate React.
              await page
                .locator("#protected-account-menu")
                .evaluate((panel) => panel.removeAttribute("hidden"));
              const panel = await page.locator("#protected-account-menu").boundingBox();
              expect(panel, scenario).not.toBeNull();
              expect(panel!.x, scenario).toBeGreaterThanOrEqual(0);
              expect(panel!.x + panel!.width, scenario).toBeLessThanOrEqual(width);
              cases++;
            }
          }
        }
        expect(cases).toBe(60);
        // Menus must use the actual parent height, including wrapped names.
        for (const width of [320, 375, 600, 1180]) {
          await page.setViewportSize({ width, height: 568 });
          await page.setContent(
            `<html><head><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}${stylesheet.toString()}</style></head><body>${fixture("AlexandrianaMaximilianaConstantina Silva")}</body></html>`,
          );
          for (const selector of ["#authorized-navigation", "#protected-account-menu"]) {
            const menu = page.locator(selector);
            await menu.evaluate((element) => {
              element.removeAttribute("hidden");
              element.setAttribute("data-open", "true");
              const content = document.createElement("div");
              content.style.height = "1000px";
              element.append(content);
              const last = document.createElement("a");
              last.href = "#last";
              last.textContent = "Ultimo item";
              last.style.cssText = "display:block;height:44px";
              last.dataset.lastMenuItem = "true";
              element.append(last);
              element.scrollTop = element.scrollHeight;
            });
            const box = await menu.boundingBox();
            const last = await menu.locator("[data-last-menu-item]").boundingBox();
            expect(box!.y + box!.height, `${width}px / ${selector}`).toBeLessThanOrEqual(568);
            expect(last!.y + last!.height, `${width}px / last item`).toBeLessThanOrEqual(568);
            expect(last!.y).toBeGreaterThanOrEqual(box!.y);
            await menu.evaluate((element) => {
              element.setAttribute("hidden", "");
              element.setAttribute("data-open", "false");
            });
          }
        }
      } finally {
        await browser.close();
      }
    },
    90_000,
  );
});
