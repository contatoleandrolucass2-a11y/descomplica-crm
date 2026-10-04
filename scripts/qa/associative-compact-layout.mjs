import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export function assertAssociativeWorkspaceGaps({ sideBySide, gap, paddingLeft, paddingRight }) {
  assert.ok(Math.abs(paddingLeft - paddingRight) <= 1, "Flow must have equal horizontal padding");
  if (sideBySide) {
    assert.ok(gap >= 22 && gap <= 28, "Desktop workspace needs a 22-28px central gap");
    assert.ok(Math.abs(gap - paddingLeft) <= 1, "Central gap must equal the flow padding");
  }
}

export async function checkAssociativeWorkspaceGaps(page) {
  const geometry = await page
    .locator(".investor-associative-table-page .investor-associative-workspace")
    .evaluate((workspace) => {
      const ledger = workspace
        .querySelector(".investor-associative-ledger")
        .getBoundingClientRect();
      const results = workspace
        .querySelector(".investor-associative-results-stack")
        .getBoundingClientRect();
      const style = getComputedStyle(workspace.closest(".investor-flow-form"));
      return {
        sideBySide: results.left >= ledger.right,
        gap: results.left - ledger.right,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
      };
    });
  assertAssociativeWorkspaceGaps(geometry);
  return geometry;
}

async function stockRowIsGold(row) {
  return row.evaluate((element) => {
    const rowStyle = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    context.fillStyle = rowStyle.getPropertyValue("--associative-selection-gold").trim();
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return (
      rowStyle.backgroundImage.includes("linear-gradient(90deg,") &&
      rowStyle.backgroundImage.includes(`rgb(${r}, ${g}, ${b})`) &&
      [...element.cells].every((cell) => {
        const style = getComputedStyle(cell);
        return (
          style.backgroundColor === "rgba(0, 0, 0, 0)" &&
          style.backgroundImage === "none" &&
          style.color === rowStyle.color
        );
      })
    );
  });
}

export async function checkAssociativeSelectedGoldPaint(page) {
  const selected = page.locator(
    '.investor-associative-table-page .investor-stock-table tr[aria-selected="true"]',
  );
  await expect(selected).toHaveCount(1);
  await expect
    .poll(() => stockRowIsGold(selected), {
      message: "Selected row must remain gold without hover or focus",
    })
    .toBe(true);
}

export function assertAssociativeSummaryGaps({
  separation,
  decreasingGaps,
  linearBottomRule,
  decreasingTopRule,
}) {
  assert.ok(
    separation >= 4 && separation <= 12,
    "Linear needs a small 4-12px gap before Decrescente",
  );
  assert.equal(decreasingGaps.length, 3, "All four decreasing blocks must be present");
  assert.ok(
    decreasingGaps.every((gap) => gap >= -1 && gap <= 1),
    "The four decreasing blocks must remain together",
  );
  for (const [name, rule] of [
    ["Linear bottom", linearBottomRule],
    ["Decrescente top", decreasingTopRule],
  ]) {
    assert.ok(
      rule && rule.width >= 1 && !["none", "hidden"].includes(rule.style) && rule.alpha > 0,
      `${name} must have a visible separating rule`,
    );
  }
}

