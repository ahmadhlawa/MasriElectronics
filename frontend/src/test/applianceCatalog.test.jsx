import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { categoryFixture, page, productFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

const defs = [
  { id: 1, key: "capacity_liters", label: "السعة", type: "number", unit: "لتر", filterable: true, enum_choices: [] },
  { id: 2, key: "door_type", label: "نوع الباب", type: "enum", filterable: true, enum_choices: [{ code: "double", label: "بابان" }] },
  { id: 3, key: "inverter", label: "إنفرتر", type: "boolean", filterable: true, enum_choices: [] },
  { id: 4, key: "notes", label: "ملاحظات", type: "text", filterable: true, enum_choices: [] },
];
const fridge = {
  ...productFixture, id: 9, name: "ثلاجة اختبار", slug: "test-fridge", category_slug: "resin",
  brand_id: 4, brand_name: "سامسونج", model_number: "RF-42", sku: "SKU-9",
  card_attributes: [
    { key: "capacity_liters", label: "السعة", type: "number", value: 420, unit: "لتر" },
    { key: "inverter", label: "إنفرتر", type: "boolean", value: false },
    { key: "door_type", label: "نوع الباب", type: "enum", value: "double", option_label: "بابان" },
  ],
};
const routes = {
  ...storefrontRoutes,
  "/api/v1/brands": [{ id: 4, name: "سامسونج" }],
  "/api/v1/categories/resin/attributes": defs,
  "/api/v1/categories/resin": categoryFixture,
  "/api/v1/products": page([fridge]),
};
const panel = () => within(screen.getByRole("complementary", { name: "تصفية النتائج" }));
const listingCalls = (calls) => calls.filter((call) => call.path.startsWith("/api/v1/products?") && call.path.includes("page_size=12"));

describe("appliance catalog", () => {
  it("renders model number and at most two returned card attributes", async () => {
    stubApi({ ...routes, "/api/v1/products": page([fridge, { ...fridge, id: 10, name: "ثلاجة أخرى", slug: "another-fridge", card_attributes: [fridge.card_attributes[2]] }]) });
    renderApp("/category/resin");
    const card = (await screen.findByText("ثلاجة اختبار")).closest("article");
    expect(within(card).getByText("سامسونج")).toBeInTheDocument();
    expect(within(card).getByText(/RF-42/)).toBeInTheDocument();
    expect(within(card).getByText(/السعة: 420 لتر/)).toBeInTheDocument();
    expect(within(card).getByText(/إنفرتر: لا/)).toBeInTheDocument();
    expect(within(card).queryByText(/نوع الباب/)).not.toBeInTheDocument();
    const other = (await screen.findByText("ثلاجة أخرى")).closest("article");
    expect(within(other).getByText(/نوع الباب: بابان/)).toBeInTheDocument();
  });

  it("sends brand, numeric bounds, enum, and boolean filters together and clears them", async () => {
    const calls = stubApi(routes);
    renderApp("/category/resin");
    await panel().findByLabelText("السعة من");
    await userEvent.selectOptions(panel().getByLabelText("العلامة التجارية"), "4");
    await userEvent.type(panel().getByLabelText("السعة من"), "300");
    await userEvent.type(panel().getByLabelText("السعة إلى"), "500");
    await userEvent.selectOptions(panel().getByLabelText("نوع الباب"), "double");
    await userEvent.selectOptions(panel().getByLabelText("إنفرتر"), "false");
    expect(panel().queryByLabelText("ملاحظات")).not.toBeInTheDocument();
    await waitFor(() => {
      const params = new URLSearchParams(listingCalls(calls).at(-1)?.path.split("?")[1]);
      expect(params.get("brand_id")).toBe("4");
      expect(params.getAll("attribute")).toEqual([
        "capacity_liters:gte:300", "capacity_liters:lte:500", "door_type:eq:double", "inverter:eq:false",
      ]);
    });
    expect(screen.getByRole("button", { name: "سامسونج ✕" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /السعة من 300 لتر ✕/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "سامسونج ✕" }));
    await waitFor(() => expect(new URLSearchParams(listingCalls(calls).at(-1).path.split("?")[1]).has("brand_id")).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: /السعة من 300 لتر ✕/ }));
    await waitFor(() => {
      const attributes = new URLSearchParams(listingCalls(calls).at(-1).path.split("?")[1]).getAll("attribute");
      expect(attributes).not.toContain("capacity_liters:gte:300");
      expect(attributes).toContain("capacity_liters:lte:500");
    });
    await userEvent.click(screen.getByRole("button", { name: "مسح الكل" }));
    await waitFor(() => expect(new URLSearchParams(listingCalls(calls).at(-1).path.split("?")[1]).getAll("attribute")).toEqual([]));
  });

  it("clears category attributes when selecting a different category", async () => {
    const calls = stubApi({ ...routes, "/api/v1/categories": [categoryFixture, { id: 2, slug: "washers", name: "غسالات", product_count: 1, children: [] }], "/api/v1/categories/washers/attributes": [] });
    renderApp("/shop?cat=resin&attribute=capacity_liters%3Agte%3A300");
    await panel().findByLabelText("السعة من");
    await userEvent.click(panel().getByLabelText(/غسالات/));
    await waitFor(() => {
      const params = new URLSearchParams(listingCalls(calls).at(-1)?.path.split("?")[1]);
      expect(params.get("category")).toBe("washers");
      expect(params.getAll("attribute")).toEqual([]);
    });
  });

  it("uses filtered totals for count and pagination", async () => {
    stubApi({ ...routes, "/api/v1/products": ({ path }) => path.includes("brand_id=4")
      ? page([fridge], { total: 1, pages: 1 }) : page([fridge], { total: 18, pages: 2 }) });
    renderApp("/category/resin");
    expect(await screen.findByText("18 منتجاً")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /عرض المزيد/ })).toBeInTheDocument();
    await userEvent.selectOptions(panel().getByLabelText("العلامة التجارية"), "4");
    expect(await screen.findByText("1 منتجاً")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /عرض المزيد/ })).not.toBeInTheDocument();
  });

  it("uses the existing mobile filter drawer", async () => {
    const calls = stubApi(routes);
    renderApp("/category/resin");
    await userEvent.click(await screen.findByRole("button", { name: /التصفية/ }));
    const drawer = await screen.findByRole("dialog", { name: "تصفية النتائج" });
    await userEvent.selectOptions(within(drawer).getByLabelText("إنفرتر"), "true");
    await waitFor(() => expect(new URLSearchParams(listingCalls(calls).at(-1)?.path.split("?")[1]).getAll("attribute")).toContain("inverter:eq:true"));
  });
});
