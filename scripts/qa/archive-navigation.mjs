import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import sharp from "sharp";

export const archiveNavigationRoutes = [
  "/app/simulacao/associativo-fluxo-linear",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
  "/app/simulacao/tabelao",
];
export const archiveNavigationViewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 600, height: 800 },
  { width: 601, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1180, height: 800 },
  { width: 1181, height: 800 },
  { width: 1440, height: 900 },
];
const themeLabels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
const simulationLinks = [
  ["Visão geral", "/app/simulacao"],
  ["Tabela Associativo", archiveNavigationRoutes[0]],
  ["Tabela Direta", archiveNavigationRoutes[1]],
  ["Tabela Investidor", archiveNavigationRoutes[2]],
  ["Tabelão", archiveNavigationRoutes[3]],
  ["CAIXA", "/app/simulacao/caixa"],
];
const settingsLinks = [
  ["Visão geral", "/app/configuracoes"],
  ["Configurar metas", "/app/configuracoes/metas"],
  ["Metas por pontos", "/app/configuracoes/metas/pontos"],
];
const navigation = (page) => page.locator("#archive-navigation");
const mobileTrigger = (page) => page.locator('button[aria-controls="archive-navigation"]');
const appearance = (page) => page.getByRole("group", { name: "Aparência da página", exact: true });
export const archiveNavigationActionTimeout = 10_000;

export async function waitForArchiveHeaderTheme(page, theme, surfaces = {}) {
  let previous = null;
  await expect
    .poll(
      async () => {
        const surface = await navigation(page).evaluate((nav) => {
          const header = nav.closest("header");
          const style = getComputedStyle(header);
          const token = style.getPropertyValue("--header-bg").trim();
          const probe = document.createElement("span");
          probe.style.cssText =
            "all:initial!important;position:fixed!important;visibility:hidden!important;pointer-events:none!important;transition:none!important;animation:none!important";
          probe.style.setProperty("background-color", token, "important");
          document.body.append(probe);
          try {
            const selectedTheme = document.documentElement.getAttribute("data-theme");
            return {
              theme: ["light", "balanced", "dark"].includes(selectedTheme) ? selectedTheme : null,
              backgroundColor: style.backgroundColor,
              tokenColor:
                token && CSS.supports("background-color", token)
                  ? getComputedStyle(probe).backgroundColor
                  : null,
              transitioning: header
                .getAnimations()
                .some(
                  (animation) =>
                    (animation.pending || animation.playState === "running") &&
                    animation.effect?.getKeyframes().some((frame) => "backgroundColor" in frame),
                ),
            };
          } finally {
            probe.remove();
          }
        });
        const signature = JSON.stringify(surface);
        const settled =
          surface.theme === theme &&
          surface.tokenColor !== null &&
          surface.backgroundColor === surface.tokenColor &&
          !surface.transitioning &&
          signature === previous;
        previous = signature;
        surfaces[theme] = { ...surface, settled };
        return settled;
      },
      {
        message: "Archive header surface must settle on --header-bg for the selected theme",
        timeout: archiveNavigationActionTimeout,
        intervals: [50, 100, 100],
      },
    )
    .toBe(true);
  return surfaces[theme];
}

export async function inspectArchiveNavigationFailure(page) {
  // Only geometry, CSS and allowlisted header state; never body text or arbitrary attributes.
  return page.evaluate(() => {
    const nav = document.querySelector("#archive-navigation");
    const header = nav?.closest("header");
    const settings = header?.querySelector('[aria-controls="site-menu-settings"]');
    const inspect = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        zIndex: style.zIndex,
        display: style.display,
        visibility: style.visibility,
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        expanded: ["true", "false"].includes(element.getAttribute("aria-expanded"))
          ? element.getAttribute("aria-expanded")
          : null,
      };
    };
    const rect = settings?.getBoundingClientRect();
    const point = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    const hit = point ? document.elementFromPoint(point.x, point.y) : null;
    const active = header?.contains(document.activeElement) ? document.activeElement : null;
    const label = active?.getAttribute("aria-label");
    const safeLabels = [
      "Abrir navegação",
      "Fechar navegação",
      "Navegação principal",
      "Aparência da página",
      "Claro",
      "Médio",
      "Escuro",
      "Simulação",
      "Configurações",
      "Descomplica",
    ];
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
      navigation: inspect(nav),
      settings: inspect(settings),
      simulation: inspect(header?.querySelector('[aria-controls="site-menu-simulation"]')),
      mobileTrigger: inspect(header?.querySelector('button[aria-controls="archive-navigation"]')),
      settingsCenter: point,
      elementAtSettingsCenter: inspect(hit),
      settingsReceivesPointer: Boolean(hit && settings?.contains(hit)),
      activeHeaderElement: active
        ? { tag: active.tagName, ariaLabel: safeLabels.includes(label) ? label : null }
        : null,
    };
  });
}

