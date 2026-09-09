import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductEditorPage from "../admin/pages/ProductEditorPage.jsx";
import { page, stubApi } from "./utils.jsx";

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

function renderEditor() {
  stubApi({
    "/api/v1/admin/products/7": product,
    "/api/v1/admin/products": page([]),
    "/api/v1/admin/categories": page(categories),
    "/api/v1/admin/brands": page([{ id: 4, name: "Masri Brand" }]),
  });
  render(
    <MemoryRouter initialEntries={["/admin/products/7"]}>
      <Routes><Route path="/admin/products/:productId" element={<ProductEditorPage />} /></Routes>
    </MemoryRouter>,
  );
}

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
