import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductEditorPage from "../admin/pages/ProductEditorPage.jsx";
import { page, respond, stubApi } from "./utils.jsx";

const categories = [
  { id: 1, parent_id: null, name: "الأجهزة المنزلية" },
  { id: 2, parent_id: 1, name: "أجهزة المطبخ" },
  { id: 3, parent_id: 2, name: "القلايات الهوائية" },
];

const product = {
  id: 7, name: "قلاية", slug: "fryer", sku: "MASRI-000007",
  category_id: 3, brand_id: 4, product_type: "standard", price: 100,
  stock_quantity: 2, track_inventory: true, is_active: true,
  specifications: [], options: [], variants: [], images: [], package_items: [],
};

function renderEditor(routes = {}) {
  const calls = stubApi({
    "/api/v1/admin/products/7": product,
    "/api/v1/admin/products/7/attributes": [],
    "/api/v1/admin/products": page([]),
    "/api/v1/admin/categories": page(categories),
    "/api/v1/admin/categories/3/attributes": [],
    "/api/v1/admin/brands": page([{ id: 4, name: "Masri Brand" }]),
    ...routes,
  });
  render(
    <MemoryRouter initialEntries={["/admin/products/7"]}>
      <Routes><Route path="/admin/products/:productId" element={<ProductEditorPage />} /></Routes>
    </MemoryRouter>,
  );
  return calls;
}

const definitions = [
  { id: 11, key: "capacity_liters", label: "السعة", type: "number", unit: "لتر", enum_choices: [], sort_order: 0 },
  { id: 12, key: "door_type", label: "نوع الباب", type: "enum", enum_choices: [{ code: "double", label: "بابان" }], sort_order: 1 },
  { id: 13, key: "inverter", label: "إنفرتر", type: "boolean", enum_choices: [], sort_order: 2 },
  { id: 14, key: "finish", label: "التشطيب", type: "text", enum_choices: [], sort_order: 3 },
];