function sanitizedNavigationFailure(error) {
  const firstLine = error instanceof Error ? error.message.split("\n")[0] : "";
  if (error?.code === "ERR_ASSERTION") return firstLine;
  const timeout = firstLine.match(/^(?:locator|page)\.[a-zA-Z]+: Timeout \d+ms exceeded\.$/);
  if (timeout) return timeout[0];
  if (firstLine === "Archive header surface must settle on --header-bg for the selected theme")
    return firstLine;
  return "Navigation action or expectation failed; details omitted for privacy";
}

export async function ensureArchiveNavigationOpen(page) {
  const trigger = mobileTrigger(page);
  if (await trigger.isVisible()) {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(navigation(page)).toHaveAttribute("data-open", "true");
  }
  await expect(navigation(page)).toBeVisible();
}

async function assertOpenNavigationGeometry(page) {
  const fits = await navigation(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= -1 &&
      rect.top >= -1 &&
      rect.right <= innerWidth + 1 &&
      rect.bottom <= innerHeight + 1 &&
      element.scrollWidth <= element.clientWidth + 1 &&
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 &&
      document.body.scrollWidth <= document.body.clientWidth + 1
    );
  });
  assert.equal(fits, true, "Open navigation must fit the viewport without horizontal overflow");
}

// Retains the legacy tablet assertions, including ancestor clipping and both axes.
export async function checkArchiveMenuPanel(page, triggerName, panelId) {
  await ensureArchiveNavigationOpen(page);
  const trigger = navigation(page).getByRole("button", { name: triggerName, exact: true });
  const panel = page.locator(`#${panelId}`);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  const unclipped = await panel.evaluate((menuPanel) => {
    const tolerance = 1;
    const rect = menuPanel.getBoundingClientRect();
    const control = document.querySelector(`[aria-controls="${menuPanel.id}"]`);
    const controlRect = control?.getBoundingClientRect();
    const menu = menuPanel.closest('nav[aria-label="Navegação principal"]');
    let ancestor = menuPanel.parentElement;
    let ancestorsFit = true;
    while (ancestor && ancestor !== document.documentElement) {
      const style = getComputedStyle(ancestor);
      const bounds = ancestor.getBoundingClientRect();
      const clips = (value) => ["auto", "hidden", "scroll", "clip"].includes(value);
      if (
        (clips(style.overflowX) &&
          (rect.left < bounds.left - tolerance || rect.right > bounds.right + tolerance)) ||
        (clips(style.overflowY) &&
          (rect.top < bounds.top - tolerance || rect.bottom > bounds.bottom + tolerance))
      ) {
        ancestorsFit = false;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    return (
      getComputedStyle(menuPanel).visibility === "visible" &&
      Number(getComputedStyle(menuPanel).opacity) > 0 &&
      control?.getAttribute("aria-expanded") === "true" &&
      Boolean(controlRect) &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= -tolerance &&
      rect.right <= innerWidth + tolerance &&
      rect.top >= -tolerance &&
      rect.bottom <= innerHeight + tolerance &&
      controlRect.left >= -tolerance &&
      controlRect.right <= innerWidth + tolerance &&
      menu instanceof HTMLElement &&
      menu.scrollWidth <= menu.clientWidth + tolerance &&
      menuPanel.scrollWidth <= menuPanel.clientWidth + tolerance &&
      menuPanel.scrollHeight <= menuPanel.clientHeight + tolerance &&
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + tolerance &&
      document.body.scrollWidth <= document.body.clientWidth + tolerance &&
      ancestorsFit
    );
  });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  return unclipped;
}

async function assertHeaderGeometry(page, compact) {
  const header = page.locator("header").filter({ has: navigation(page) });
  await expect(header).toHaveCount(1);
  const geometry = await header.evaluate((element, isCompact) => {
    const brand = element.querySelector('a.brand-link[href="/app"]');
    const themes = element.querySelector('[role="group"][aria-label="Aparência da página"]');
    const control = element.querySelector('button[aria-controls="archive-navigation"]');
    const nav = element.querySelector("#archive-navigation");
    const nodes = [brand, themes, isCompact ? control : nav];
    if (nodes.some((node) => !node)) return { fits: false };
    const boxes = nodes.map((node) => node.getBoundingClientRect());
    const fits = boxes.every(
      (box) =>
        box.width > 0 &&
        box.height > 0 &&
        box.left >= -1 &&
        box.top >= -1 &&
        box.right <= innerWidth + 1 &&
        box.bottom <= innerHeight + 1,
    );
    const overlaps = boxes.some((box, i) =>
      boxes
        .slice(i + 1)
        .some(
          (other) =>
            box.left < other.right - 1 &&
            box.right > other.left + 1 &&
            box.top < other.bottom - 1 &&
            box.bottom > other.top + 1,
        ),
    );
    return {
      fits,
      overlaps,
      themeRow:
        innerWidth <= 600
          ? boxes[1].top >= Math.max(boxes[0].bottom, boxes[2].bottom) - 1
          : boxes[1].top < boxes[0].bottom && boxes[1].bottom > boxes[0].top,
      noOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 &&
        document.body.scrollWidth <= document.body.clientWidth + 1,
      brandTextFits: brand.scrollWidth <= brand.clientWidth + 1,
      themeContentFits: [...themes.querySelectorAll("button")].every((button) => {
        const box = button.getBoundingClientRect();
        const content = [...button.childNodes].flatMap((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            return [...range.getClientRects()];
          }
          return node instanceof Element ? [node.getBoundingClientRect()] : [];
        });
        return (
          content.length >= 2 &&
          content.every(
            (rect) =>
              rect.left >= box.left + 1 &&
              rect.right <= box.right - 1 &&
              rect.top >= box.top &&
              rect.bottom <= box.bottom,
          ) &&
          content[0].right <= content[1].left
        );
      }),
      touchTrigger: !isCompact || (boxes[2].width >= 44 && boxes[2].height >= 44),
    };
  }, compact);
  assert.deepEqual(
    geometry,
    {
      fits: true,
      overlaps: false,
      themeRow: true,
      noOverflow: true,
      brandTextFits: true,
      themeContentFits: true,
      touchTrigger: true,
    },
    "Archive header geometry failed",
  );
}

async function assertLinks(page, panelId, entries, currentRoute) {
  const panel = page.locator(`#${panelId}`);
  await expect(panel.getByRole("link")).toHaveCount(entries.length);
  await expect(panel).not.toHaveAttribute("role", "menu");
  for (const [label, href] of entries) {
    const link = panel.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", href);
    // Trial click scrolls the real disclosure and rejects obscured/unreachable links.
    await link.click({ trial: true });
    await expect(link).toBeInViewport();
    assert.equal(
      await link.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= innerWidth + 1 &&
          rect.bottom <= innerHeight + 1 &&
          node.scrollWidth <= node.clientWidth + 1
        );
      }),
      true,
      "Navigation link must be fully visible without truncated text",
    );
    assert.equal(await link.evaluate((node) => node.getBoundingClientRect().height >= 44), true);
    if (href === currentRoute) await expect(link).toHaveAttribute("aria-current", "page");
    else await expect(link).not.toHaveAttribute("aria-current", "page");
  }
  await expect(panel.locator('[role="menu"], [role="menuitem"]')).toHaveCount(0);
}

