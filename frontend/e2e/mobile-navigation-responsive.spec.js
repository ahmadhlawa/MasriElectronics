import { expect, test } from "@playwright/test";
import { navLinks } from "../src/store.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = [];
    if (path.endsWith("/store/settings")) {
      body = { store_name_ar: "المصري للأدوات الكهربائية", whatsapp: "0590000000", maintenance_mode: false };
    } else if (path.endsWith("/categories")) {
      body = [{ id: 1, name: "ثلاجات", slug: "fridges", product_count: 3, image_url: "/branding/logo-without-name.png",
        children: [{ id: 2, name: "ثلاجات صغيرة", slug: "small-fridges", product_count: 1 }] }];
    } else if (path.includes("/products")) {
      body = { items: [], total: 0, page: 1, pages: 0, page_size: 24 };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
});

test("mobile drawer uses only navbar links and preserves keyboard, close and navigation behavior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "فتح القائمة" });
  const menu = page.getByRole("dialog", { name: "قائمة التنقّل" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const links = menu.locator(".vs-menu a");
  await expect(links).toHaveText(navLinks.map((link) => link.label));
  expect(await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))))
    .toEqual(navLinks.map((link) => link.href));
  await expect(menu.locator('a[href^="/category/"], a[href="/categories"], button[aria-expanded], img')).toHaveCount(0);
  await expect(menu.getByText("ثلاجات", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("ثلاجات صغيرة", { exact: true })).toHaveCount(0);
  const close = menu.getByRole("button", { name: "إغلاق" });
  const support = menu.getByRole("link", { name: "تواصل عبر واتساب" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(support).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  for (const link of navLinks) {
    await trigger.click();
    await menu.getByRole("link", { name: link.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${link.href === "/" ? "/" : link.href}$`));
    await expect(menu).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  }
  await trigger.click();
  await close.click();
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("navigation", { name: "تنقّل سريع" })).toBeVisible();
});

test("floating WhatsApp only mounts on desktop, responds to resizing and keeps footer support", async ({ page }) => {
  for (const width of [1440, 900, 899, 768, 390, 320, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const floating = page.locator(".vs-wa");
    await expect(floating).toHaveCount(width >= 900 ? 1 : 0);
    if (width >= 900) {
      await expect(floating).toBeVisible();
      await expect(floating).toHaveAttribute("href", /^https:\/\/wa\.me\/0590000000\?text=/);
      await expect(floating).toHaveAttribute("target", "_blank");
    }
    await expect(page.getByRole("contentinfo").locator('a[href^="https://wa.me/"]')).toHaveCount(1);
  }
});

test("desktop support clears purchase controls and retains deliberate keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const floating = page.locator(".vs-wa");
  await expect(floating).toBeVisible();
  const cover = () => page.evaluate(() => {
    const box = document.querySelector(".vs-wa").getBoundingClientRect();
    const button = document.createElement("button");
    button.id = "qa-purchase-overlap";
    button.textContent = "QA purchase control";
    Object.assign(button.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`, zIndex: "1" });
    button.addEventListener("click", () => { button.dataset.clicked = "true"; });
    document.querySelector(".vs-main").append(button);
  });
  await cover();
  await expect(floating).toBeHidden();
  await page.locator("#qa-purchase-overlap").click();
  await expect(page.locator("#qa-purchase-overlap")).toHaveAttribute("data-clicked", "true");
  await page.locator("#qa-purchase-overlap").evaluate((node) => node.remove());
  await expect(floating).toBeVisible();
  await floating.focus();
  await cover();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(floating).toBeVisible();
  await expect(floating).toBeFocused();
  await page.locator("#qa-purchase-overlap").focus();
  await expect(floating).toBeHidden();
  await page.locator("#qa-purchase-overlap").evaluate((node) => node.remove());
  await expect(floating).toBeVisible();
});
