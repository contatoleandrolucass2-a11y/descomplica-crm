import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { checkProtectedTopbar } from "../scripts/qa/associative-compact-layout.mjs";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { AccountMenu } from "../app/(protected)/_components/AccountMenu";
import { AuthorizedNavigation } from "../app/(protected)/_components/AuthorizedNavigation";
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

const pages = [
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

const brand = readFileSync(new URL("../public/descomplica-symbol.png", import.meta.url)).toString(
  "base64",
);

function fixture(displayName: string) {
  return renderToStaticMarkup(
    <header className={styles.topbar} data-protected-topbar>
      <div className={styles.topbarInner}>
        <a className={styles.brand} href="/app">
          {/* A data URI keeps this isolated fixture offline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.brandMark} src={`data:image/png;base64,${brand}`} alt="" />
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

describe("account menu responsive layout", () => {
  // Browser fixtures are opt-in because the unit CI job has no Chromium installation.
  it.runIf(process.env.ACCOUNT_MENU_BROWSER === "1")(
    "shows complete names without overlapping navigation or themes on desktop and mobile",
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
                  const labelBox = label.getBoundingClientRect();
                  const triggerBox = trigger.getBoundingClientRect();
                  const labelStyle = getComputedStyle(label);
                  const themeButtons = Array.from(
                    document.querySelectorAll<HTMLButtonElement>(
                      '[role="group"][aria-label="Aparência da página"] button',
                    ),
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
                    textOverflow: labelStyle.textOverflow,
                    labelWidth: labelBox.width,
                    withinButton:
                      labelBox.left >= triggerBox.left &&
                      labelBox.right <= triggerBox.right &&
                      labelBox.top >= triggerBox.top &&
                      labelBox.bottom <= triggerBox.bottom,
                    textFits:
                      label.scrollWidth <= label.clientWidth + 1 &&
                      label.scrollHeight <= label.clientHeight + 1,
                    noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
                    touchHeight: triggerBox.height,
                    controlCount: controls.length,
                    mobileThemeIcons:
                      themeButtons.length === 3 &&
                      themeButtons.every((button) => {
                        const box = button.getBoundingClientRect();
                        const icon = button.querySelector("svg")?.getBoundingClientRect();
                        return (
                          getComputedStyle(button).fontSize === "0px" &&
                          box.width >= 44 &&
                          box.height >= 44 &&
                          Boolean(icon && icon.width > 0 && icon.height > 0)
                        );
                      }),
                    collisions,
                  };
                },
                { brandName: styles.brandName, brandMark: styles.brandMark, topbar: styles.topbar },
              );
              const scenario = `${width}px / ${theme} / ${displayName}`;
              expect(geometry.text, scenario).toBe(displayName.split(" ")[0]);
              expect(geometry.display, scenario).not.toBe("none");
              expect(geometry.textOverflow, scenario).not.toBe("ellipsis");
              expect(geometry.labelWidth, scenario).toBeGreaterThan(0);
              expect(geometry.withinButton, scenario).toBe(true);
              expect(geometry.textFits, scenario).toBe(true);
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
              if (width <= 600) expect(geometry.mobileThemeIcons, scenario).toBe(true);
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
      } finally {
        await browser.close();
      }
    },
    90_000,
  );
});
