import { expect, test } from "@playwright/test";

const child = { id: 20, name: "القلايات الهوائية", slug: "air-fryers", parent_id: 1, product_count: 1 };
const categories = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1, name: index === 0 ? "الأجهزة المنزلية" : `قسم ${index + 1}`, slug: `category-${index + 1}`,
  image_url: index === 1 ? null : index === 2 ? "/missing-category.png" : "/branding/logo-without-name.png",
  parent_id: null, is_active: true, product_count: 3, children: index === 0 ? [child] : [],
}));

for (const [width, columns] of [[320, 2], [390, 2], [768, 3], [1024, 4], [1440, 5]]) {
  test(`compact categories at ${width}px: artwork, fallback, focus, child navigation and mobile tab`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = [];
      if (path.endsWith("/store/settings")) body = { store_name_ar: "المصري للأدوات الكهربائية", maintenance_mode: false };
      else if (path.endsWith("/categories")) body = categories;
      else if (path.endsWith("/categories/category-1")) body = categories[0];
      else if (path.endsWith("/categories/air-fryers")) body = child;
      else if (path.includes("/products")) body = { items: [], total: 0, page: 1, pages: 0, page_size: 24 };
      await route.fulfill({ json: body });
    });
    await page.route("**/missing-category.png", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/categories");
    await expect(page.getByRole("heading", { level: 1, name: "كل الأقسام" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "مسار التصفح" })).toBeVisible();
    const grid = page.locator(".vs-categories-page__grid");
    const tiles = grid.getByRole("link");
    await expect(tiles).toHaveCount(categories.length);
    await expect(grid.locator(".vs-cat, nav")).toHaveCount(0);
    expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const image = tiles.first().locator("img");
    await expect(image).toHaveAttribute("src", "/branding/logo-without-name.png");
    await expect(image).toHaveCSS("object-fit", "contain");
    for (const index of [1, 2]) {
      await expect(tiles.nth(index).locator("img")).toHaveCount(0);
      await expect(tiles.nth(index).locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(tiles.nth(index)).toHaveAccessibleName(`${categories[index].name} — 3 منتجاً`);
    }
    const boxes = await grid.locator(".vs-categories-page__image").evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      return { width: box.width, height: box.height, bottom: box.bottom, labelTop: item.nextElementSibling.getBoundingClientRect().top };
    }));
    for (const box of boxes) {
      expect(box.width).toBeCloseTo(boxes[0].width, 0);
      expect(box.height).toBeCloseTo(boxes[0].height, 0);
      expect(box.height).toBeLessThanOrEqual(160);
      expect(box.labelTop).toBeGreaterThan(box.bottom);
    }
    const tab = page.locator('.vs-tabbar a[href="/categories"]');
    await expect(tab).toHaveAttribute("href", "/categories");
    await expect(tab).toHaveAttribute("aria-current", "page");
    await tiles.first().focus();
    await expect(tiles.first()).toBeFocused();
    await expect(tiles.first()).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/category\/category-1$/);
    const childLink = page.locator(".vs-cathead__subs").getByRole("link", { name: child.name });
    await expect(childLink).toBeVisible();
    await childLink.click();
    await expect(page).toHaveURL(/\/category\/air-fryers$/);
    if (width < 900) {
      await tab.click();
      await expect(page).toHaveURL(/\/categories$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "فتح القائمة" }).click();
      await expect(page.getByRole("dialog", { name: "قائمة التنقّل" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
}
