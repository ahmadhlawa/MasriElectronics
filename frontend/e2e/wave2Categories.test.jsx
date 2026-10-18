import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { categoryFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

const fridge = {
  ...categoryFixture,
  id: 1,
  name: "ثلاجات",
  slug: "fridges",
  image_url: "/media/fridge.webp",
  children: [{ ...categoryFixture, id: 3, name: "ثلاجات بابين", slug: "two-door", parent_id: 1 }],
};
const washer = { ...categoryFixture, id: 2, name: "غسالات", slug: "washers", image_url: null, children: [] };

function withCategories() {
  stubApi({ ...storefrontRoutes, "/api/v1/categories": [fridge, washer] });
}

describe("Wave 2 category discovery", () => {
  it("renders compact linked tiles using real imagery and a neutral image fallback", async () => {
    withCategories();
    const { container } = renderApp("/categories");
    const link = await screen.findByRole("link", { name: /ثلاجات —/ });
    expect(link).toHaveAttribute("href", "/category/fridges");
    expect(container.querySelectorAll(".vs-categories-page__tile")).toHaveLength(2);
    const tiles = container.querySelectorAll(".vs-categories-page__tile");
    expect(tiles[0].querySelector("img")).toHaveAttribute("src", "/media/fridge.webp");
    expect(tiles[0].querySelector("svg")).toBeNull();
    expect(tiles[1].querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".vs-categories-page .vs-cat")).toBeNull();
    expect(screen.queryByText("ثلاجات بابين")).not.toBeInTheDocument();
  });

  it("opens /categories via mobile bottom navigation instead of opening the menu", async () => {
    withCategories();
    renderApp("/");
    const bottomNav = screen.getByRole("navigation", { name: "تنقّل سريع" });
    const categoriesLink = within(bottomNav).getByRole("link", { name: "الأقسام" });
    expect(categoriesLink).toHaveAttribute("href", "/categories");
    await userEvent.click(categoriesLink);
    await waitFor(() => expect(within(bottomNav).getByRole("link", { name: "الأقسام" })).toHaveAttribute("aria-current", "page"));
    expect(await screen.findByRole("heading", { name: "كل الأقسام" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "قائمة التنقّل" })).not.toBeInTheDocument();
  });

  it("reports a clean empty state without creating fake category cards", async () => {
    stubApi({ ...storefrontRoutes, "/api/v1/categories": [] });
    renderApp("/categories");
    expect(await screen.findByText("لا توجد أقسام متاحة حاليًا.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /— .*منتج/ })).not.toBeInTheDocument();
  });
});
