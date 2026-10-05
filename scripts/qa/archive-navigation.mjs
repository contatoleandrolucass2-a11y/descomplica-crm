import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import sharp from "sharp";
import { associativeGuidanceWidths, checkAssociativeGuidance } from "./associative-guidance.mjs";
import { checkAssociativeCalculationContinuity } from "./associative-calculation-continuity.mjs";
import {
  checkAssociativeClosingAlignment,
  checkAssociativeInitialViewport,
  checkProtectedTopbar,
  checkAssociativeCompactStock,
  checkAssociativeSelectedGold,
} from "./associative-compact-layout.mjs";

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
  ["Simulador Associativo", archiveNavigationRoutes[0]],
  ["Tabela Direta", archiveNavigationRoutes[1]],
  ["Tabela Investidor", archiveNavigationRoutes[2]],
  ["Tabelão", archiveNavigationRoutes[3]],
  ["Documentação", "/app/simulacao/calcular-documentacao"],
  ["CAIXA", "/app/simulacao/caixa"],
];
const settingsLinks = [
  ["Visão geral", "/app/configuracoes"],
  ["Metas do funil", "/app/configuracoes/metas"],
  ["Metas de parcerias", "/app/configuracoes/metas/parcerias"],
  ["Metas de pontos", "/app/configuracoes/metas/pontos"],
  ["Recurso MKT", "/app/configuracoes/recurso-mkt"],
];
const dashboardLinks = [
  ["Visão geral", "/app"],
  ["Oportunidades", "/app/etapas/oportunidades"],
  ["Agendamentos", "/app/etapas/agendamentos"],
  ["Visitas", "/app/etapas/visitas"],
  ["Pastas", "/app/etapas/pastas"],
  ["Vendas", "/app/etapas/vendas"],
];
export const archiveRootNavigationContract = [
  { name: "Dashboard", tag: "BUTTON", href: null },
  { name: "Simulação", tag: "BUTTON", href: null },
  { name: "Ranking", tag: "A", href: "/app/ranking" },
  { name: "Canal de Parcerias", tag: "A", href: "/app/canal-de-parcerias" },
  { name: "Configurações", tag: "BUTTON", href: null },
];
const navigation = (page) => page.locator("#authorized-navigation");
const mobileTrigger = (page) => page.locator('button[aria-controls="authorized-navigation"]');
const accountTrigger = (page) => page.locator('button[aria-controls="protected-account-menu"]');
const appearance = (page) => page.getByRole("group", { name: "Aparência da página", exact: true });
export const archiveNavigationActionTimeout = 10_000;

async function assertNavigationControlFocused(control, ariaControls) {
  const focusState = await control.evaluate((element) => ({
    focused: document.activeElement === element,
    ariaControls: element.getAttribute("aria-controls"),
    connected: element.isConnected,
  }));
  assert.deepEqual(
    focusState,
    { focused: true, ariaControls, connected: true },
    `Keyboard focus must reach ${ariaControls}`,
  );
}

async function assertRootAccessibleNames({ dashboard, settings, simulation }) {
  await expect(dashboard).toHaveAccessibleName("Dashboard");
  await expect(simulation).toHaveAccessibleName("Simulação");
  await expect(settings).toHaveAccessibleName("Configurações");
}

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
        message: "Protected topbar surface must settle on --header-bg for the selected theme",
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
    const nav = document.querySelector("#authorized-navigation");
    const header = nav?.closest("header");
    const dashboard = header?.querySelector(
      '[aria-controls="authorized-navigation-crm-dashboard"]',
    );
    const settings = header?.querySelector('[aria-controls="authorized-navigation-crm-settings"]');
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
    const activeControls = active?.getAttribute("aria-controls");
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
    const safeControls = [
      "authorized-navigation",
      "authorized-navigation-crm-dashboard",
      "authorized-navigation-crm-simulation",
      "authorized-navigation-crm-settings",
      "protected-account-menu",
    ];
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
      pathname: location.pathname,
      navigation: inspect(nav),
      dashboard: inspect(dashboard),
      settings: inspect(settings),
      simulation: inspect(
        header?.querySelector('[aria-controls="authorized-navigation-crm-simulation"]'),
      ),
      account: inspect(header?.querySelector('[aria-controls="protected-account-menu"]')),
      mobileTrigger: inspect(
        header?.querySelector('button[aria-controls="authorized-navigation"]'),
      ),
      settingsCenter: point,
      elementAtSettingsCenter: inspect(hit),
      settingsReceivesPointer: Boolean(hit && settings?.contains(hit)),
      navigationContainsFocus: Boolean(
        document.activeElement && nav?.contains(document.activeElement),
      ),
      rootControlCount: nav?.querySelectorAll("[data-navigation-root-control]").length ?? 0,
      activeHeaderElement: active
        ? {
            tag: active.tagName,
            ariaLabel: safeLabels.includes(label) ? label : null,
            ariaControls: safeControls.includes(activeControls) ? activeControls : null,
          }
        : null,
    };
  });
}

