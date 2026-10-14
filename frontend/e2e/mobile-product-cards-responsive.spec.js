import { expect, test } from "@playwright/test";

const product = {
  id: 1, name: "ثلاجة عائلية كبيرة بتقنية التبريد المتطور وتوفير الطاقة للمطبخ", slug: "family-fridge",
  product_type: "standard", sku: "RF-420", brand_name: "سامسونج", model_number: "RF-420",
  category_id: 1, category_name: "الأجهزة المنزلية", category_slug: "appliances",
  price: 4999, compare_at_price: 5999, stock_quantity: 3, track_inventory: true, in_stock: true,
  is_new: true, primary_image_url: "/branding/logo-without-name.png", images: [],
  card_attributes: [
    { key: "capacity", label: "السعة", type: "number", value: 420, unit: "لتر" },
    { key: "energy", label: "الطاقة", type: "enum", value: "a", option_label: "A+" },
    { key: "color", label: "اللون", type: "enum", value: "white", option_label: "أبيض" },
  ],
  specifications: [], options: [], variants: [], package_items: [],
};
const option = { ...product, id: 2, name: "غسالة بخيارات", slug: "washer-options", brand_name: null, model_number: null,
  sku: "WM-LONG-1234567890", compare_at_price: null, card_attributes: [], has_options: true,
  options: [{ id: 1, name: "اللون", sort_order: 0, values: [{ id: 11, value: "أبيض", sort_order: 0 }] }],
  variants: [{ id: 21, title: "أبيض", price_override: null, stock_quantity: 3, is_active: true, option_value_ids: [11] }],
};
const products = [product, option,
  { ...product, id: 3, name: "فرن غير متوفر", slug: "sold-out", in_stock: false, stock_quantity: 0 },
  { ...product, id: 4, name: "جهاز صغير", slug: "small-appliance", brand_name: null, model_number: null, sku: null,
    primary_image_url: null, card_attributes: [], compare_at_price: null },
];
const category = { id: 1, name: "الأجهزة المنزلية", slug: "appliances", image_url: null, product_count: 4, children: [] };

for (const width of [320, 390, 1440]) {
  test(`PLP cards stay readable and actionable at ${width}px without changing other surfaces`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = [];
      if (path.endsWith("/store/settings")) body = { store_name_ar: "المصري", maintenance_mode: false };
      else if (path.endsWith("/categories")) body = [category];
      else if (path.endsWith("/categories/appliances")) body = category;
      else if (path.endsWith("/products/washer-options")) body = option;
      else if (path.includes("/products")) body = { items: products, total: 4, page: 1, pages: 1, page_size: 12 };
      await route.fulfill({ json: body });
    });
    for (const path of ["/shop", "/category/appliances", "/offers", "/search?q=RF420"]) {
      await page.goto(path);
      const cards = page.locator(".vs-catalog .vs-card");
      await expect(cards).toHaveCount(4);
      const first = cards.nth(0);
      await expect(first.locator(".vs-card__brand")).toHaveText("سامسونج");
      await expect(first.locator(".vs-card__sku")).toContainText("RF-420");
      await expect(first.locator(".vs-card__specs li")).toHaveCount(2);
      await expect(first.locator(".vs-price__now")).toHaveText("4999 ₪");
      await expect(first.locator(".vs-price__was")).toHaveText("5999 ₪");
      await expect(first.locator(".vs-card__stock")).toHaveText("بقي 3 فقط");
      await expect(first.locator(".vs-card__badges > span")).toHaveCount(2);
      await expect(cards.nth(3).locator(".vs-media--fallback")).toHaveCount(1);
      await expect(cards.nth(3).locator(".vs-card__brand, .vs-card__sku, .vs-card__specs")).toHaveCount(0);
      for (const [index, compact, accessible] of [[0, "أضف للعربة", "أضف إلى العربة"], [1, "اختر الخيارات", "اختر الخيارات"], [2, "غير متوفر", "غير متوفر حالياً"]]) {
        const card = cards.nth(index);
        await card.scrollIntoViewIfNeeded();
        const button = card.getByRole("button", { name: accessible, exact: true });
        await expect(button).toBeVisible();
        if (index === 2) await expect(button).toBeDisabled();
        else await expect(button).toBeEnabled();
        await expect(card.locator(".vs-card__stock")).toBeVisible();
        if (width < 900) {
          await expect(button.locator(".vs-atc__label--mobile")).toBeVisible();
          await expect(button.locator(".vs-atc__label--mobile")).toHaveText(compact);
          await expect(button.locator(".vs-atc__label--desktop")).toBeHidden();
          const size = await button.evaluate((node) => ({ font: parseFloat(getComputedStyle(node).fontSize), width: node.clientWidth, scroll: node.scrollWidth }));
          expect(size.font).toBeGreaterThanOrEqual(13);
          expect(size.width).toBeGreaterThan(44);
          expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
        } else {
          await expect(button.locator(".vs-atc__label--mobile")).toBeHidden();
          await expect(button.locator(".vs-atc__label--desktop")).toBeVisible();
          await expect(button).toHaveCSS("font-size", "13px");
        }
      }
      const geometry = await cards.evaluateAll((items) => items.map((card) => {
        const title = card.querySelector(".vs-card__title");
        const image = card.querySelector(".vs-mediabox").getBoundingClientRect();
        return { titleHeight: title.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(title).lineHeight),
          imageRatio: image.width / image.height, ctaBottom: card.querySelector(".vs-card__cta").getBoundingClientRect().bottom };
      }));
      for (const box of geometry) {
        expect(box.titleHeight).toBeLessThanOrEqual(box.lineHeight * 2 + 1);
        expect(box.imageRatio).toBeCloseTo(1, 1);
      }
      if (width < 900) {
        expect(await page.locator(".vs-catalog .vs-grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(2);
        expect(geometry[0].ctaBottom).toBeCloseTo(geometry[1].ctaBottom, 0);
        const last = cards.last().locator(".vs-card__cta");
        await last.evaluate((node) => node.scrollIntoView({ block: "end" }));
        const lastBox = await last.boundingBox();
        expect(lastBox.y + lastBox.height)
          .toBeLessThanOrEqual((await page.locator(".vs-tabbar").boundingBox()).y);
        expect(await first.locator(".vs-price__now").evaluate((node) => parseFloat(getComputedStyle(node).fontSize)))
          .toBeGreaterThan(await first.locator(".vs-price__was").evaluate((node) => parseFloat(getComputedStyle(node).fontSize)));
      } else {
        await expect(first.locator(".vs-price__now")).toHaveCSS("font-size", "15px");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.goto("/shop");
    const cards = page.locator(".vs-catalog .vs-card");
    await cards.nth(1).getByRole("button", { name: "اختر الخيارات", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "نظرة سريعة" })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("masri_electronics_cart_v1") || "[]"))).toHaveLength(0);
    await page.keyboard.press("Escape");
    await cards.nth(0).getByRole("button", { name: "أضف إلى العربة", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "عربة التسوّق" })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("masri_electronics_cart_v1") || "[]")[0].qty)).toBe(1);
    await page.goto("/");
    const homeButton = page.locator(".vs-home .vs-card__cta").first();
    await expect(homeButton.locator(".vs-atc__label--mobile")).toBeHidden();
    if (width < 600) await expect(homeButton).toHaveCSS("font-size", "0px");
  });
}