export function assertAssociativeCommissionGeometry(geometry) {
  assert.ok(
    geometry.summarySibling &&
      !geometry.insideSummary &&
      !geometry.insideTable &&
      !geometry.insideCell &&
      geometry.lastRowIsDecreasing10 &&
      geometry.insideWidth,
    "Commission must be a summary sibling outside the section, table and date cells",
  );
  assert.ok(
    geometry.layoutDisplay === "grid" &&
      geometry.columns.length === 1 &&
      geometry.columns[0] > 0 &&
      geometry.layoutGap === 0 &&
      geometry.tableGap >= 4 &&
      geometry.dateCenterDelta <= 1 &&
      geometry.summaryFitsColumn &&
      geometry.insideLayout,
    `Summary must retain full width with commission beside the table, centered on the last date: ${JSON.stringify(geometry)}`,
  );
  assert.ok(
    geometry.summaryEdgesAligned && geometry.rightDelta >= 3 && geometry.rightDelta <= 5,
    "Summary edges must align with approval and contain the commission gutter",
  );
  assert.ok(!geometry.overlaps, "Commission must not overlap dates, values or adjacent content");
  assert.ok(
    geometry.iconOnly && geometry.iconSize > 0 && geometry.iconSize <= 17,
    "Commission must render only its dollar icon at no more than 17px",
  );
  assert.ok(
    [24, 44].includes(geometry.minimumTarget) &&
      geometry.width === geometry.minimumTarget &&
      geometry.height === geometry.minimumTarget,
    "Commission action must retain its pointer-specific target size",
  );
  assert.ok(
    geometry.borderless && geometry.transparent,
    `Commission must remain icon-only without a button box: ${JSON.stringify(geometry)}`,
  );
}

export async function checkAssociativeSummaryGeometry(page) {
  const table = page.locator(
    ".investor-associative-table-page .investor-associative-payment-table",
  );
  await expect(table.locator(".is-linear")).toHaveCount(1);
  await expect(table.locator(".is-decreasing")).toHaveCount(4);
  const geometry = await table.evaluate((element) => {
    const linear = element.querySelector(".is-linear");
    const blocks = [...element.querySelectorAll(".is-decreasing")];
    const rects = blocks.map((row) => row.getBoundingClientRect());
    const rule = (row, side) => {
      const style = getComputedStyle(row);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      context.fillStyle = style[`border${side}Color`];
      context.fillRect(0, 0, 1, 1);
      return {
        width: Number.parseFloat(style[`border${side}Width`]),
        style: style[`border${side}Style`],
        alpha: context.getImageData(0, 0, 1, 1).data[3],
      };
    };
    return {
      separation: rects[0].top - linear.getBoundingClientRect().bottom,
      decreasingGaps: rects.slice(1).map((rect, index) => rect.top - rects[index].bottom),
      linearBottomRule: rule(linear, "Bottom"),
      decreasingTopRule: rule(blocks[0], "Top"),
    };
  });
  assertAssociativeSummaryGaps(geometry);
  return geometry;
}

