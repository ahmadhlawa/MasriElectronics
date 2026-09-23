import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CategoriesPage } from "../admin/pages/CatalogScreens.jsx";
import { page, respond, stubApi } from "./utils.jsx";

const category = { id: 3, name: "ثلاجات", slug: "fridges", sort_order: 0, is_active: true };
const definition = { id: 11, category_id: 3, key: "capacity_liters", label: "السعة", type: "number", unit: "لتر", enum_choices: [], filterable: true, comparable: true, show_on_card: false, sort_order: 0 };

function renderCategories(routes = {}) {
  const calls = stubApi({
    "/api/v1/admin/categories": page([category]),
    "/api/v1/admin/categories/3/attributes": [definition],
    ...routes,
  });
  render(<MemoryRouter><CategoriesPage /></MemoryRouter>);
  return calls;
}

describe("category attribute management", () => {
  it("creates enum definitions with choices and flags", async () => {
    const calls = renderCategories({ "POST /api/v1/admin/categories/3/attributes": definition });
    await userEvent.click(await screen.findByRole("button", { name: "الخصائص" }));
    await userEvent.click(screen.getByRole("button", { name: "إضافة خاصية" }));
    await userEvent.type(screen.getByLabelText("اسم الخاصية"), "نوع الباب");
    await userEvent.type(screen.getByLabelText(/مفتاح الخاصية/), "door_type");
    await userEvent.selectOptions(screen.getByLabelText("نوع الخاصية"), "enum");
    await userEvent.type(screen.getByLabelText(/خيارات القائمة/), "double:بابان");
    await userEvent.click(screen.getByLabelText("قابلة للتصفية"));
    await userEvent.click(screen.getByRole("button", { name: "حفظ الخاصية" }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(JSON.parse(calls.find((call) => call.method === "POST").body)).toMatchObject({
      key: "door_type", type: "enum", choices: [{ code: "double", label: "بابان" }], filterable: true,
    });
  });

  it("edits ordering and displays backend validation errors", async () => {
    const calls = renderCategories({
      "PATCH /api/v1/admin/categories/3/attributes/11": respond(409, { error: { code: "attribute_has_values", message: "الخاصية مرتبطة بمنتجات" } }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "الخصائص" }));
    await userEvent.click(await screen.findByRole("button", { name: "تعديل السعة" }));
    await userEvent.clear(screen.getByLabelText("ترتيب العرض"));
    await userEvent.type(screen.getByLabelText("ترتيب العرض"), "2");
    await userEvent.click(screen.getByLabelText("تظهر في البطاقة"));
    await userEvent.click(screen.getByRole("button", { name: "حفظ الخاصية" }));
    expect(await screen.findByText("الخاصية مرتبطة بمنتجات")).toBeInTheDocument();
    expect(JSON.parse(calls.find((call) => call.method === "PATCH").body)).toMatchObject({ sort_order: 2, show_on_card: true });
  });
});
