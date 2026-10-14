import { expect, test } from "@playwright/test";

const categories = [
  { id: 1, slug: "fridges", name: "ثلاجات", image_url: null, parent_id: null, product_count: 3, sort_order: 0, children: [] },
  { id: 2, slug: "washers", name: "غسالات", image_url: null, parent_id: null, product_count: 3, sort_order: 1, children: [] },
  { id: 3, slug: "ac", name: "مكيفات", image_url: null, parent_id: null, product_count: 3, sort_order: 2, children: [] },
  { id: 4, slug: "stoves", name: "أفران", image_url: null, parent_id: null, product_count: 3, sort_order: 3, children: [] },
  { id: 5, slug: "screens", name: "شاشات", image_url: null, parent_id: null, product_count: 3, sort_order: 4, children: [] },
];

for (const [width, columns] of [[320, 2], [390, 2], [768, 3], [1440, 5]]) {
  test(`category tiles fit ${width}px with ${columns} columns`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/v1/categories", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(categories) });
    });
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: "كل الأقسام" })).toBeVisible();
    await expect(page.locator(".vs-categories-page__tile")).toHaveCount(5);
    const actual = await page.locator(".vs-categories-page__grid").evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(actual).toBe(columns);
    await expect(page.locator(".vs-categories-page__tile").first()).toHaveAttribute("href", "/category/fridges");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

for (const [width, columns, rows] of [[390, 2, 3], [768, 3, 2], [1440, 3, 2]]) {
  test(`six categories stay balanced at ${width}px and navbar icons stay separate`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/v1/categories", (route) => route.fulfill({ json: [
      ...categories,
      { ...categories[0], id: 6, slug: "small-appliances", name: "الأجهزة الصغيرة", sort_order: 5 },
    ] }));
    await page.goto("/categories");
    const grid = page.locator(".vs-categories-page__grid");
    await expect(grid.getByRole("link")).toHaveCount(6);
    const geometry = await grid.evaluate((node) => ({
      columns: getComputedStyle(node).gridTemplateColumns.split(" ").length,
      rowTops: [...new Set([...node.children].map((tile) => tile.getBoundingClientRect().top))],
      left: node.getBoundingClientRect().left, width: node.getBoundingClientRect().width,
      heights: [...node.querySelectorAll(".vs-categories-page__image")].map((image) => image.getBoundingClientRect().height),
    }));
    expect(geometry.columns).toBe(columns);
    expect(geometry.rowTops).toHaveLength(rows);
    expect(geometry.heights.every((height) => height <= 160)).toBe(true);
    if (width >= 900) {
      expect(geometry.width).toBeLessThanOrEqual(752);
      expect(geometry.left + geometry.width / 2).toBeCloseTo(width / 2, 0);
      const categoriesLink = page.getByRole("navigation", { name: "التنقّل الرئيسي" }).getByRole("link", { name: "كل الأقسام" });
      await expect(categoriesLink).toHaveAttribute("href", "/categories");
      await expect(categoriesLink.locator("svg rect")).toHaveCount(4);
      await categoriesLink.click();
      await expect(page).toHaveURL(/\/categories$/);
    } else {
      const hamburger = page.getByRole("button", { name: "فتح القائمة" });
      await expect(hamburger.locator("svg rect")).toHaveCount(0);
      await hamburger.click();
      await expect(page.getByRole("dialog", { name: "قائمة التنقّل" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