export async function checkAssociativeCommissionGeometry(commission) {
  const geometry = await commission.evaluate((button) => {
    const layout = button.closest(".investor-associative-payment-summary-layout");
    const summary = layout?.querySelector(":scope > section.investor-associative-payment-summary");
    const row = summary?.querySelector(".is-decreasing:last-child");
    const date = row?.querySelector(".investor-associative-payment-last-date > time");
    const tableRect = summary
      ?.querySelector(".investor-associative-payment-table")
      ?.getBoundingClientRect();
    const dateRect = date?.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const contains = (element) => {
      if (!element?.contains(button)) return false;
      const outer = element.getBoundingClientRect();
      return (
        rect.left >= outer.left &&
        rect.right <= outer.right &&
        rect.top >= outer.top &&
        rect.bottom <= outer.bottom
      );
    };
    const textBounds = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect();
    };
    const icon = button.querySelector('span[aria-hidden="true"]');
    const style = getComputedStyle(button);
    const layoutStyle = layout ? getComputedStyle(layout) : null;
    const columns = layoutStyle?.gridTemplateColumns.split(" ").map(Number.parseFloat) ?? [];
    const summaryRect = summary?.getBoundingClientRect();
    const layoutRect = layout?.getBoundingClientRect();
    const approvalRect = layout
      ?.closest(".investor-associative-results-stack")
      ?.querySelector(".investor-associative-approval")
      ?.getBoundingClientRect();
    // Text ranges exclude blank grid space, but detect overlap with any rendered value/date.
    const content = [
      ...document.querySelectorAll(
        '.investor-associative-payment-table [role="cell"], .investor-associative-payment-table [role="rowheader"], .investor-associative-documentation-strip, .investor-associative-compact-account',
      ),
    ].filter((element) => element.checkVisibility() && !element.contains(button));
    if (date) content.push(date);
    return {
      width: rect.width,
      height: rect.height,
      minimumTarget: matchMedia("(pointer: coarse)").matches ? 44 : 24,
      summarySibling: Boolean(summary && button.parentElement === summary.parentElement),
      insideSummary: Boolean(button.closest(".investor-associative-payment-summary")),
      insideTable: Boolean(button.closest('[role="table"], table')),
      insideCell: Boolean(button.closest('[role="cell"], td, th')),
      lastRowIsDecreasing10: /Decrescente\s+10%/u.test(
        row?.querySelector('[role="rowheader"]')?.textContent ?? "",
      ),
      layoutDisplay: layoutStyle?.display,
      columns,
      layoutGap: Number.parseFloat(layoutStyle?.columnGap),
      tableGap: tableRect ? rect.left - tableRect.right : -1,
      dateCenterDelta: dateRect
        ? Math.abs(rect.top + rect.height / 2 - dateRect.top - dateRect.height / 2)
        : Infinity,
      summaryFitsColumn: Boolean(
        summaryRect &&
        layoutRect &&
        Math.abs(summaryRect.width - columns[0]) <= 1 &&
        Math.abs(summaryRect.left - layoutRect.left) <= 1,
      ),
      insideLayout: contains(layout),
      insideWidth: rect.left >= 0 && rect.right <= innerWidth,
      summaryEdgesAligned: Boolean(
        summaryRect &&
        approvalRect &&
        Math.abs(summaryRect.left - approvalRect.left) <= 1 &&
        Math.abs(summaryRect.right - approvalRect.right) <= 1,
      ),
      rightDelta: summaryRect ? Math.abs(rect.right - summaryRect.right) : Infinity,
      overlaps: content.some((element) => {
        const other = textBounds(element);
        return (
          rect.left < other.right &&
          rect.right > other.left &&
          rect.top < other.bottom &&
          rect.bottom > other.top
        );
      }),
      iconOnly: button.textContent.trim() === "$" && Boolean(icon),
      iconSize: icon ? Number.parseFloat(getComputedStyle(icon).fontSize) : 0,
      borderless:
        [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].every((width) => Number.parseFloat(width) === 0) && style.boxShadow === "none",
      transparent: style.backgroundColor === "rgba(0, 0, 0, 0)" && style.backgroundImage === "none",
    };
  });
  assertAssociativeCommissionGeometry(geometry);
  return geometry;
}

export async function checkProtectedTopbar(page) {
  await expect(page.locator("[data-protected-topbar]")).toHaveCount(1);
  const result = await page.locator("[data-protected-topbar]").evaluate((header) => {
    const group = header.querySelector('[role="group"][aria-label="Aparência da página"]');
    const controls = [group, ...group.querySelectorAll("button")];
    const selected = group.querySelector('[aria-pressed="true"]');
    return {
      height: header.getBoundingClientRect().height,
      maximumHeight: innerWidth <= 600 ? 100 : 56,
      controlsContained: controls.every((element) => {
        const control = element.getBoundingClientRect();
        const bounds = header.getBoundingClientRect();
        return (
          control.width > 0 &&
          control.height > 0 &&
          control.left >= bounds.left - 1 &&
          control.right <= bounds.right + 1 &&
          control.top >= bounds.top - 1 &&
          control.bottom <= bounds.bottom + 1
        );
      }),
      touchTargets: [...group.querySelectorAll("button")].every(
        (button) => button.getBoundingClientRect().height >= 44,
      ),
      selectedCued:
        selected instanceof HTMLElement &&
        getComputedStyle(selected).boxShadow !== "none" &&
        selected.getAttribute("aria-pressed") === "true",
    };
  });
  assert.ok(
    result.height <= result.maximumHeight,
    "Protected topbar must have compact vertical spacing",
  );
  assert.ok(result.controlsContained, "Theme controls must remain inside the protected topbar");
  assert.ok(result.touchTargets, "Theme controls must retain 44px touch targets");
  assert.ok(result.selectedCued, "Selected theme must not depend on color alone");
  return result;
}