async function assertDisabledItems(page, panelId, labels) {
  const panel = page.locator(`#${panelId}`);
  await expect(panel.locator('[aria-disabled="true"]')).toHaveCount(labels.length);
  for (const label of labels) {
    const item = panel.locator('[aria-disabled="true"]').filter({ hasText: label });
    await expect(item).toHaveCount(1);
    assert.equal(
      await item.evaluate(
        (element) => !element.matches("a[href], button:not(:disabled)") && element.tabIndex < 0,
      ),
      true,
      "Future item must not navigate or receive tab focus",
    );
  }
}

async function inspectMainSurface(page) {
  const clip = await page.locator("main").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: Math.ceil(rect.left + 2), y: Math.ceil(rect.top + 2), width: 1, height: 1 };
  });
  const pixel = await sharp(await page.screenshot({ clip, animations: "disabled" }))
    .removeAlpha()
    .raw()
    .toBuffer();
  return {
    point: { x: clip.x, y: clip.y },
    rgb: [...pixel],
    shellBackground: await page
      .locator(".investor-page-shell")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  };
}

export function archiveNavigationPassed(result, { scope = "header-and-content" } = {}) {
  if (result?.contract !== "archive-navigation-v1" || !Array.isArray(result.checks)) return false;
  if (!["header-only", "header-and-content"].includes(scope) || result.scope !== scope)
    return false;
  const expected = archiveNavigationRoutes.flatMap((route) =>
    archiveNavigationViewports.map(({ width }) => `${route}:${width}`),
  );
  const actual = result.checks.map(({ route, width }) => `${route}:${width}`);
  return (
    actual.length === expected.length &&
    new Set(actual).size === expected.length &&
    expected.every((key) => actual.includes(key)) &&
    result.checks.every(
      (check) =>
        check.passed === true &&
        (scope === "header-only" || check.mainSurfaceChanges === true) &&
        Object.keys(themeLabels).every((theme) => check.themes?.[theme] === true),
    )
  );
}

