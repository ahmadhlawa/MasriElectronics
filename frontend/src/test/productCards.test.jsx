import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { page, productFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";
import { cartStorage } from "../storage/cartStorage.js";

const optionProduct = {
  ...productFixture,
  id: 2,
  name: "سكارف مطبوع",
  slug: "printed-scarf",
  price: 60,
  compare_at_price: null,
  has_options: true,
  options: [
    { id: 1, name: "المقاس", sort_order: 0, values: [{ id: 11, value: "صغير", sort_order: 0 }] },
  ],
  variants: [
    { id: 21, title: "صغير", sku: null, price_override: 70, stock_quantity: 3, is_active: true, option_value_ids: [11] },
    { id: 22, title: "كبير", sku: null, price_override: 90, stock_quantity: 2, is_active: true, option_value_ids: [11] },
  ],
};

const soldOutProduct = {
  ...productFixture,
  id: 3,
  name: "علبة هدية",
  slug: "gift-box",
  stock_quantity: 0,
  in_stock: false,
};

const packageProduct = {
  ...productFixture,
  id: 4,
  name: "باقة استقبال الزفاف",
  slug: "wedding-package",
  product_type: "package",
  price: 340,
  compare_at_price: 410,
  package_item_count: 3,
  package_items: [
    {
      id: 1,
      included_product_id: 1,
      included_product_name: "كرت دعوة",
      included_product_slug: "clear-resin",
      included_product_image_url: null,
      quantity: 2,
      display_note: null,
      sort_order: 0,
    },
  ],
};

const cardOf = async (name) => (await screen.findByText(name)).closest("article");

describe("product card behaviour", () => {
  it("shows appliance identity and buying details on homepage cards at rest", async () => {
    const appliance = {
      ...productFixture,
      id: 41,
      slug: "washer-8kg",
      name: "غسالة 8 كغم",
      brand_name: "سامسونج",
      model_number: "WW80T",
      card_attributes: [{ key: "capacity_kg", label: "السعة", type: "number", value: 8, unit: "كغم" }],
    };
    stubApi({ ...storefrontRoutes, "/api/v1/products/featured": page([appliance, { ...productFixture, id: 42, slug: "second-product" }]) });
    renderApp("/");

    const cardElement = await cardOf(appliance.name);
    const card = within(cardElement);
    expect(cardElement).toHaveClass("vs-card--listing");
    expect(card.getByText("سامسونج")).toBeInTheDocument();
    expect(card.getByText(/WW80T/)).toBeInTheDocument();
    expect(card.getByText(/السعة.*8 كغم/)).toBeInTheDocument();
    expect(card.getByText("100 ₪")).toBeInTheDocument();
    expect(card.getByText("متوفر")).toBeInTheDocument();
    expect(card.getByRole("button", { name: /أضف إلى العربة/ })).toBeEnabled();
  });

  it("adds a simple product straight to the cart and reveals the drawer", async () => {
    stubApi(storefrontRoutes);
    renderApp("/shop");

    const card = within(await cardOf(productFixture.name));
    await userEvent.click(card.getByRole("button", { name: /أضف إلى العربة/ }));

    await waitFor(() => expect(cartStorage.load()).toHaveLength(1));
    expect(cartStorage.load()[0].unit).toBe(100); // charged price, not compare-at

    // The drawer follows a beat later so the button's success state is seen.
    expect(await screen.findByRole("dialog", { name: "عربة التسوّق" })).toBeInTheDocument();
  });

  it("sends a product that needs an option to the quick view instead of the cart", async () => {
    stubApi({
      ...storefrontRoutes,
      "/api/v1/products/printed-scarf": optionProduct,
      "/api/v1/products": page([optionProduct]),
    });
    renderApp("/shop");

    const card = within(await cardOf(optionProduct.name));
    const button = await card.findByRole("button", { name: "اختر الخيارات" });
    expect(card.queryByRole("button", { name: /أضف إلى العربة/ })).not.toBeInTheDocument();

    await userEvent.click(button);

    const modal = await screen.findByRole("dialog", { name: "نظرة سريعة" });
    expect(within(modal).getByText("المقاس")).toBeInTheDocument();
    expect(cartStorage.load()).toHaveLength(0);
  });

  it("refuses to add from the quick view until an option is chosen", async () => {
    stubApi({
      ...storefrontRoutes,
      "/api/v1/products/printed-scarf": optionProduct,
      "/api/v1/products": page([optionProduct]),
    });
    renderApp("/shop");

    await userEvent.click(await screen.findByRole("button", { name: "اختر الخيارات" }));
    const modal = await screen.findByRole("dialog", { name: "نظرة سريعة" });

    await userEvent.click(await within(modal).findByRole("button", { name: "أضف إلى العربة" }));
    expect(await within(modal).findByRole("alert")).toHaveTextContent("اختر أحد الخيارات");
    expect(cartStorage.load()).toHaveLength(0);
    // A refused add must not claim success on the button.
    expect(within(modal).getByRole("button", { name: "أضف إلى العربة" })).not.toHaveTextContent(
      "تمت الإضافة",
    );

    // Choosing a variant switches the price to that variant's own price.
    await userEvent.click(within(modal).getByRole("button", { name: "كبير" }));
    expect(within(modal).getByText("90 ₪")).toBeInTheDocument();

    await userEvent.click(within(modal).getByRole("button", { name: "أضف إلى العربة" }));
    await waitFor(() => expect(cartStorage.load()).toHaveLength(1));
    const [line] = cartStorage.load();
    expect(line.variantId).toBe(22);
    expect(line.variation).toBe("كبير");
  });

  it("cannot add a sold-out product", async () => {
    stubApi({ ...storefrontRoutes, "/api/v1/products": page([soldOutProduct]) });
    renderApp("/shop");

    const card = within(await cardOf(soldOutProduct.name));
    expect(card.getByText("غير متوفر حالياً", { selector: "span" })).toBeInTheDocument();
    const button = card.getByRole("button", { name: "غير متوفر حالياً" });
    expect(button).toBeDisabled();

    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(cartStorage.load()).toHaveLength(0);
  });

  it("gives a package its own card, its contents and its own action", async () => {
    const packageWithSecondImage = {
      ...packageProduct,
      primary_image_url: "/media/package-cover.png",
      secondary_image_url: "/media/package-contents.png",
    };
    stubApi({ ...storefrontRoutes, "/api/v1/products": page([packageWithSecondImage]) });
    renderApp("/shop");

    const cardElement = await cardOf(packageProduct.name);
    const card = within(cardElement);
    expect(cardElement.querySelector(".vs-pkg__img2")).toHaveAttribute("src", "/media/package-contents.png");
    expect(card.getByText("بكج")).toBeInTheDocument();
    // The contents summary is whatever the payload actually knows: the item
    // names when it carries them, never an invented list.
    expect(card.getByText("كرت دعوة")).toBeInTheDocument();
    expect(card.getByText("340 ₪")).toBeInTheDocument();
    expect(card.getByText("410 ₪")).toBeInTheDocument();
    expect(card.getByRole("link", { name: /التفاصيل/ })).toHaveAttribute(
      "href",
      "/product/wedding-package",
    );

    await userEvent.click(card.getByRole("button", { name: /أضف البكج إلى العربة/ }));
    await waitFor(() => expect(cartStorage.load()).toHaveLength(1));
    expect(cartStorage.load()[0].unit).toBe(340);
  });

  it("falls back to the item count when the list payload carries no contents", async () => {
    // What the list projection actually looks like: a count, no item rows.
    const listShape = { ...packageProduct, package_items: [], package_item_count: 3 };
    stubApi({ ...storefrontRoutes, "/api/v1/products": page([listShape]) });
    renderApp("/shop");

    const card = within(await cardOf(packageProduct.name));
    expect(card.getByText("يحتوي على 3 عناصر")).toBeInTheDocument();
  });

  it("shows the discount on a sale product and keeps both prices legible", async () => {
    stubApi(storefrontRoutes);
    renderApp("/shop");

    const card = within(await cardOf(productFixture.name));
    expect(card.getByText("−23٪")).toBeInTheDocument();
    expect(card.getByText("100 ₪")).toBeInTheDocument();
    expect(card.getByText("130 ₪")).toBeInTheDocument();
  });

  it("shows available appliance details in listing cards without changing cart actions", async () => {
    const appliance = {
      ...productFixture,
      name: "غسالة أوتوماتيكية",
      brand_name: "سامسونج",
      sku: "WW80T",
      specifications: [
        { name: "السعة", value: "8 كغم" },
        { name: "سرعة العصر", value: "1400 دورة" },
        { name: "اللون", value: "أبيض" },
      ],
    };
    stubApi({ ...storefrontRoutes, "/api/v1/products": page([appliance]) });
    renderApp("/shop");

    const cardElement = await cardOf(appliance.name);
    const card = within(cardElement);
    expect(cardElement).toHaveClass("vs-card--listing");
    expect(card.getByText("سامسونج")).toBeInTheDocument();
    expect(card.getByText(/WW80T/)).toBeInTheDocument();
    expect(card.getByText(/السعة.*8 كغم/)).toBeInTheDocument();
    expect(card.getByText(/سرعة العصر.*1400 دورة/)).toBeInTheDocument();
    expect(card.queryByText(/اللون.*أبيض/)).not.toBeInTheDocument();
    expect(card.getByText("متوفر")).toBeInTheDocument();
    expect(card.getByRole("button", { name: /أضف إلى العربة/ })).toBeEnabled();
  });

  it("opens the quick view from the card and links on to the full product page", async () => {
    stubApi({
      ...storefrontRoutes,
      "/api/v1/products/clear-resin": productFixture,
      "/api/v1/products/clear-resin/related": [],
    });
    renderApp("/shop");

    await userEvent.click(await screen.findByRole("button", { name: /نظرة سريعة على/ }));
    const modal = await screen.findByRole("dialog", { name: "نظرة سريعة" });

    expect(within(modal).getByText(productFixture.name)).toBeInTheDocument();
    expect(within(modal).getByRole("link", { name: /عرض التفاصيل الكاملة/ })).toHaveAttribute(
      "href",
      "/product/clear-resin",
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "نظرة سريعة" })).not.toBeInTheDocument(),
    );
  });

  it("carries everything a shopper acts on in the card's reveal panel", async () => {
    stubApi(storefrontRoutes);
    renderApp("/shop");

    const card = await cardOf(productFixture.name);
    const panel = card.querySelector(".vs-card__panel");
    expect(panel).not.toBeNull();

    // Nothing the shopper needs sits outside the panel.
    expect(within(panel).getByText(productFixture.name)).toBeInTheDocument();
    expect(within(panel).getByText("100 ₪")).toBeInTheDocument();
    expect(within(panel).getByText("130 ₪")).toBeInTheDocument();
    expect(within(panel).getByText("متوفر")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /أضف إلى العربة/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /نظرة سريعة على/ })).toBeInTheDocument();
  });

  it("keeps ordinary product cards on their primary image", async () => {
    const withSecond = {
      ...productFixture,
      primary_image_url: "/media/one.png",
      secondary_image_url: "/media/two.png",
    };
    const withoutSecond = {
      ...productFixture,
      id: 9,
      name: "شمعة معطّرة",
      slug: "candle",
      primary_image_url: "/media/one.png",
      secondary_image_url: null,
    };
    stubApi({ ...storefrontRoutes, "/api/v1/products": page([withSecond, withoutSecond]) });
    renderApp("/shop");

    const swapper = await cardOf(withSecond.name);
    expect(swapper.querySelector(".vs-card__img2")).toBeNull();

    // The fallback: cover stays, panel still reveals, no invented second image.
    const plain = await cardOf(withoutSecond.name);
    expect(plain.querySelector(".vs-card__img2")).toBeNull();
    expect(plain.querySelector(".vs-card__panel")).not.toBeNull();
  });

  it("keeps a one-image package card valid", async () => {
    stubApi({ ...storefrontRoutes, "/api/v1/products": page([packageProduct]) });
    renderApp("/shop");

    const card = await cardOf(packageProduct.name);
    expect(card.querySelector(".vs-pkg__img2")).toBeNull();
    expect(within(card).getByRole("link", { name: /التفاصيل/ })).toBeInTheDocument();
  });

  it("adds exactly one line however fast the button is pressed", async () => {
    stubApi(storefrontRoutes);
    renderApp("/shop");

    const card = within(await cardOf(productFixture.name));
    const button = card.getByRole("button", { name: /أضف إلى العربة/ });
    await userEvent.click(button);
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await userEvent.click(button, { pointerEventsCheck: 0 });

    await waitFor(() => expect(cartStorage.load()).toHaveLength(1));
    expect(cartStorage.load()[0].qty).toBe(1);
  });

  it("opens a listing product on the first touch because its details are already visible", async () => {
    stubApi({ ...storefrontRoutes, "/api/v1/products/clear-resin": productFixture });
    renderApp("/shop");

    const card = await cardOf(productFixture.name);
    expect(card).toHaveClass("vs-card--listing");

    const media = card.querySelector(".vs-card__link");
    await userEvent.pointer([
      { target: media, keys: "[TouchA>]" },
      { target: media, keys: "[/TouchA]" },
    ]);

    expect(await screen.findByRole("heading", { name: productFixture.name, level: 1 })).toBeInTheDocument();
  });

  it("keeps the add-to-cart acknowledgement when motion is reduced", async () => {
    window.__mediaMatches = (query) => query.includes("prefers-reduced-motion");
    stubApi(storefrontRoutes);
    renderApp("/shop");

    const card = within(await cardOf(productFixture.name));
    const button = card.getByRole("button", { name: /أضف إلى العربة/ });
    await userEvent.click(button);

    // The wording still changes; only the movement is dropped, and that is CSS.
    expect(button).toHaveTextContent("تمت الإضافة");
    await waitFor(() => expect(cartStorage.load()).toHaveLength(1));
  });
});
