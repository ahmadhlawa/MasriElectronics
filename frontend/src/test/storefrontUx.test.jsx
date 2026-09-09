import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { categoryFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

describe("storefront UX polish", () => {
  it("renders the hierarchical categories route with working cards", async () => {
    const child = { ...categoryFixture, id: 2, name: "القلايات الهوائية", slug: "air-fryers", parent_id: 1 };
    const parent = { ...categoryFixture, name: "الأجهزة المنزلية", slug: "home-appliances", children: [child] };
    stubApi({ ...storefrontRoutes, "/api/v1/categories": [parent] });
    renderApp("/categories");

    expect(await screen.findByRole("heading", { name: "كل الأقسام" })).toBeInTheDocument();
    expect(screen.getByText("اختر القسم المناسب لتصفّح منتجاته.")).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("link", { name: /الأجهزة المنزلية/ })).toHaveAttribute("href", "/category/home-appliances");
    expect(main.getByRole("link", { name: "القلايات الهوائية" })).toHaveAttribute("href", "/category/air-fryers");
  });

  it("links the homepage categories heading to the categories route", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    expect(await screen.findByRole("link", { name: "عرض الكل" })).toHaveAttribute("href", "/categories");
  });

  it("uses one primary mobile menu and includes all categories inside it", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    expect(await screen.findAllByRole("button", { name: "فتح القائمة" })).toHaveLength(1);
    expect(document.querySelectorAll(".vs-header__row > button.vs-mob")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "فتح القائمة" }));
    const menu = screen.getByRole("dialog", { name: "قائمة التنقّل" });
    expect(within(menu).getByRole("link", { name: "كل الأقسام" })).toHaveAttribute("href", "/categories");
  });

  it("shows the exact delivery trust promise", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    expect(await screen.findByText("التوصيل إلى جميع المناطق")).toBeInTheDocument();
    expect(screen.getByText("تُحتسب رسوم التوصيل عند إتمام الطلب")).toBeInTheDocument();
  });
});
