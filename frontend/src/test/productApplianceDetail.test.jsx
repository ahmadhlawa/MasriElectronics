import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { productFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

const attributes = [
  { key: "finish", label: "اللون", type: "text", value: "فضي", sort_order: 1, comparable: false, show_on_card: false },
  { key: "capacity", label: "السعة", type: "number", value: 420, unit: "لتر", sort_order: 2, comparable: true, show_on_card: false },
  { key: "door", label: "نوع الباب", type: "enum", value: "double", option_label: "بابان", sort_order: 3, comparable: false, show_on_card: true },
  { key: "inverter", label: "إنفرتر", type: "boolean", value: false, sort_order: 4, comparable: true, show_on_card: false },
  { key: "rating", label: "تصنيف الطاقة", type: "text", value: "A++", sort_order: 5, comparable: false, show_on_card: true },
  { key: "doors", label: "عدد الأبواب", type: "number", value: 2, sort_order: 6, comparable: false, show_on_card: false },
  { key: "shelves", label: "الأرفف", type: "number", value: 4, sort_order: 7, comparable: false, show_on_card: false },
  { key: "empty", label: "خاصية فارغة", type: "text", value: "", sort_order: 8, comparable: true, show_on_card: true },
];
const appliance = {
  ...productFixture,
  brand_name: "سامسونج", model_number: "RF-420", sku: "MASRI-42",
  attributes,
  specifications: [
    { id: 1, name: "السعة", value: "420 لتر", sort_order: 0 },
    { id: 2, name: "مادة الرف", value: "زجاج", sort_order: 1 },
  ],
};

const renderProduct = (product) => {
  stubApi({
    ...storefrontRoutes,
    "/api/v1/products/clear-resin/related": [],
    "/api/v1/products/clear-resin": product,
  });
  renderApp("/product/clear-resin");
};

describe("appliance product detail", () => {
  it("shows identity and prioritized key attributes, then all structured and distinct free-form specs", async () => {
    renderProduct(appliance);
    expect(await screen.findByRole("heading", { name: productFixture.name, level: 1 })).toBeInTheDocument();
    expect(screen.getByText("سامسونج")).toBeInTheDocument();
    expect(screen.getByText(/RF-420/)).toBeInTheDocument();
    expect(screen.getByText(/MASRI-42/)).toBeInTheDocument();
    const key = within(screen.getByRole("region", { name: "أبرز المواصفات" }));
    expect(key.getByText("420 لتر")).toBeInTheDocument();
    expect(key.getByText("بابان")).toBeInTheDocument();
    expect(key.getByText("لا")).toBeInTheDocument();
    expect(key.getByText("A++")).toBeInTheDocument();
    expect(key.getByText("فضي")).toBeInTheDocument();
    expect(key.queryByText("عدد الأبواب")).not.toBeInTheDocument();
    expect([...key.getByText("السعة").closest("dl").querySelectorAll("dt")].map((node) => node.textContent)).toEqual(["السعة", "نوع الباب", "إنفرتر", "تصنيف الطاقة", "اللون"]);

    await userEvent.click(screen.getByRole("tab", { name: "المواصفات" }));
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText("الخصائص الفنية")).toBeInTheDocument();
    expect(panel.getByText("عدد الأبواب")).toBeInTheDocument();
    expect(panel.getByText("الأرفف")).toBeInTheDocument();
    expect(panel.getByText("مادة الرف")).toBeInTheDocument();
    expect(panel.queryByText("خاصية فارغة")).not.toBeInTheDocument();
    expect(panel.getAllByText("السعة")).toHaveLength(1);
  });

  it("keeps descriptive specifications when structured attributes are absent", async () => {
    renderProduct(productFixture);
    await screen.findByRole("heading", { name: productFixture.name, level: 1 });
    expect(screen.queryByRole("region", { name: "أبرز المواصفات" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "المواصفات" }));
    expect(within(screen.getByRole("tabpanel")).getByText("الوزن")).toBeInTheDocument();
  });
});