export async function checkAssociativeCompactStock(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const hero = await page.locator(".investor-associative-hero").evaluate((element) => {
    const bounds = (selector) => document.querySelector(selector).getBoundingClientRect();
    const protectedTopbar = bounds("[data-protected-topbar]");
    const protectedContent = bounds("[data-protected-main-content]");
    const main = bounds(".investor-main");
    const breadcrumb = document.querySelector('nav[aria-label="Breadcrumb"]');
    const breadcrumbBounds = breadcrumb?.getBoundingClientRect();
    const title = bounds(".investor-hero-title h1");
    const titleRow = bounds(".investor-hero-title");
    const guide = bounds(".investor-hero-guide");
    const hint = bounds(".investor-hero-title .investor-info-mark");
    const button = bounds(".investor-hero-guide .investor-guided-start");
    const buttonElement = document.querySelector(".investor-hero-guide .investor-guided-start");
    const label = document.createRange();
    label.selectNodeContents(buttonElement);
    const stacked = getComputedStyle(element).gridTemplateColumns.split(" ").length === 1;
    return {
      titleContentInset: title.top - main.top,
      titleBelowProtectedTopbar: title.top >= protectedTopbar.bottom - 1,
      titleInsideProtectedContent:
        title.top >= protectedContent.top - 1 && title.bottom <= protectedContent.bottom + 1,
      titleBelowBreadcrumb: !breadcrumbBounds || title.top >= breadcrumbBounds.bottom - 1,
      stacked,
      guideTopGap: stacked ? guide.top - titleRow.bottom : guide.top - titleRow.top,
      buttonHeight: button.height,
      expectedButtonHeight: matchMedia("(pointer: coarse)").matches ? 44 : 32,
      buttonFits: button.bottom <= element.getBoundingClientRect().bottom,
      buttonExtraWidth: button.width - label.getBoundingClientRect().width,
      hintCentered: Math.abs((hint.top + hint.bottom - title.top - title.bottom) / 2) <= 2,
      guideLabelRemoved: !element.querySelector(".investor-hero-guide-information small"),
    };
  });
  assert.ok(
    Math.abs(hero.titleContentInset - 8) <= 1,
    "Title must keep the compact inset of the simulator content",
  );
  assert.ok(hero.titleBelowProtectedTopbar, "Title must not overlap the protected topbar");
  assert.ok(hero.titleInsideProtectedContent, "Title must remain inside protected content");
  assert.ok(hero.titleBelowBreadcrumb, "Title must not overlap the authorized breadcrumb");
  assert.ok(
    Math.abs(hero.guideTopGap - (hero.stacked ? 8 : 0)) <= 1,
    "Guide must align with the local simulator heading without excess gaps",
  );
  assert.equal(
    hero.buttonHeight,
    hero.expectedButtonHeight,
    "Guide button must be compact and touch-aware",
  );
  assert.ok(hero.buttonFits, "Guide button must remain inside the heading section");
  assert.ok(hero.buttonExtraWidth <= 28, "Guide outline must fit the label with compact padding");
  assert.ok(hero.hintCentered, "Title help icon must be centered on the same line");
  assert.ok(hero.guideLabelRemoved, "Redundant guide label must be removed");
  const header = await page.locator(".investor-stock-panel").evaluate((panel) => {
    const bounds = (selector) => panel.querySelector(selector).getBoundingClientRect();
    const heading = bounds(":scope > header");
    const title = bounds("#investor-stock-title");
    const hint = bounds(".investor-stock-title-row .investor-info-mark");
    const clear = bounds(".investor-stock-clear");
    const sync = bounds(".investor-stock-sync");
    const filters = bounds(".investor-stock-filters");
    const first = bounds(".investor-stock-filters > label");
    return {
      hintCentered: Math.abs((hint.top + hint.bottom - title.top - title.bottom) / 2) <= 2,
      metadataLeftOfClear: sync.right <= clear.left,
      clearInsideHeader: clear.top >= heading.top && clear.bottom <= heading.bottom,
      filterHeadingRemoved: !panel.querySelector(".investor-filter-heading"),
      filterGap: first.top - heading.bottom,
      noEmptyFilterRow: first.top - filters.top <= 6,
    };
  });
  assert.ok(header.hintCentered, "Stock help icon must align with Escolha a unidade");
  assert.ok(header.metadataLeftOfClear, "Stock count and update must stay left of clear action");
  assert.ok(header.clearInsideHeader, "Clear action must be inside the stock header");
  assert.ok(header.filterHeadingRemoved, "Redundant filter heading must be removed");
  assert.ok(
    header.filterGap >= 0 && header.filterGap <= 12,
    "Filters must follow the divider closely",
  );
  assert.ok(header.noEmptyFilterRow, "Removed heading must not leave an empty grid row");
  const stock = page.locator(".investor-associative-table-page .investor-stock-results");
  const rows = stock.locator("tbody tr[aria-rowindex]");
  await expect(rows.first()).toBeAttached();
  await stock.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(rows.first()).toHaveAttribute("aria-rowindex", "2");
  const geometry = await stock.evaluate((element) => {
    const rows = [...element.querySelectorAll("tbody tr[aria-rowindex]")];
    const first = rows[0].getBoundingClientRect();
    const end = element.getBoundingClientRect().top + element.clientTop + element.clientHeight;
    const heading = document.querySelector(".investor-hero-title h1");
    return {
      rowHeight: first.height,
      expectedRowHeight: innerWidth <= 760 ? 48 : 26,
      visibleRows: rows.filter((row) => row.getBoundingClientRect().bottom <= end + 1).length,
      tenthRowEndDelta: Math.abs(rows[9].getBoundingClientRect().bottom - end),
      headingSizeRem:
        Number.parseFloat(getComputedStyle(heading).fontSize) /
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      expectedHeadingRem: innerWidth <= 760 ? 1.475 : 2,
      headingTracking: getComputedStyle(heading).letterSpacing,
      totalRows: Number(element.querySelector("table").getAttribute("aria-rowcount")),
    };
  });
  assert.equal(geometry.rowHeight, geometry.expectedRowHeight, "Virtual row height must match CSS");
  assert.equal(geometry.visibleRows, 10, "Stock viewport must expose exactly ten units");
  assert.ok(geometry.tenthRowEndDelta <= 2, "Stock viewport must end at the tenth row");
  assert.ok(
    Math.abs(geometry.headingSizeRem - geometry.expectedHeadingRem) < 0.001,
    "Associative heading must use the reduced fixed type size",
  );
  assert.ok(
    ["normal", "0px"].includes(geometry.headingTracking),
    "Heading must have zero letter spacing",
  );

  await stock.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(rows.last()).toHaveAttribute("aria-rowindex", String(geometry.totalRows));
  await stock.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(rows.first()).toHaveAttribute("aria-rowindex", "2");
  const firstRow = rows.first();
  const goldRow = () => stockRowIsGold(firstRow);
  await firstRow.hover();
  await expect
    .poll(goldRow, { message: "Entire hovered row must be gold with dark readable text" })
    .toBe(true);
  await page.mouse.move(0, 0);
  await firstRow.getByRole("button").focus();
  await expect
    .poll(goldRow, { message: "Keyboard focus must receive the same gold row highlight" })
    .toBe(true);
  await stock.focus();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  return { ...geometry, hero, header, allInventoryReachable: true, goldHoverAndFocus: true };
}

