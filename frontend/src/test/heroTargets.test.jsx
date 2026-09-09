import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authStorage } from "../storage/authStorage.js";
import { page, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

const ADMIN = { id: 1, email: "owner@example.com", full_name: "المالك", role: "super_admin", is_active: true };

describe("Hero destinations", () => {
  it("resolves structured and safe legacy destinations only", async () => {
    const slides = [
      { id: 1, title: "بدون وجهة", image_url: "/none.png", target_type: "none", button_url: "/offers" },
      { id: 2, title: "المنتجات", image_url: "/products.png", target_type: "products" },
      { id: 3, title: "الأقسام", image_url: "/categories.png", target_type: "categories" },
      { id: 4, title: "قسم", image_url: "/category.png", target_type: "category", target_slug: "قلايات هوائية" },
      { id: 5, title: "الأولوية", image_url: "/priority.png", target_type: "packages", button_url: "/offers" },
      { id: 6, title: "قديم آمن", image_url: "/legacy.png", target_type: null, button_url: "/offers" },
      { id: 7, title: "خارجي", image_url: "/external.png", target_type: null, button_url: "https://example.com" },
    ];
    const calls = stubApi({ ...storefrontRoutes, "/api/v1/hero-slides": slides });
    renderApp("/");
    await waitFor(() => expect(document.querySelectorAll(".vs-hero__slide")).toHaveLength(7));

    const slide = (id) => document.querySelector(`.vs-hero__slide:nth-child(${id})`);
    expect(slide(1).querySelector("a")).toBeNull();
    expect(slide(2).querySelector("a")).toHaveAttribute("href", "/shop");
    expect(slide(3).querySelector("a")).toHaveAttribute("href", "/categories");
    expect(slide(4).querySelector("a")).toHaveAttribute("href", `/category/${encodeURIComponent("قلايات هوائية")}`);
    expect(slide(5).querySelector("a")).toHaveAttribute("href", "/packages");
    expect(slide(6).querySelector("a")).toHaveAttribute("href", "/offers");
    expect(slide(7).querySelector("a")).toBeNull();
    expect(calls.some(({ path }) => path.includes("home-sections"))).toBe(false);
  });
});

describe("Admin Hero destinations", () => {
  it("uses a structured destination selector with a conditional hierarchical category", async () => {
    authStorage.save("token", ADMIN);
    stubApi({
      "/api/v1/auth/me": ADMIN,
      "/api/v1/admin/hero-slides": [],
      "/api/v1/admin/categories": page([
        { id: 1, parent_id: null, name: "الأجهزة المنزلية", slug: "home" },
        { id: 2, parent_id: 1, name: "القلايات الهوائية", slug: "air-fryers" },
      ]),
    });
    renderApp("/admin/hero");
    await userEvent.click(await screen.findByRole("button", { name: "إضافة شريحة" }));
    const dialog = screen.getByRole("dialog");
    const destination = within(dialog).getByLabelText("الوجهة");
    expect(within(dialog).queryByLabelText("القسم")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/رابط|URL/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(destination, "category");
    expect(within(dialog).getByLabelText("القسم")).toHaveTextContent("الأجهزة المنزلية > القلايات الهوائية");
    expect(within(dialog).getByText("المقاس الموصى به لسطح المكتب: 2100×800 بكسل (21:8).")).toBeInTheDocument();
  });
});
