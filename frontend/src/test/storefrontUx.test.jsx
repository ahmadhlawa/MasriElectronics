import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { categoryFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

describe("storefront UX polish", () => {
  it("renders compact category tiles and reaches children through the parent category page", async () => {
    const child = { ...categoryFixture, id: 2, name: "القلايات الهوائية", slug: "air-fryers", parent_id: 1 };
    const parent = { ...categoryFixture, name: "الأجهزة المنزلية", slug: "home-appliances", image_url: "/media/category.png", children: [child] };
    stubApi({ ...storefrontRoutes, "/api/v1/categories": [parent],
      "/api/v1/categories/home-appliances": parent, "/api/v1/categories/air-fryers": child,
      "/api/v1/categories/home-appliances/attributes": [], "/api/v1/categories/air-fryers/attributes": [] });
    renderApp("/categories");

    expect(await screen.findByRole("heading", { name: "كل الأقسام" })).toBeInTheDocument();
    expect(screen.getByText("اختر القسم المناسب لتصفّح منتجاته.")).toBeInTheDocument();
    const main = within(screen.getByRole("main"));
    const tile = main.getByRole("link", { name: "الأجهزة المنزلية — منتج واحد", exact: true });
    expect(tile).toHaveAttribute("href", "/category/home-appliances");
    expect(tile.querySelector("img")).toHaveAttribute("src", "/media/category.png");
    expect(tile.querySelector("img")).toHaveAttribute("alt", "");
    expect(main.queryByRole("link", { name: "القلايات الهوائية" })).not.toBeInTheDocument();
    await userEvent.click(tile);
    expect(await screen.findByRole("heading", { level: 1, name: "الأجهزة المنزلية" })).toBeInTheDocument();
    const childLink = within(screen.getByRole("main")).getByRole("link", { name: "القلايات الهوائية", exact: true });
    expect(childLink).toHaveAttribute("href", "/category/air-fryers");
    await userEvent.click(childLink);
    expect(await screen.findByRole("heading", { level: 1, name: "القلايات الهوائية" })).toBeInTheDocument();
  });

  it("keeps category names and links usable with missing or failed artwork", async () => {
    stubApi({ ...storefrontRoutes, "/api/v1/categories": [categoryFixture,
      { ...categoryFixture, id: 2, name: "صورة تالفة", slug: "broken", image_url: "/media/broken.png" }] });
    renderApp("/categories");
    const main = within(await screen.findByRole("main"));
    const missing = main.getByRole("link", { name: `${categoryFixture.name} — منتج واحد`, exact: true });
    expect(missing.querySelector("img")).toBeNull();
    expect(missing.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    const broken = main.getByRole("link", { name: "صورة تالفة — منتج واحد", exact: true });
    fireEvent.error(broken.querySelector("img"));
    expect(broken.querySelector("img")).toBeNull();
    expect(broken).toHaveAttribute("href", "/category/broken");
    expect(broken.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("routes the categories tab to its page and keeps the hamburger menu separate", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    const bar = within(await screen.findByRole("navigation", { name: "تنقّل سريع" }));
    const link = bar.getByRole("link", { name: "الأقسام" });
    expect(link).toHaveAttribute("href", "/categories");
    expect(link).not.toHaveAttribute("aria-current");
    await userEvent.click(link);
    expect(await screen.findByRole("heading", { level: 1, name: "كل الأقسام" })).toBeInTheDocument();
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "فتح القائمة" }));
    expect(screen.getByRole("dialog", { name: "قائمة التنقّل" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(bar.getByRole("link", { name: "الرئيسية" }));
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("links the homepage categories heading to the categories route", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    expect(await screen.findByRole("link", { name: "عرض الكل" })).toHaveAttribute("href", "/categories");
  });

  it("uses one primary mobile menu with page navigation", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    expect(await screen.findAllByRole("button", { name: "فتح القائمة" })).toHaveLength(1);
    expect(document.querySelectorAll(".vs-header__row > button.vs-mob")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "فتح القائمة" }));
    const menu = screen.getByRole("dialog", { name: "قائمة التنقّل" });
    expect(within(menu).getByRole("link", { name: "كل المنتجات" })).toHaveAttribute("href", "/shop");
    expect(within(menu).queryByRole("link", { name: "كل الأقسام" })).not.toBeInTheDocument();
  });

  it("limits the delivery trust claim to configured areas", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");
    expect(await screen.findByText("التوصيل إلى المناطق المتاحة")).toBeInTheDocument();
    expect(screen.getByText("تختلف الرسوم حسب المنطقة وتظهر عند إتمام الطلب")).toBeInTheDocument();
  });
});