function sanitizedNavigationFailure(error) {
  const firstLine = error instanceof Error ? error.message.split("\n")[0] : "";
  if (error?.code === "ERR_ASSERTION") return firstLine;
  const timeout = firstLine.match(/^(?:locator|page)\.[a-zA-Z]+: Timeout \d+ms exceeded\.$/);
  if (timeout) return timeout[0];
  if (firstLine === "Protected topbar surface must settle on --header-bg for the selected theme")
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
  await ensureArchiveNavigationOpen(page);
  const geometry = await navigation(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      checks: {
        visibleSize: rect.width > 0 && rect.height > 0,
        insideViewport:
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= innerWidth + 1 &&
          rect.bottom <= innerHeight + 1,
        navigationNoOverflow: element.scrollWidth <= element.clientWidth + 1,
        documentNoOverflow:
          document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        bodyNoOverflow: document.body.scrollWidth <= document.body.clientWidth + 1,
      },
      navigation: {
        width: rect.width,
        height: rect.height,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
    };
  });
  try {
    assert.equal(
      Object.values(geometry.checks).every(Boolean),
      true,
      "Open navigation must fit the viewport without horizontal overflow",
    );
  } catch (error) {
    if (error && typeof error === "object") {
      error.safeDiagnostics = { kind: "open-navigation-geometry", ...geometry };
    }
    throw error;
  }
}

async function assertExactRootNavigation(page) {
  await ensureArchiveNavigationOpen(page);
  const snapshot = await navigation(page)
    .locator("[data-navigation-root-control]")
    .evaluateAll((controls) =>
      controls.map((control) => {
        const accessibleCopy = control.cloneNode(true);
        accessibleCopy
          .querySelectorAll('[aria-hidden="true"]')
          .forEach((decorative) => decorative.remove());
        return {
          name: accessibleCopy.textContent?.replace(/\s+/gu, " ").trim() ?? "",
          tag: control.tagName,
          href: control instanceof HTMLAnchorElement ? control.getAttribute("href") : null,
        };
      }),
    );
  assert.deepEqual(
    snapshot,
    archiveRootNavigationContract,
    "Protected shell must expose only the server-authorized root navigation",
  );
}

function allArchiveMenuPanelChecksPass(checks) {
  return (
    checks &&
    typeof checks === "object" &&
    Object.keys(checks).length > 0 &&
    Object.values(checks).every((value) => value === true)
  );
}

export function archiveMenuPanelPassed(measurement) {
  if (!allArchiveMenuPanelChecksPass(measurement?.common)) return false;
  if (!measurement.compact) return allArchiveMenuPanelChecksPass(measurement.desktop);

  const drawer = measurement.compactDrawer;
  return Boolean(
    drawer &&
    Number.isInteger(drawer.verticalScrollAncestorCount) &&
    drawer.verticalScrollAncestorCount > 0 &&
    allArchiveMenuPanelChecksPass(drawer.panelEdges) &&
    Array.isArray(drawer.items) &&
    drawer.items.length > 0 &&
    drawer.items.every(allArchiveMenuPanelChecksPass),
  );
}