// Keep the imported CI entry point stable; the selection contract is now metallic gold.
export async function checkAssociativeSelectedGold(page) {
  const stock = page.locator(".investor-associative-table-page .investor-stock-results");
  const first = stock.locator("tbody tr.selectable[aria-rowindex]").first();
  const wasSelected = (await first.getAttribute("aria-selected")) === "true";
  await first.getByRole("button").click();
  await expect(first).toHaveAttribute("aria-selected", "true");
  if (!wasSelected) await expect(page.locator(".investor-associative-qualification")).toBeFocused();
  await page.mouse.move(0, 0);
  await stock.focus();
  await checkAssociativeSelectedGoldPaint(page);
  await expect(first.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  const filters = page.locator(".investor-stock-filters");
  const count = await stock.locator("table").getAttribute("aria-rowcount");
  const developer = filters.locator(":scope > label").first().getByRole("combobox");
  await developer.selectOption({ index: 1 });
  await expect(stock.locator("table")).not.toHaveAttribute("aria-rowcount", count);
  await filters.getByLabel("Ordenar unidades por valor do imóvel").selectOption("desc");
  await page.locator(".investor-stock-clear").click();
  await expect(developer).toHaveValue("Todas");
  await expect(filters.getByLabel("Ordenar unidades por valor do imóvel")).toHaveValue("asc");
  await expect(stock.locator("table")).toHaveAttribute("aria-rowcount", count);
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".investor-associative-qualification")).toBeVisible();
  const proposalGuideFits = await page
    .locator(".investor-associative-flow-panel > header")
    .evaluate((header) => {
      const bounds = header.getBoundingClientRect();
      const guide = header.querySelector(".investor-guided-start").getBoundingClientRect();
      const title = header.querySelector("h2").getBoundingClientRect();
      return (
        guide.top >= bounds.top &&
        guide.bottom <= bounds.bottom &&
        guide.left >= bounds.left &&
        guide.right <= bounds.right &&
        (guide.left >= title.right || guide.top >= title.bottom)
      );
    });
  assert.ok(
    proposalGuideFits,
    "Proposal guide must fit its header without overlapping title or following content",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

export async function checkAssociativeClosingAlignment(page) {
  const result = await page.locator(".investor-page-closing").evaluate((closing) => {
    const disclaimer = closing.querySelector(".simulation-disclaimer").getBoundingClientRect();
    const footer = closing.querySelector(".investor-page-footer").getBoundingClientRect();
    const stacked = innerWidth <= 760;
    return {
      display: getComputedStyle(closing).display,
      stacked,
      topDelta: Math.abs(disclaimer.top - footer.top),
      stackedWithoutOverlap: footer.top >= disclaimer.bottom,
    };
  });
  assert.equal(result.display, "grid", "Associative closing content must share one grid");
  if (result.stacked) {
    assert.ok(result.stackedWithoutOverlap, "Mobile closing content must stack without overlap");
  } else {
    assert.ok(result.topDelta <= 1, "Right footer copy must align with the left disclaimer");
  }
  return result;
}

export async function checkAssociativeInitialViewport(page) {
  const result = await page.locator(".investor-main").evaluate((main) => {
    const footer = main.querySelector(".investor-page-closing").getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      initial: !main.querySelector(".investor-associative-qualification"),
      overflow: document.documentElement.scrollHeight - innerHeight,
      footerBottom: footer.bottom,
      clipping: [document.documentElement, document.body, main].some((element) =>
        ["hidden", "clip"].includes(getComputedStyle(element).overflowY),
      ),
    };
  });
  assert.ok(result.initial, "Initial viewport check must run before selecting a unit");
  if (
    (result.width >= 1180 && result.height >= 560) ||
    (result.width >= 768 && result.height >= 768)
  ) {
    assert.ok(result.overflow <= 1, "Initial desktop must fit without whole-page scrolling");
    assert.ok(result.footerBottom <= result.height, "Footer must remain visible, not clipped");
    assert.ok(!result.clipping, "Fitting the page must not hide overflowing content");
  }
  return result;
}
