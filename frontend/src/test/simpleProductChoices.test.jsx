import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { cartStorage, lineKey } from "../storage/cartStorage.js";
import { page, productFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

const simpleProduct = {
  ...productFixture,
  id: 44,
  name: "قلاية بخيارات",
  slug: "simple-options",
  price: 100,
  compare_at_price: null,
  stock_quantity: 3,
  has_options: true,
  options: [
    { id: 1, name: "اللون", affects_price: false, values: [{ id: 11, value: "أسود", price_override: null }, { id: 12, value: "أبيض", price_override: null }] },
    { id: 2, name: "السعة", affects_price: true, values: [{ id: 21, value: "1.5 لتر", price_override: 125 }, { id: 22, value: "2 لتر", price_override: 150 }] },
  ],
  variants: [],
};

const routes = {
  ...storefrontRoutes,
  "/api/v1/products/simple-options": simpleProduct,
  "/api/v1/products/related": page([]),
};

describe("simple product choices", () => {
  it("renders unselected chips, blocks incomplete add, and updates price", async () => {
    stubApi(routes);
    renderApp("/product/simple-options");

    const color = await screen.findByRole("group", { name: "اللون" });
    const capacity = screen.getByRole("group", { name: "السعة" });
    expect(within(color).getByRole("button", { name: "أسود" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(within(color).getByRole("button", { name: "أسود" }));
    await userEvent.click(screen.getByRole("button", { name: /أضف إلى العربة/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("اختر أحد الخيارات");
    expect(cartStorage.load()).toHaveLength(0);

    await userEvent.click(within(capacity).getByRole("button", { name: "1.5 لتر" }));
    expect(await screen.findByText("125 ₪")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /أضف إلى العربة/ }));
    await waitFor(() => expect(cartStorage.load()).toHaveLength(1));
    expect(cartStorage.load()[0]).toMatchObject({
      selectedOptionValueIds: [11, 21],
      variation: "اللون: أسود، السعة: 1.5 لتر",
    });
  });

  it("keeps different choices as separate cart identities", () => {
    expect(lineKey(44, null, [11, 21])).not.toBe(lineKey(44, null, [12, 21]));
    cartStorage.save([
      { productId: 44, selectedOptionValueIds: [11, 21], qty: 1, variation: "اللون: أسود" },
      { productId: 44, selectedOptionValueIds: [12, 21], qty: 1, variation: "اللون: أبيض" },
    ]);
    expect(cartStorage.load()).toHaveLength(2);
  });
});