// Desktop keeps the floating-panel containment contract. Compact widths instead
// prove every drawer item and both panel edges are reachable through vertical scroll.
export async function checkArchiveMenuPanel(page, triggerName, panelId) {
  await ensureArchiveNavigationOpen(page);
  const trigger = navigation(page).getByRole("button", { name: triggerName, exact: true });
  const panel = page.locator(`#${panelId}`);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  const measurement = await panel.evaluate(async (menuPanel) => {
    const tolerance = 1;
    const rect = menuPanel.getBoundingClientRect();
    const control = document.querySelector(`[aria-controls="${menuPanel.id}"]`);
    const controlRect = control?.getBoundingClientRect();
    const menu = menuPanel.closest('nav[aria-label="Navegação principal"]');
    const compact = matchMedia("(max-width: 1180px)").matches;
    const clips = (value) => ["auto", "hidden", "scroll", "clip"].includes(value);
    const scrolls = (value) => ["auto", "scroll"].includes(value);
    const ancestors = [];
    let ancestor = menuPanel.parentElement;
    while (ancestor && ancestor !== document.documentElement) {
      ancestors.push(ancestor);
      ancestor = ancestor.parentElement;
    }
    const horizontalAncestorsFit = (element) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.left < -tolerance || bounds.right > innerWidth + tolerance) return false;
      let parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        const parentBounds = parent.getBoundingClientRect();
        if (
          clips(style.overflowX) &&
          (bounds.left < parentBounds.left - tolerance ||
            bounds.right > parentBounds.right + tolerance)
        )
          return false;
        parent = parent.parentElement;
      }
      return true;
    };
    const verticalAncestorsFit = ancestors.every((parent) => {
      const style = getComputedStyle(parent);
      if (!clips(style.overflowY)) return true;
      const bounds = parent.getBoundingClientRect();
      return rect.top >= bounds.top - tolerance && rect.bottom <= bounds.bottom + tolerance;
    });
    const common = {
      visible:
        getComputedStyle(menuPanel).visibility === "visible" &&
        Number(getComputedStyle(menuPanel).opacity) > 0,
      expanded: control?.getAttribute("aria-expanded") === "true",
      controlPresent: Boolean(controlRect),
      panelHasSize: rect.width > 0 && rect.height > 0,
      panelInsideViewportHorizontally:
        rect.left >= -tolerance && rect.right <= innerWidth + tolerance,
      controlInsideViewportHorizontally: Boolean(
        controlRect &&
        controlRect.left >= -tolerance &&
        controlRect.right <= innerWidth + tolerance,
      ),
      navigationHasNoHorizontalOverflow:
        menu instanceof HTMLElement && menu.scrollWidth <= menu.clientWidth + tolerance,
      documentHasNoHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + tolerance,
      bodyHasNoHorizontalOverflow:
        document.body.scrollWidth <= document.body.clientWidth + tolerance,
      horizontalAncestorsFit: horizontalAncestorsFit(menuPanel),
    };

    if (!compact) {
      return {
        compact,
        common,
        desktop: {
          panelInsideViewportVertically:
            rect.top >= -tolerance && rect.bottom <= innerHeight + tolerance,
          controlInsideViewportVertically: Boolean(
            controlRect &&
            controlRect.top >= -tolerance &&
            controlRect.bottom <= innerHeight + tolerance,
          ),
          panelHasNoHorizontalOverflow: menuPanel.scrollWidth <= menuPanel.clientWidth + tolerance,
          panelHasNoVerticalOverflow: menuPanel.scrollHeight <= menuPanel.clientHeight + tolerance,
          verticalAncestorsFit,
        },
      };
    }

    const verticalScrollAncestors = ancestors.filter((parent) =>
      scrolls(getComputedStyle(parent).overflowY),
    );
    const savedWindowScroll = { x: scrollX, y: scrollY };
    const savedAncestorScroll = ancestors.map((parent) => ({
      parent,
      left: parent.scrollLeft,
      top: parent.scrollTop,
    }));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const restoreScroll = async () => {
      for (const saved of savedAncestorScroll) {
        saved.parent.scrollLeft = saved.left;
        saved.parent.scrollTop = saved.top;
      }
      window.scrollTo({
        left: savedWindowScroll.x,
        top: savedWindowScroll.y,
        behavior: "instant",
      });
      await nextFrame();
    };
    const visibleVerticalBounds = (element) => {
      let top = 0;
      let bottom = innerHeight;
      let parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        if (clips(style.overflowY)) {
          const bounds = parent.getBoundingClientRect();
          const clientTop = bounds.top + parent.clientTop;
          top = Math.max(top, clientTop);
          bottom = Math.min(bottom, clientTop + parent.clientHeight);
        }
        parent = parent.parentElement;
      }
      return { top, bottom };
    };
    const scrollWithinVerticalAncestors = (element, block) => {
      for (const parent of verticalScrollAncestors) {
        const bounds = parent.getBoundingClientRect();
        const clientTop = bounds.top + parent.clientTop;
        const clientBottom = clientTop + parent.clientHeight;
        const elementBounds = element.getBoundingClientRect();
        let delta = 0;
        if (block === "start") delta = elementBounds.top - clientTop;
        else if (block === "end") delta = elementBounds.bottom - clientBottom;
        else if (elementBounds.top < clientTop) delta = elementBounds.top - clientTop;
        else if (elementBounds.bottom > clientBottom) delta = elementBounds.bottom - clientBottom;
        parent.scrollTop += delta;
      }
    };
    const verticalAncestorWasUsed = (before) =>
      verticalScrollAncestors.some(
        (parent, index) => Math.abs(parent.scrollTop - before[index]) > tolerance,
      );
    const measureReachability = async (element, block, edge = null) => {
      await restoreScroll();
      const beforeBounds = visibleVerticalBounds(element);
      const beforeRect = element.getBoundingClientRect();
      const beforeScroll = verticalScrollAncestors.map((parent) => parent.scrollTop);
      const neededVerticalScroll = edge
        ? edge === "top"
          ? beforeRect.top < beforeBounds.top - tolerance ||
            beforeRect.top > beforeBounds.bottom + tolerance
          : beforeRect.bottom < beforeBounds.top - tolerance ||
            beforeRect.bottom > beforeBounds.bottom + tolerance
        : beforeRect.top < beforeBounds.top - tolerance ||
          beforeRect.bottom > beforeBounds.bottom + tolerance;
      scrollWithinVerticalAncestors(element, block);
      await nextFrame();
      const bounds = visibleVerticalBounds(element);
      const currentRect = element.getBoundingClientRect();
      const verticallyReachable = edge
        ? edge === "top"
          ? currentRect.top >= bounds.top - tolerance &&
            currentRect.top <= bounds.bottom + tolerance
          : currentRect.bottom >= bounds.top - tolerance &&
            currentRect.bottom <= bounds.bottom + tolerance
        : currentRect.top >= bounds.top - tolerance &&
          currentRect.bottom <= bounds.bottom + tolerance;
      const checks = {
        horizontallyContained: horizontalAncestorsFit(element),
        verticallyReachable,
        pageScrollStable:
          Math.abs(scrollX - savedWindowScroll.x) <= tolerance &&
          Math.abs(scrollY - savedWindowScroll.y) <= tolerance,
        scrollContainerUsedWhenNeeded:
          !neededVerticalScroll || verticalAncestorWasUsed(beforeScroll),
      };
      if (!edge)
        checks.noOwnHorizontalOverflow = element.scrollWidth <= element.clientWidth + tolerance;
      return checks;
    };

    let panelTop;
    let panelBottom;
    let items;
    try {
      panelTop = await measureReachability(menuPanel, "start", "top");
      panelBottom = await measureReachability(menuPanel, "end", "bottom");
      const visibleItems = [...menuPanel.children].filter((item) => {
        const style = getComputedStyle(item);
        const bounds = item.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      });
      items = [];
      for (const item of visibleItems) {
        items.push(await measureReachability(item, "nearest"));
      }
    } finally {
      await restoreScroll();
    }

    return {
      compact,
      common,
      compactDrawer: {
        verticalScrollAncestorCount: verticalScrollAncestors.length,
        panelEdges: {
          topReachable: Object.values(panelTop).every(Boolean),
          bottomReachable: Object.values(panelBottom).every(Boolean),
        },
        items,
      },
    };
  });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  return archiveMenuPanelPassed(measurement);
}