describe("product editor primary UX", () => {
  it("hides product identifiers while preserving brand, hierarchy, and advanced fields", async () => {
    renderEditor();

    expect(await screen.findByLabelText("العلامة التجارية")).toHaveValue("4");
    expect(screen.getByRole("option", { name: "الأجهزة المنزلية > أجهزة المطبخ > القلايات الهوائية" })).toBeInTheDocument();
    expect(screen.queryByText(/SKU/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/الرابط/)).not.toBeInTheDocument();
    const advanced = screen.getByText("إعدادات متقدمة").closest("details");
    expect(advanced).toHaveTextContent("سعر التكلفة");
    expect(advanced.querySelector('input[type="number"]')).toBeInTheDocument();
    expect(screen.getByText("المواصفات")).toBeInTheDocument();
    expect(screen.getByText("خيارات يختارها الزبون")).toBeInTheDocument();
    expect(screen.getByText("النسخ (المقاسات والألوان)")).toBeInTheDocument();
  });

  it("shows package controls only for package products", async () => {
    renderEditor();
    expect(await screen.findByLabelText("نوع المنتج")).toHaveValue("standard");
    expect(screen.queryByText("محتويات البكج")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("نوع المنتج"), "package");
    expect(screen.getByText("محتويات البكج")).toBeInTheDocument();
  });

  it("loads model number and typed category values, then saves both", async () => {
    const calls = renderEditor({
      "/api/v1/admin/products/7": { ...product, model_number: "FR-42" },
      "/api/v1/admin/products/7/attributes": [
        { attribute_definition_id: 11, type: "number", number_value: "320" },
        { attribute_definition_id: 13, type: "boolean", boolean_value: false },
      ],
      "/api/v1/admin/categories/3/attributes": definitions,
      "PATCH /api/v1/admin/products/7": product,
      "PUT /api/v1/admin/products/7/attributes": [],
    });
    expect(await screen.findByLabelText("السعة")).toHaveValue(320);
    expect(screen.getByText("لتر")).toBeInTheDocument();
    expect(screen.getByLabelText("رقم الموديل")).toHaveValue("FR-42");
    expect(screen.getByLabelText("نوع الباب")).toHaveValue("");
    expect(screen.getByLabelText("إنفرتر")).toHaveValue("false");
    expect(screen.getByLabelText("التشطيب")).toHaveValue("");
    await userEvent.clear(screen.getByLabelText("رقم الموديل"));
    await userEvent.type(screen.getByLabelText("رقم الموديل"), "FR-43");
    await userEvent.selectOptions(screen.getByLabelText("نوع الباب"), "double");
    await userEvent.type(screen.getByLabelText("التشطيب"), "فضي");
    await userEvent.click(screen.getByRole("button", { name: "حفظ", exact: true }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT" && call.path.endsWith("/attributes"))).toBe(true));
    expect(JSON.parse(calls.find((call) => call.method === "PATCH").body).model_number).toBe("FR-43");
    expect(JSON.parse(calls.find((call) => call.method === "PUT").body)).toEqual([
      { attribute_definition_id: 11, number_value: 320 },
      { attribute_definition_id: 12, enum_value: "double" },
      { attribute_definition_id: 13, boolean_value: false },
      { attribute_definition_id: 14, text_value: "فضي" },
    ]);
  });

  it("confirms before clearing values on category change", async () => {
    const calls = renderEditor({
      "/api/v1/admin/products/7/attributes": [{ attribute_definition_id: 11, type: "number", number_value: "320" }],
      "/api/v1/admin/categories/3/attributes": definitions,
      "/api/v1/admin/categories/2/attributes": [],
      "PUT /api/v1/admin/products/7/attributes": [],
      "PATCH /api/v1/admin/products/7": product,
    });
    await screen.findByLabelText("السعة");
    await userEvent.selectOptions(screen.getByLabelText("القسم"), "2");
    await userEvent.click(screen.getByRole("button", { name: "حفظ", exact: true }));
    expect(await screen.findByText(/سيؤدي حفظ القسم الجديد/)).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "PUT" || call.method === "PATCH")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "تغيير القسم وحذف القيم" }));
    await waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true));
    expect(calls.find((call) => call.method === "PUT").body).toBe("[]");
  });

  it("shows backend attribute validation errors", async () => {
    renderEditor({
      "/api/v1/admin/categories/3/attributes": definitions,
      "PATCH /api/v1/admin/products/7": product,
      "PUT /api/v1/admin/products/7/attributes": respond(400, { error: { code: "invalid", message: "قيمة غير صالحة" } }),
    });
    await screen.findByLabelText("السعة");
    await userEvent.type(screen.getByLabelText("السعة"), "25");
    await userEvent.click(screen.getByRole("button", { name: "حفظ", exact: true }));
    expect(await screen.findByText("قيمة غير صالحة")).toBeInTheDocument();
  });

  it("loads definitions after selecting a category and saves values for a new product", async () => {
    const calls = stubApi({
      "/api/v1/admin/products": page([]),
      "/api/v1/admin/categories": page(categories),
      "/api/v1/admin/categories/3/attributes": definitions,
      "/api/v1/admin/brands": page([]),
      "POST /api/v1/admin/products": { ...product, id: 8 },
      "PUT /api/v1/admin/products/8/attributes": [],
      "/api/v1/admin/products/8": { ...product, id: 8 },
      "/api/v1/admin/products/8/attributes": [],
    });
    render(<MemoryRouter initialEntries={["/admin/products/new"]}><Routes><Route path="/admin/products/:productId" element={<ProductEditorPage />} /></Routes></MemoryRouter>);
    expect(screen.queryByText("خصائص القسم")).not.toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText("القسم"), "3");
    await userEvent.type(await screen.findByLabelText("السعة"), "450");
    await userEvent.type(screen.getByLabelText("اسم المنتج"), "ثلاجة");
    await userEvent.type(screen.getByLabelText("رقم الموديل"), "FR-450");
    await userEvent.click(screen.getByRole("button", { name: "حفظ", exact: true }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT" && call.path.endsWith("/attributes"))).toBe(true));
    expect(JSON.parse(calls.find((call) => call.method === "POST").body).model_number).toBe("FR-450");
    expect(JSON.parse(calls.find((call) => call.method === "PUT").body)).toEqual([{ attribute_definition_id: 11, number_value: 450 }]);
  });

  it("saves configured choices immediately after first product creation", async () => {
    const calls = stubApi({
      "/api/v1/admin/products": page([]),
      "/api/v1/admin/categories": page([]),
      "/api/v1/admin/brands": page([]),
      "POST /api/v1/admin/products": { ...product, id: 8, options: [] },
      "PUT /api/v1/admin/products/8/options": [],
      "/api/v1/admin/products/8": { ...product, id: 8 },
    });
    render(
      <MemoryRouter initialEntries={["/admin/products/new"]}>
        <Routes><Route path="/admin/products/:productId" element={<ProductEditorPage />} /></Routes>
      </MemoryRouter>,
    );
    const details = screen.getByText("خيارات يختارها الزبون").closest("details");
    details.open = true;
    await userEvent.click(screen.getByRole("button", { name: "إضافة خيار" }));
    await userEvent.type(screen.getByLabelText("اسم الخيار 1"), "السعة");
    await userEvent.type(screen.getByLabelText("قيمة 1 للخيار 1"), "2 لتر");
    await userEvent.click(screen.getByLabelText("يؤثر على السعر"));
    await userEvent.type(screen.getByLabelText("سعر قيمة 1"), "175");
    await userEvent.type(screen.getByLabelText("اسم المنتج"), "منتج جديد");
    await userEvent.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(calls.find((call) => call.method === "PUT")).toBeTruthy());
    const put = calls.find((call) => call.method === "PUT");
    expect(JSON.parse(put.body)).toEqual([{ name: "السعة", sort_order: 0, affects_price: true, values: [{ value: "2 لتر", sort_order: 0, price_override: 175 }] }]);
  });
});