export async function checkArchiveNavigation(
  page,
  origin,
  {
    openRoute = (url) => page.goto(url, { waitUntil: "domcontentloaded" }),
    scope = "header-and-content",
    onCheck = () => {},
  } = {},
) {
  assert.ok(["header-only", "header-and-content"].includes(scope));
  const result = { contract: "archive-navigation-v1", scope, checks: [], passed: false };
  const runtimeErrors = [];
  const onError = () => runtimeErrors.push(true);
  const onConsole = (message) => {
    if (message.type() === "error") onError();
  };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  try {
    for (const route of archiveNavigationRoutes) {
      for (const viewport of archiveNavigationViewports) {
        const check = {
          route,
          width: viewport.width,
          height: viewport.height,
          themes: {},
          passed: false,
        };
        result.checks.push(check);
        const errorStart = runtimeErrors.length;
        let stage = "load";
        try {
          await page.setViewportSize(viewport);
          const response = await openRoute(`${origin}${route}`);
          assert.equal(response?.status(), 200, "Archive navigation route must return HTTP 200");
          await expect(page).toHaveURL(`${origin}${route}`);
          check.viewport = await page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            devicePixelRatio,
            scale: visualViewport?.scale,
          }));
          assert.deepEqual(
            check.viewport,
            { ...viewport, devicePixelRatio: 1, scale: 1 },
            "Navigation breakpoints require an exact viewport without browser zoom",
          );
          const nav = navigation(page);
          const trigger = mobileTrigger(page);
          const compact = viewport.width <= 1180;
          const brand = page.locator('header a.brand-link[href="/app"]');
          const simulation = nav.getByRole("button", {
            name: "Simulação",
            exact: true,
            includeHidden: true,
          });
          const settings = nav.getByRole("button", {
            name: "Configurações",
            exact: true,
            includeHidden: true,
          });
          const themes = appearance(page);
          await expect(brand).toHaveAccessibleName(/Descomplica/);
          await expect(nav).toHaveAttribute("aria-label", "Navegação principal");
          await expect(themes.getByRole("button")).toHaveCount(3);
          stage = "closed-layout-and-tab-order";
          if (compact) {
            await expect(trigger).toHaveAccessibleName("Abrir navegação");
            await expect(trigger).toHaveAttribute("aria-expanded", "false");
            await expect(nav).toBeHidden();
            await brand.focus();
            for (let i = 0; i < 5; i += 1) {
              await page.keyboard.press("Tab");
              assert.equal(
                await nav.evaluate((element) => element.contains(document.activeElement)),
                false,
                "Collapsed navigation must not receive tab focus",
              );
            }
          } else {
            await expect(trigger).toBeHidden();
            await expect(nav).toBeVisible();
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await assertHeaderGeometry(page, compact);
          if (scope === "header-and-content") {
            const filters = page.locator(".investor-stock-filters");
            await expect(filters).toBeVisible();
            assert.equal(
              await filters.evaluate((element) => {
                const heading = element.querySelector(".investor-filter-heading");
                const clear = heading?.querySelector("button");
                const label = element.querySelector(":scope > label");
                if (!heading || !clear || !label) return false;
                const bounds = heading.getBoundingClientRect();
                const action = clear.getBoundingClientRect();
                const first = label.getBoundingClientRect();
                return (
                  action.top >= bounds.top - 1 &&
                  action.bottom <= bounds.bottom + 1 &&
                  bounds.bottom <= first.top + 1
                );
              }),
              true,
              "Stock filter heading and clear action must not overlap the first field",
            );
          }
          check.headerSurfaces = {};
          check.mainSurfaces = {};
          for (const [theme, label] of Object.entries(themeLabels)) {
            stage = `theme:${theme}`;
            const button = themes.getByRole("button", { name: label, exact: true });
            await button.click();
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(button).toHaveAttribute("aria-pressed", "true");
            await expect(themes.locator('[aria-pressed="true"]')).toHaveCount(1);
            await assertHeaderGeometry(page, compact);
            await waitForArchiveHeaderTheme(page, theme, check.headerSurfaces);
            if (scope === "header-and-content")
              check.mainSurfaces[theme] = await inspectMainSurface(page);
            if (viewport.width === 320 || viewport.width === 1181) {
              await ensureArchiveNavigationOpen(page);
              await simulation.click();
              await expect(page.locator("#site-menu-simulation")).toBeVisible();
              const accessibility = await new AxeBuilder({ page })
                .include("header:has(#archive-navigation)")
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
                .analyze();
              assert.equal(
                accessibility.violations.length,
                0,
                "Archive header accessibility failed",
              );
              await simulation.click();
              if (compact) await trigger.click();
            }
            check.themes[theme] = true;
          }
          stage = "header-surface-themes";
          assert.equal(
            new Set(
              Object.values(check.headerSurfaces).map(({ backgroundColor }) => backgroundColor),
            ).size,
            3,
            "The three themes must render distinct header surfaces",
          );
          if (scope === "header-and-content") {
            stage = "main-surface-themes";
            check.mainSurfaceChanges =
              new Set(Object.values(check.mainSurfaces).map(({ rgb }) => rgb.join(","))).size === 3;
            assert.equal(
              check.mainSurfaceChanges,
              true,
              "The three themes must change the rendered main background",
            );
          }
          stage = "disclosures-and-links";
          if (compact) {
            await trigger.focus();
            await page.keyboard.press("Enter");
            await expect(trigger).toHaveAccessibleName("Fechar navegação");
          }
          await ensureArchiveNavigationOpen(page);
          await assertOpenNavigationGeometry(page);
          for (const [label, href] of [
            ["Dashboard", "/app"],
            ["Ranking", "/app/ranking"],
            ["Canal de Parcerias", "/app/canal-de-parcerias"],
          ]) {
            await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute(
              "href",
              href,
            );
          }
          await simulation.focus();
          await page.keyboard.press("Space");
          await expect(simulation).toHaveAttribute("aria-expanded", "true");
          await expect(nav).toBeVisible();
          if (compact) await expect(trigger).toHaveAttribute("aria-expanded", "true");
          await page.keyboard.press("Tab");
          await expect(page.locator("#site-menu-simulation a").first()).toBeFocused();
          await assertLinks(page, "site-menu-simulation", simulationLinks, route);
          await assertDisabledItems(page, "site-menu-simulation", ["Calcular documentação"]);
          await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
          stage = "switch-disclosure-by-pointer";
          await settings.click();
          await expect(simulation).toHaveAttribute("aria-expanded", "false");
          await expect(page.locator("#site-menu-simulation")).toBeHidden();
          await expect(settings).toHaveAttribute("aria-expanded", "true");
          await expect(nav).toBeVisible();
          await assertLinks(page, "site-menu-settings", settingsLinks, route);
          await assertDisabledItems(page, "site-menu-settings", [
            "Previsão final de semana",
            "Discador",
          ]);
          await assertOpenNavigationGeometry(page);
          stage = "escape-order";
          await page.keyboard.press("Escape");
          await expect(settings).toHaveAttribute("aria-expanded", "false");
          await expect(page.locator("#site-menu-settings")).toBeHidden();
          await expect(settings).toBeFocused();
          if (compact) {
            await expect(trigger).toHaveAttribute("aria-expanded", "true");
            await page.keyboard.press("Escape");
            await expect(nav).toBeHidden();
            await expect(trigger).toBeFocused();
            stage = "outside-pointer-and-focus";
            await page.keyboard.press("Space");
            await expect(nav).toBeVisible();
            await themes.getByRole("button", { name: "Claro", exact: true }).focus();
            // Theme controls belong to the header wrapper; the brand is outside it.
            await brand.focus();
            await expect(nav).toBeHidden();
            await ensureArchiveNavigationOpen(page);
            await page.mouse.click(1, viewport.height - 1);
            await expect(nav).toBeHidden();
          }
          stage = "resize-reset";
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(nav).toBeVisible();
          await simulation.click();
          await expect(page.locator("#site-menu-simulation")).toBeVisible();
          await page.locator("#site-menu-simulation a").first().focus();
          await page.setViewportSize({ width: 1180, height: 900 });
          await expect(nav).toBeHidden();
          await expect(trigger).toBeFocused();
          await expect(simulation).toHaveAttribute("aria-expanded", "false");
          await ensureArchiveNavigationOpen(page);
          await simulation.click();
          await page.locator("#site-menu-simulation a").first().focus();
          stage = "resize-simulation-link-to-desktop";
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(nav).toBeVisible();
          await expect(page.locator("#site-menu-simulation")).toBeHidden();
          await expect(simulation).toBeFocused();
          await expect(trigger).toHaveAttribute("aria-expanded", "false");
          stage = "resize-settings-link-to-desktop";
          await page.setViewportSize({ width: 1180, height: 900 });
          await ensureArchiveNavigationOpen(page);
          await settings.click();
          await page.locator("#site-menu-settings a").first().focus();
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(page.locator("#site-menu-settings")).toBeHidden();
          await expect(settings).toBeFocused();
          stage = "resize-mobile-trigger-to-desktop";
          await page.setViewportSize({ width: 1180, height: 900 });
          await expect(trigger).toBeFocused();
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(simulation).toBeFocused();
          await expect(trigger).toBeHidden();
          stage = "navigate-and-brand";
          await page.setViewportSize(viewport);
          await ensureArchiveNavigationOpen(page);
          await simulation.click();
          const destination =
            archiveNavigationRoutes[
              (archiveNavigationRoutes.indexOf(route) + 1) % archiveNavigationRoutes.length
            ];
          await page.locator(`#site-menu-simulation a[href="${destination}"]`).click();
          await expect(page).toHaveURL(`${origin}${destination}`);
          await expect(appearance(page)).toBeVisible();
          if (compact) await expect(navigation(page)).toBeHidden();
          await page.locator('header a.brand-link[href="/app"]').click();
          await expect(page).toHaveURL(`${origin}/app`);
          assert.equal(
            runtimeErrors.length - errorStart,
            0,
            "Archive navigation emitted browser errors",
          );
          check.passed = true;
        } catch (error) {
          check.failedStage = stage;
          check.failure = sanitizedNavigationFailure(error);
          check.diagnostics = await inspectArchiveNavigationFailure(page).catch(() => ({
            unavailable: true,
          }));
        }
        check.runtimeErrorCount = runtimeErrors.length - errorStart;
        await onCheck(check);
      }
    }
    result.passed = archiveNavigationPassed(result, { scope });
    return result;
  } finally {
    page.off("pageerror", onError);
    page.off("console", onConsole);
  }
}