export async function assertHeaderGeometry(page, compact) {
  await expect(page.locator("[data-protected-topbar]")).toHaveCount(1);
  await expect(navigation(page)).toHaveCount(1);
  const header = page.locator("[data-protected-topbar]").filter({ has: navigation(page) });
  await expect(header).toHaveCount(1);
  const geometry = await header.evaluate(async (element, isCompact) => {
    const brand = element.querySelector("[data-protected-brand]");
    const themes = element.querySelector('[role="group"][aria-label="Aparência da página"]');
    const account = element.querySelector('button[aria-controls="protected-account-menu"]');
    const control = element.querySelector('button[aria-controls="authorized-navigation"]');
    const nav = element.querySelector("#authorized-navigation");
    const nodes = [brand, themes, account, isCompact ? control : nav];
    if (nodes.some((node) => !node)) {
      return {
        checks: { elementsPresent: false },
        missingElementCount: nodes.filter((node) => !node).length,
      };
    }
    const containedInHeader = (node, includeFocusOutline = false) => {
      const bounds = element.getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const outline =
        includeFocusOutline && node.matches(":focus-visible") && style.outlineStyle !== "none"
          ? Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset))
          : 0;
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top - outline >= bounds.top - 1 &&
        rect.bottom + outline <= bounds.bottom + 1 &&
        rect.left - outline >= bounds.left - 1 &&
        rect.right + outline <= bounds.right + 1
      );
    };
    // Only top-level controls belong inside the header; disclosure panels may extend beyond it.
    const activeNavItems = [
      ...nav.querySelectorAll(
        '[data-navigation-root-control][aria-current="page"], [data-navigation-root-control][data-navigation-active="true"]',
      ),
    ];
    const rootControls = [...nav.querySelectorAll("[data-navigation-root-control]")];
    const themeButtons = [...themes.querySelectorAll("button")];
    const fixedControls = [
      brand,
      themes,
      ...themeButtons,
      account,
      ...(isCompact ? [control] : rootControls),
    ];
    const activeNavContained =
      isCompact ||
      (activeNavItems.length === 1 && activeNavItems.every((node) => containedInHeader(node)));
    const headerControlsContained = fixedControls.every((node) => containedInHeader(node));
    const focusTargets = [
      ...themeButtons.map((button, index) => [`theme-${index + 1}`, button]),
      ["account", account],
      ...(isCompact
        ? [["mobile-trigger", control]]
        : rootControls.map((node, index) => [`root-${index + 1}`, node])),
    ];
    const previousFocus = document.activeElement;
    let focusedControlsContained;
    let focusContainment;
    try {
      const focusEntries = [];
      for (const [name, node] of focusTargets) {
        node.focus({ preventScroll: true });
        // Chromium resolves :focus-visible and its author styles on the next
        // rendering turn for anchors. Measure the painted state, not the
        // transient user-agent outline from the synchronous focus call.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const headerRect = element.getBoundingClientRect();
        const checks = {
          receivesFocus: document.activeElement === node,
          focusRingContained: containedInHeader(node, true),
          fixedControlsContained: fixedControls.every((control) => containedInHeader(control)),
          activeNavigationContained:
            isCompact || activeNavItems.every((control) => containedInHeader(control)),
        };
        focusEntries.push([
          name,
          {
            ...checks,
            passed: Object.values(checks).every(Boolean),
            outline: {
              style: style.outlineStyle,
              width: style.outlineWidth,
              offset: style.outlineOffset,
            },
            edgeInsets: {
              top: rect.top - headerRect.top,
              right: headerRect.right - rect.right,
              bottom: headerRect.bottom - rect.bottom,
              left: rect.left - headerRect.left,
            },
          },
        ]);
      }
      focusContainment = Object.fromEntries(focusEntries);
      focusedControlsContained = Object.values(focusContainment).every(({ passed }) => passed);
    } finally {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    }
    const namedNodes = [
      ["brand", brand],
      ["themes", themes],
      ["account", account],
      [isCompact ? "mobile-trigger" : "navigation", isCompact ? control : nav],
    ];
    const boxes = namedNodes.map(([, node]) => node.getBoundingClientRect());
    const pointerTargets = [
      ["brand", brand],
      ...themeButtons.map((button, index) => [`theme-${index + 1}`, button]),
      ["account", account],
      ...(isCompact
        ? [["mobile-trigger", control]]
        : rootControls.map((node, index) => [`root-${index + 1}`, node])),
    ];
    const fits = boxes.every(
      (box) =>
        box.width > 0 &&
        box.height > 0 &&
        box.left >= -1 &&
        box.top >= -1 &&
        box.right <= innerWidth + 1 &&
        box.bottom <= innerHeight + 1,
    );
    const overlappingPairs = namedNodes.flatMap(([name, node], index) => {
      const box = node.getBoundingClientRect();
      return namedNodes.slice(index + 1).flatMap(([otherName, otherNode]) => {
        const other = otherNode.getBoundingClientRect();
        return box.left < other.right - 1 &&
          box.right > other.left + 1 &&
          box.top < other.bottom - 1 &&
          box.bottom > other.top + 1
          ? [`${name}:${otherName}`]
          : [];
      });
    });
    const pointerReachability = Object.fromEntries(
      pointerTargets.map(([name, node]) => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return [name, Boolean(hit && node.contains(hit))];
      }),
    );
    const themeContent = themeButtons.map((button) => {
      const box = button.getBoundingClientRect();
      const content = [...button.childNodes]
        .flatMap((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            return [...range.getClientRects()];
          }
          if (!(node instanceof Element)) return [];
          const style = getComputedStyle(node);
          return style.display === "none" || style.visibility === "hidden"
            ? []
            : [node.getBoundingClientRect()];
        })
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .sort((left, right) => left.left - right.left);
      return {
        visiblePartCount: content.length,
        contained:
          content.length >= 1 &&
          content.every(
            (rect) =>
              rect.left >= box.left + 1 &&
              rect.right <= box.right - 1 &&
              rect.top >= box.top &&
              rect.bottom <= box.bottom,
          ),
        separated: content.every(
          (rect, index) => index === 0 || content[index - 1].right <= rect.left,
        ),
      };
    });
    const checks = {
      elementsPresent: true,
      fits,
      overlaps: overlappingPairs.length > 0,
      activeNavContained,
      headerControlsContained,
      focusedControlsContained,
      pointerTargetsReachable: Object.values(pointerReachability).every(Boolean),
      themeRow: boxes[1].top < boxes[0].bottom && boxes[1].bottom > boxes[0].top,
      noOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 &&
        document.body.scrollWidth <= document.body.clientWidth + 1,
      brandTextFits: brand.scrollWidth <= brand.clientWidth + 1,
      accountTextContained: account.scrollWidth <= account.clientWidth + 1,
      themeContentFits: themeContent.every(({ contained, separated }) => contained && separated),
      accountTouchTarget: boxes[2].height >= 44,
      touchTrigger: !isCompact || (boxes[3].width >= 44 && boxes[3].height >= 44),
    };
    const round = (value) => Math.round(value * 100) / 100;
    return {
      checks,
      overlappingPairs,
      pointerReachability,
      focusContainment,
      themeContent,
      boxes: Object.fromEntries(
        namedNodes.map(([name, node]) => {
          const rect = node.getBoundingClientRect();
          return [
            name,
            {
              x: round(rect.x),
              y: round(rect.y),
              width: round(rect.width),
              height: round(rect.height),
            },
          ];
        }),
      ),
      headerOverflow: {
        x: getComputedStyle(element).overflowX,
        y: getComputedStyle(element).overflowY,
      },
    };
  }, compact);
  try {
    assert.deepEqual(
      geometry.checks,
      {
        elementsPresent: true,
        fits: true,
        overlaps: false,
        activeNavContained: true,
        headerControlsContained: true,
        focusedControlsContained: true,
        pointerTargetsReachable: true,
        themeRow: true,
        noOverflow: true,
        brandTextFits: true,
        accountTextContained: true,
        themeContentFits: true,
        accountTouchTarget: true,
        touchTrigger: true,
      },
      "Protected topbar geometry failed",
    );
  } catch (error) {
    if (error && typeof error === "object") {
      error.safeDiagnostics = { kind: "protected-topbar-geometry", ...geometry };
    }
    throw error;
  }
  return geometry;
}

