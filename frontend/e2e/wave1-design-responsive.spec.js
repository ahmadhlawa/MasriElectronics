import { expect, test } from "@playwright/test";

const categories = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, name: `قسم ${index + 1}`, slug: `category-${index + 1}`,
  image_url: index === 1 ? null : index === 2 ? "/wave1/broken.svg" : "/wave1/logo.svg",
  parent_id: null, is_active: true, sort_order: index, product_count: 0, children: [],
}));

async function openHome(page, rows = categories) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = [];
    if (path.endsWith("/store/settings")) body = { store_name_ar: "المصري للأدوات الكهربائية", maintenance_mode: false };
    else if (path.endsWith("/categories")) body = rows;
    else if (path.endsWith("/hero-slides")) body = [{ id: 1, title: "عرض", image_url: "/wave1/logo.svg" }];
    else if (path.includes("/products")) body = { items: [], total: 0, page: 1, pages: 0, page_size: 24 };
    await route.fulfill({ json: body });
  });
  await page.route("**/wave1/*.svg", (route) => route.request().url().includes("broken")
    ? route.fulfill({ status: 404, body: "" })
    : route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="#ad8490"/></svg>' }));
  await page.goto("/");
  const strip = page.getByRole("region", { name: "تسوّق حسب التصنيف" });
  await expect(strip).toBeVisible();
  await strip.scrollIntoViewIfNeeded();
  return strip;
}

test("single RTL row, full-width hero, fallback and category links at every breakpoint", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const strip = await openHome(page);
    await expect(page.locator(".vs-catbar, .vs-catdrawer")).toHaveCount(0);
    await expect(page.locator(".vs-public")).toHaveCSS("padding-right", "0px");
    const hero = await page.locator(".vs-herorow").boundingBox();
    expect(hero.x).toBeCloseTo(0);
    expect(hero.width).toBeCloseTo(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(strip).toHaveCSS("direction", "rtl");
    await expect(strip.locator("img").first()).toHaveCSS("object-fit", "contain");
    await expect(strip.getByRole("link", { name: "قسم 2", exact: true })).toContainText("قسم 2");
    await expect(strip.getByRole("link", { name: "قسم 3", exact: true }).locator("img")).toHaveCount(0);
    const rows = await strip.locator(".vs-category-logos__group").first().locator("a").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().top));
    expect(new Set(rows).size).toBe(1);
    const positions = await strip.evaluate((element) => ({ start: element.scrollLeft, overflow: element.scrollWidth > element.clientWidth }));
    expect(positions.overflow).toBe(true);
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeLessThan(positions.start - 2);
    await strip.hover();
    const paused = await strip.evaluate((element) => element.scrollLeft);
    await page.waitForTimeout(150);
    expect(await strip.evaluate((element) => element.scrollLeft)).toBe(paused);
    const link = strip.getByRole("link", { name: "قسم 1", exact: true });
    await expect(link).toHaveAttribute("href", "/category/category-1");
    await link.click();
    await expect(page).toHaveURL(/\/category\/category-1$/);
  }
});

test("seamless wrap, keyboard pause, native manual scrolling and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const strip = await openHome(page);
  await page.mouse.move(0, 0);
  await strip.evaluate((element) => {
    const span = element.querySelector(".vs-category-logos__group").clientWidth;
    element.scrollLeft = -(span - 1);
  });
  // Restart from the chosen boundary, without hover/focus affecting the test.
  await page.getByRole("button", { name: "إيقاف حركة الأقسام" }).evaluate((button) => button.click());
  await page.getByRole("button", { name: "تشغيل حركة الأقسام" }).evaluate((button) => button.click());
  await expect.poll(() => strip.evaluate((element) => Math.abs(element.scrollLeft))).toBeLessThan(20);
  await strip.focus();
  const focused = await strip.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(150);
  expect(await strip.evaluate((element) => element.scrollLeft)).toBe(focused);
  // The browser eases keyboard scrolling independently of our autoplay loop.
  await Promise.all([
    strip.evaluate((element) => new Promise((resolve) => element.addEventListener("scrollend", resolve, { once: true }))),
    strip.press("ArrowLeft"),
  ]);
  await expect(page.getByRole("button", { name: "تشغيل حركة الأقسام" })).toBeVisible();
  await strip.evaluate((element) => { element.scrollLeft = -120; });
  await page.waitForTimeout(150);
  expect(await strip.evaluate((element) => element.scrollLeft)).toBe(-120);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(strip.locator('.vs-category-logos__group[aria-hidden="true"]')).toHaveCount(0);
  await expect(page.locator(".vs-category-logos__motion")).toHaveCount(0);
  await strip.evaluate((element) => { element.scrollLeft = -160; });
  await page.waitForTimeout(150);
  expect(await strip.evaluate((element) => element.scrollLeft)).toBe(-160);
});

test("a short category list stays still and mobile navigation remains available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const strip = await openHome(page, categories.slice(0, 2));
  await expect(strip.locator('.vs-category-logos__group[aria-hidden="true"]')).toHaveCount(0);
  await expect(page.locator(".vs-category-logos__motion")).toHaveCount(0);
  await page.waitForTimeout(150);
  expect(await strip.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  const menu = page.getByRole("dialog", { name: "قائمة التنقّل" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "كل المنتجات", exact: true }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(menu).toHaveCount(0);
});

test("touch swiping scrolls the RTL strip and stops automatic movement", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    const strip = await openHome(page);
    const box = await strip.boundingBox();
    const session = await context.newCDPSession(page);
    const start = await strip.evaluate((element) => element.scrollLeft);
    const y = box.y + box.height / 2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 60, y }] });
    for (const x of [100, 140, 180, 220, 260]) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + x, y }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeLessThan(start - 50);
    await expect(page.getByRole("button", { name: "تشغيل حركة الأقسام" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
  }
});
