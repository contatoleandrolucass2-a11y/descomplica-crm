import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkCompactArchiveHeader(page) {
  const result = await page.locator("header:has(#archive-navigation)").evaluate((header) => {
    const group = header.querySelector('[role="group"][aria-label="Aparência da página"]');
    const controls = [group, ...group.querySelectorAll("button")];
    return {
      height: header.getBoundingClientRect().height,
      maximumHeight: innerWidth <= 600 ? 98 : 56,
      textAndIconsOnly: controls.every((element) => {
        const css = getComputedStyle(element);
        return (
          css.backgroundColor === "rgba(0, 0, 0, 0)" &&
          css.backgroundImage === "none" &&
          css.borderWidth === "0px" &&
          css.boxShadow === "none"
        );
      }),
      touchTargets: [...group.querySelectorAll("button")].every(
        (button) => button.getBoundingClientRect().height >= 44,
      ),
      selectedUnderlined: getComputedStyle(
        group.querySelector('[aria-pressed="true"]'),
      ).textDecorationLine.includes("underline"),
    };
  });
  assert.ok(result.height <= result.maximumHeight, "Header must have compact vertical spacing");
  assert.ok(result.textAndIconsOnly, "Theme selector must show text and icons without boxes");
  assert.ok(result.touchTargets, "Theme controls must retain 44px touch targets");
  assert.ok(result.selectedUnderlined, "Selected theme must not depend on color alone");
  return result;
}

export async function checkAssociativeCompactStock(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const hero = await page.locator(".investor-associative-hero").evaluate((element) => {
    const bounds = (selector) => document.querySelector(selector).getBoundingClientRect();
    const header = bounds("header:has(#archive-navigation)");
    const title = bounds(".investor-hero-title h1");
    const titleRow = bounds(".investor-hero-title");
    const guide = bounds(".investor-hero-guide");
    const hint = bounds(".investor-hero-title .investor-info-mark");
    const button = bounds(".investor-hero-guide .investor-guided-start");
    const stacked = getComputedStyle(element).gridTemplateColumns.split(" ").length === 1;
    return {
      titleTopGap: title.top - header.bottom,
      guideTopGap: guide.top - (stacked ? titleRow.bottom : header.bottom),
      buttonHeight: button.height,
      expectedButtonHeight: matchMedia("(pointer: coarse)").matches ? 44 : 32,
      buttonFits: button.bottom <= element.getBoundingClientRect().bottom,
      hintCentered: Math.abs((hint.top + hint.bottom - title.top - title.bottom) / 2) <= 2,
      guideLabelRemoved: !element.querySelector(".investor-hero-guide-information small"),
    };
  });
  assert.ok(Math.abs(hero.titleTopGap - 8) <= 1, "Title must sit close to the menu divider");
  assert.ok(Math.abs(hero.guideTopGap - 8) <= 1, "Guide must align at the top without excess gaps");
  assert.equal(
    hero.buttonHeight,
    hero.expectedButtonHeight,
    "Guide button must be compact and touch-aware",
  );
  assert.ok(hero.buttonFits, "Guide button must remain inside the heading section");
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
  const goldRow = () =>
    firstRow.evaluate((row) =>
      [...row.cells].every((cell) => {
        const css = getComputedStyle(cell);
        return css.backgroundColor === "rgb(233, 189, 84)" && css.color === "rgb(48, 33, 7)";
      }),
    );
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

export async function checkAssociativeSelectedGold(page) {
  const stock = page.locator(".investor-associative-table-page .investor-stock-results");
  const first = stock.locator("tbody tr.selectable[aria-rowindex]").first();
  const wasSelected = (await first.getAttribute("aria-selected")) === "true";
  await first.getByRole("button").click();
  await expect(first).toHaveAttribute("aria-selected", "true");
  if (!wasSelected) await expect(page.locator(".investor-associative-qualification")).toBeFocused();
  await page.mouse.move(0, 0);
  await stock.focus();
  await expect
    .poll(
      () =>
        first.evaluate((row) =>
          [...row.cells].every((cell) => {
            const css = getComputedStyle(cell);
            return (
              css.backgroundColor === "rgb(233, 189, 84)" &&
              css.backgroundImage === "none" &&
              css.color === "rgb(48, 33, 7)"
            );
          }),
        ),
      { message: "Selected row must remain gold without hover or focus" },
    )
    .toBe(true);
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