export function parseArchivePreviewOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !url.port ||
    Number(url.port) < 1024
  ) {
    throw new Error("Archive preview requires an unprivileged HTTP loopback origin.");
  }
  return url.origin;
}

async function runPreview(origin, scope) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: "reduce", locale: "pt-BR" });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin && route.request().method() === "GET"
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    const result = await checkArchiveNavigation(page, origin, {
      scope,
      onCheck: (check) =>
        process.stderr.write(
          `[archive-navigation] ${check.route} ${check.width}px: ${check.passed ? "passed" : `failed (${check.failedStage})`}\n`,
        ),
    });
    console.log(
      JSON.stringify(
        {
          environment: "loopback component preview; Next APIs stubbed; no auth/content/guard proof",
          ...result,
        },
        null,
        2,
      ),
    );
    if (!result.passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (
    ![4, 5].includes(process.argv.length) ||
    process.argv[2] !== "--origin" ||
    (process.argv.length === 5 && process.argv[4] !== "--header-only")
  ) {
    throw new Error(
      "Use archive-navigation.mjs --origin http://127.0.0.1:<port> [--header-only] for a component preview.",
    );
  }
  await runPreview(
    parseArchivePreviewOrigin(process.argv[3]),
    process.argv[4] === "--header-only" ? "header-only" : "header-and-content",
  );
}