async function assertLinks(page, panelId, entries, currentRoute) {
  const panel = page.locator(`#${panelId}`);
  await expect(panel.getByRole("link")).toHaveCount(entries.length);
  await expect(panel).not.toHaveAttribute("role", "menu");
  for (const [label, href] of entries) {
    const link = panel.locator(`a[href="${href}"]`);
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAccessibleName(new RegExp(`^${escapedLabel}(?:\\s|$)`, "u"));
    await expect(link.getByText(label, { exact: true })).toHaveCount(1);
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
        (element) =>
          !element.matches("a[href], button:not(:disabled)") &&
          !element.closest("a[href]") &&
          !element.querySelector("a[href]") &&
          element.tabIndex < 0,
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
  if (
    result?.contract !== "archive-navigation-v1" ||
    result?.shellContract !== "unified-protected-shell-v1" ||
    !Array.isArray(result.checks)
  )
    return false;
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
        check.singleProtectedTopbar === true &&
        check.exactAuthorizedRootNavigation === true &&
        check.exactAuthorizedAccountNavigation === true &&
        (scope === "header-only" || check.mainSurfaceChanges === true) &&
        Object.keys(themeLabels).every((theme) => check.themes?.[theme] === true),
    )
  );
}

export async function checkArchiveNavigation(
  initialPage,
  origin,
  {
    openRoute = (url, activePage) => activePage.goto(url, { waitUntil: "domcontentloaded" }),
    pageFactory,
    scope = "header-and-content",
    onCheck = () => {},
  } = {},
) {
  assert.ok(["header-only", "header-and-content"].includes(scope));
  assert.ok(
    associativeGuidanceWidths.every((width) =>
      archiveNavigationViewports.some((viewport) => viewport.width === width),
    ),
    "Guidance widths must be exercised by the archive navigation matrix",
  );
  const result = {
    contract: "archive-navigation-v1",
    shellContract: "unified-protected-shell-v1",
    scope,
    checks: [],
    passed: false,
  };
  const runtimeErrors = [];
  const onError = () => runtimeErrors.push(true);
  const onConsole = (message) => {
    if (message.type() === "error") onError();
  };
  let page = initialPage;
  const rotatingPages = typeof pageFactory === "function";
  const attachRuntimeListeners = (activePage) => {
    activePage.on("pageerror", onError);
    activePage.on("console", onConsole);
  };
  const detachRuntimeListeners = (activePage) => {
    activePage.off("pageerror", onError);
    activePage.off("console", onConsole);
  };
  attachRuntimeListeners(page);
  let firstCheck = true;
  try {
    for (const route of archiveNavigationRoutes) {
      for (const viewport of archiveNavigationViewports) {
        if (!firstCheck && rotatingPages) {
          detachRuntimeListeners(page);
          await page.close({ runBeforeUnload: false });
          page = await pageFactory();
          attachRuntimeListeners(page);
        }
        firstCheck = false;
        const check = {
          route,
          width: viewport.width,
          height: viewport.height,
          themes: {},
          passed: false,
        };
        result.checks.push(check);
        const errorStart = runtimeErrors.length;
        let stage = "load:navigate";
        try {
          await page.setViewportSize(viewport);
          const response = await openRoute(`${origin}${route}`, page);
          check.responseStatus = response?.status() ?? null;
          stage = "load:status";
          assert.equal(response?.status(), 200, "Archive navigation route must return HTTP 200");
          stage = "load:url";
          await expect(page).toHaveURL(`${origin}${route}`);
          stage = "load:viewport";
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
          const brand = page.locator("[data-protected-brand]");
          const dashboard = nav.locator(
            'button[data-navigation-root-control][aria-controls="authorized-navigation-crm-dashboard"]',
          );
          const simulation = nav.locator(
            'button[data-navigation-root-control][aria-controls="authorized-navigation-crm-simulation"]',
          );
          const settings = nav.locator(
            'button[data-navigation-root-control][aria-controls="authorized-navigation-crm-settings"]',
          );
          const themes = appearance(page);
          stage = "load:shell";
          await expect(page.locator("[data-protected-shell]")).toHaveCount(1);
          await expect(page.locator("[data-protected-topbar]")).toHaveCount(1);
          check.singleProtectedTopbar = true;
          stage = "load:brand";
          await expect(brand).toHaveAccessibleName(/Descomplica/);
          stage = "load:navigation-label";
          await expect(nav).toHaveAttribute("aria-label", "Navegação principal");
          stage = "load:theme-controls";
          await expect(themes.getByRole("button")).toHaveCount(3);
          stage = "closed-layout-and-tab-order";
          if (compact) {
            await expect(trigger).toHaveAccessibleName("Abrir navegação");
            await expect(trigger).toHaveAttribute("aria-expanded", "false");
            await expect(nav).toBeHidden();
            await brand.focus();
            await page.keyboard.press("Tab");
            await expect(trigger).toBeFocused();
            for (const label of Object.values(themeLabels)) {
              await page.keyboard.press("Tab");
              await expect(themes.getByRole("button", { name: label, exact: true })).toBeFocused();
            }
            await page.keyboard.press("Tab");
            await expect(accountTrigger(page)).toBeFocused();
            assert.equal(
              await nav.evaluate((element) => element.contains(document.activeElement)),
              false,
              "Collapsed navigation must not receive tab focus",
            );
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
                const associative = Boolean(element.closest(".investor-associative-table-page"));
                const heading = associative
                  ? element.closest(".investor-stock-panel").querySelector(":scope > header")
                  : element.querySelector(".investor-filter-heading");
                const clear = heading?.querySelector(
                  associative ? ".investor-stock-clear" : "button",
                );
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
            stage = `theme:${theme}:selection`;
            const button = themes.getByRole("button", { name: label, exact: true });
            await button.click();
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(button).toHaveAttribute("aria-pressed", "true");
            await expect(themes.locator('[aria-pressed="true"]')).toHaveCount(1);
            await assertHeaderGeometry(page, compact);
            await waitForArchiveHeaderTheme(page, theme, check.headerSurfaces);
            check.compactHeader ??= {};
            check.compactHeader[theme] = await checkProtectedTopbar(page);
            if (scope === "header-and-content")
              check.mainSurfaces[theme] = await inspectMainSurface(page);
            if (scope === "header-and-content" && route === archiveNavigationRoutes[0]) {
              stage = `theme:${theme}:associative-content`;
              check.compactStock ??= {};
              check.compactStock[theme] = await checkAssociativeCompactStock(page);
              check.initialViewport ??= {};
              check.initialViewport[theme] = await checkAssociativeInitialViewport(page);
              if (viewport.width === 1440) {
                try {
                  await page.setViewportSize({ width: 1280, height: 720 });
                  check.shortInitialViewport ??= {};
                  check.shortInitialViewport[theme] = await checkAssociativeInitialViewport(page);
                } finally {
                  await page.setViewportSize(viewport);
                }
              }
              check.associativeClosing ??= {};
              check.associativeClosing[theme] = await checkAssociativeClosingAlignment(page);
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            }
            if (viewport.width === 320 || viewport.width === 1181) {
              stage = `theme:${theme}:accessible-disclosure:open-navigation`;
              await ensureArchiveNavigationOpen(page);
              if (compact) {
                stage = `theme:${theme}:accessible-disclosure:trigger-focus`;
                await expect(trigger).toBeFocused();
                await page.keyboard.press("Tab");
                stage = `theme:${theme}:accessible-disclosure:dashboard-focus`;
                await assertNavigationControlFocused(
                  dashboard,
                  "authorized-navigation-crm-dashboard",
                );
                await page.keyboard.press("Tab");
                stage = `theme:${theme}:accessible-disclosure:simulation-focus`;
                await assertNavigationControlFocused(
                  simulation,
                  "authorized-navigation-crm-simulation",
                );
              } else {
                stage = `theme:${theme}:accessible-disclosure:brand-focus`;
                await brand.focus();
                await page.keyboard.press("Tab");
                stage = `theme:${theme}:accessible-disclosure:dashboard-focus`;
                await assertNavigationControlFocused(
                  dashboard,
                  "authorized-navigation-crm-dashboard",
                );
                await page.keyboard.press("Tab");
                stage = `theme:${theme}:accessible-disclosure:simulation-focus`;
                await assertNavigationControlFocused(
                  simulation,
                  "authorized-navigation-crm-simulation",
                );
              }
              stage = `theme:${theme}:accessible-disclosure:open-submenu`;
              await page.keyboard.press("Enter");
              await expect(page.locator("#authorized-navigation-crm-simulation")).toBeVisible();
              stage = `theme:${theme}:accessible-disclosure:axe`;
              const accessibility = await new AxeBuilder({ page })
                .include("[data-protected-topbar]")
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
                .analyze();
              assert.equal(
                accessibility.violations.length,
                0,
                "Protected topbar accessibility failed",
              );
              stage = `theme:${theme}:accessible-disclosure:close-submenu`;
              await page.keyboard.press("Escape");
              await assertNavigationControlFocused(
                simulation,
                "authorized-navigation-crm-simulation",
              );
              await expect(simulation).toHaveAttribute("aria-expanded", "false");
              if (compact) {
                stage = `theme:${theme}:accessible-disclosure:close-navigation`;
                await page.keyboard.press("Escape");
                await expect(nav).toBeHidden();
                await expect(trigger).toBeFocused();
              }
            }
            check.themes[theme] = true;
          }
          if (scope === "header-and-content" && route === archiveNavigationRoutes[0]) {
            for (const [theme, label] of Object.entries(themeLabels)) {
              stage = `selected-stock:${theme}`;
              await themes.getByRole("button", { name: label, exact: true }).click();
              await waitForArchiveHeaderTheme(page, theme);
              await checkAssociativeSelectedGold(page);
              if (associativeGuidanceWidths.includes(viewport.width)) {
                stage = `associative-guidance:${theme}`;
                check.associativeGuidance ??= {};
                check.associativeGuidance[theme] = await checkAssociativeGuidance(page);
              }
            }
            if (associativeGuidanceWidths.includes(viewport.width)) {
              stage = "associative-calculation-continuity";
              check.associativeCalculationContinuity =
                await checkAssociativeCalculationContinuity(page);
              assert.equal(
                check.associativeCalculationContinuity.passed,
                true,
                check.associativeCalculationContinuity.error ||
                  "Associativo calculation continuity failed",
              );
            }
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
          await assertRootAccessibleNames({ dashboard, settings, simulation });
          await assertOpenNavigationGeometry(page);
          await assertExactRootNavigation(page);
          check.exactAuthorizedRootNavigation = true;
          if (compact) {
            await expect(trigger).toBeFocused();
            await page.keyboard.press("Tab");
            await assertNavigationControlFocused(dashboard, "authorized-navigation-crm-dashboard");
            await page.keyboard.press("Tab");
            await assertNavigationControlFocused(
              simulation,
              "authorized-navigation-crm-simulation",
            );
          } else {
            await brand.focus();
            await page.keyboard.press("Tab");
            await assertNavigationControlFocused(dashboard, "authorized-navigation-crm-dashboard");
            await page.keyboard.press("Tab");
            await assertNavigationControlFocused(
              simulation,
              "authorized-navigation-crm-simulation",
            );
          }
          await page.keyboard.press("ArrowDown");
          await expect(simulation).toHaveAttribute("aria-expanded", "true");
          await expect(nav).toBeVisible();
          if (compact) await expect(trigger).toHaveAttribute("aria-expanded", "true");
          await expect(
            page.locator("#authorized-navigation-crm-simulation a").first(),
          ).toBeFocused();
          await assertLinks(page, "authorized-navigation-crm-simulation", simulationLinks, route);
          await assertDisabledItems(page, "authorized-navigation-crm-simulation", []);
          await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
          stage = "switch-disclosure-by-pointer";
          await settings.click();
          await expect(simulation).toHaveAttribute("aria-expanded", "false");
          await expect(page.locator("#authorized-navigation-crm-simulation")).toBeHidden();
          await expect(settings).toHaveAttribute("aria-expanded", "true");
          await expect(nav).toBeVisible();
          await assertLinks(page, "authorized-navigation-crm-settings", settingsLinks, route);
          await assertDisabledItems(page, "authorized-navigation-crm-settings", []);
          await assertOpenNavigationGeometry(page);
          stage = "dashboard-disclosure-and-authorized-links";
          await dashboard.click();
          await expect(settings).toHaveAttribute("aria-expanded", "false");
          await expect(page.locator("#authorized-navigation-crm-settings")).toBeHidden();
          await expect(dashboard).toHaveAttribute("aria-expanded", "true");
          await assertLinks(page, "authorized-navigation-crm-dashboard", dashboardLinks, route);
          await assertDisabledItems(page, "authorized-navigation-crm-dashboard", []);
          await assertOpenNavigationGeometry(page);
          stage = "escape-order";
          await page.keyboard.press("Escape");
          await expect(dashboard).toHaveAttribute("aria-expanded", "false");
          await expect(page.locator("#authorized-navigation-crm-dashboard")).toBeHidden();
          await assertNavigationControlFocused(dashboard, "authorized-navigation-crm-dashboard");
          if (compact) {
            await expect(trigger).toHaveAttribute("aria-expanded", "true");
            await page.keyboard.press("Escape");
            await expect(nav).toBeHidden();
            await expect(trigger).toBeFocused();
            stage = "outside-pointer-and-focus";
            await page.keyboard.press("Space");
            await expect(nav).toBeVisible();
            await accountTrigger(page).focus();
            await expect(nav).toBeHidden();
            await ensureArchiveNavigationOpen(page);
            await brand.focus();
            await expect(nav).toBeHidden();
            await ensureArchiveNavigationOpen(page);
            await page.mouse.click(1, viewport.height - 1);
            await expect(nav).toBeHidden();
          }
          stage = "account-keyboard-and-identity";
          const account = accountTrigger(page);
          await account.focus();
          await page.keyboard.press("Space");
          await expect(account).toHaveAttribute("aria-expanded", "true");
          const accountPanel = page.locator("#protected-account-menu");
          await expect(accountPanel).toBeVisible();
          const securityLink = accountPanel.getByRole("link", { name: /Segurança/ });
          await expect(securityLink).toHaveAttribute("href", "/conta/seguranca");
          await page.keyboard.press("Tab");
          await expect(securityLink).toBeFocused();
          const accountLinks = await accountPanel
            .getByRole("link")
            .evaluateAll((links) => links.map((link) => link.getAttribute("href")).sort());
          assert.deepEqual(
            accountLinks,
            ["/admin", "/admin/paginas", "/admin/usuarios", "/conta/seguranca"],
            "Master account menu must expose only its authorized account and admin links",
          );
          check.exactAuthorizedAccountNavigation = true;
          assert.equal(
            await accountPanel.evaluate(
              (element) =>
                element.scrollWidth <= element.clientWidth + 1 &&
                document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            ),
            true,
            "Long account identity must not create horizontal overflow",
          );
          await page.keyboard.press("Escape");
          await expect(accountPanel).toBeHidden();
          await expect(account).toBeFocused();
          if (scope === "header-and-content") {
            stage = "resize-preserves-content-focus";
            const stock = page.locator(".investor-stock-results");
            await page.setViewportSize({ width: 1181, height: 900 });
            await stock.focus();
            await page.setViewportSize({ width: 1180, height: 900 });
            await expect(stock).toBeFocused();
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          }
          stage = "resize-reset";
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(nav).toBeVisible();
          await simulation.click();
          await expect(page.locator("#authorized-navigation-crm-simulation")).toBeVisible();
          await page.locator("#authorized-navigation-crm-simulation a").first().focus();
          await page.setViewportSize({ width: 1180, height: 900 });
          await expect(nav).toBeHidden();
          await expect(trigger).toBeFocused();
          await expect(simulation).toHaveAttribute("aria-expanded", "false");
          await ensureArchiveNavigationOpen(page);
          await simulation.click();
          await page.locator("#authorized-navigation-crm-simulation a").first().focus();
          stage = "resize-simulation-link-to-desktop";
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(nav).toBeVisible();
          await expect(page.locator("#authorized-navigation-crm-simulation")).toBeHidden();
          await assertNavigationControlFocused(simulation, "authorized-navigation-crm-simulation");
          await expect(trigger).toHaveAttribute("aria-expanded", "false");
          stage = "resize-settings-link-to-desktop";
          await page.setViewportSize({ width: 1180, height: 900 });
          await ensureArchiveNavigationOpen(page);
          await settings.click();
          await page.locator("#authorized-navigation-crm-settings a").first().focus();
          await page.setViewportSize({ width: 1181, height: 900 });
          await expect(page.locator("#authorized-navigation-crm-settings")).toBeHidden();
          await assertNavigationControlFocused(settings, "authorized-navigation-crm-settings");
          stage = "resize-mobile-trigger-to-desktop";
          await page.setViewportSize({ width: 1180, height: 900 });
          await expect(trigger).toBeFocused();
          await page.setViewportSize({ width: 1181, height: 900 });
          await assertNavigationControlFocused(dashboard, "authorized-navigation-crm-dashboard");
          await expect(trigger).toBeHidden();
          stage = "navigate-and-brand";
          await page.setViewportSize(viewport);
          await ensureArchiveNavigationOpen(page);
          await simulation.click();
          const destination =
            archiveNavigationRoutes[
              (archiveNavigationRoutes.indexOf(route) + 1) % archiveNavigationRoutes.length
            ];
          await page
            .locator(`#authorized-navigation-crm-simulation a[href="${destination}"]`)
            .click();
          await expect(page).toHaveURL(`${origin}${destination}`);
          await expect(appearance(page)).toBeVisible();
          if (compact) await expect(navigation(page)).toBeHidden();
          await page.locator('[data-protected-brand][href="/app"]').click();
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
          const runtimeDiagnostics = await inspectArchiveNavigationFailure(page).catch(() => ({
            unavailable: true,
          }));
          check.diagnostics = {
            ...runtimeDiagnostics,
            ...(error?.safeDiagnostics ? { assertion: error.safeDiagnostics } : {}),
          };
        }
        check.runtimeErrorCount = runtimeErrors.length - errorStart;
        await onCheck(check, page);
      }
    }
    result.passed = archiveNavigationPassed(result, { scope });
    return result;
  } finally {
    page.off("pageerror", onError);
    page.off("console", onConsole);
    if (rotatingPages && !page.isClosed()) await page.close({ runBeforeUnload: false });
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
