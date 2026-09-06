import { expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { normalizeHomeSections } from "../services/storefront.js";
import { previewData } from "../preview/demoData.js";
import { page, productFixture, renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

const pairs = [
  ["categories", "categories"],
  ["featured", "featured_products"],
  ["bestsellers", "bestsellers"],
  ["new", "new_products"],
];
const rows = pairs.flatMap(([key, type], index) => [
  { id: index * 2, section_key: key, section_type: type, title: type, config: {} },
  { id: index * 2 + 1, section_key: `masri-${key}`, section_type: type, title: type, config: {} },
]);

it("renders imported sections once when the API also contains instance defaults", async () => {
  const products = page([productFixture, { ...productFixture, id: 99, slug: "second-product" }]);
  stubApi({
    ...storefrontRoutes,
    "/api/v1/home-sections": rows,
    "/api/v1/products/featured": products,
    "/api/v1/products/new": products,
    "/api/v1/products/bestsellers": products,
  });
  renderApp("/");
  for (const [, type] of pairs) {
    expect(await screen.findAllByRole("heading", { name: type })).toHaveLength(1);
  }
});

it("preserves distinct sections, configured variants, and unchanged static preview data", () => {
  const distinct = [
    { id: 20, section_key: "editorial-one", section_type: "custom_text", title: "Story" },
    { id: 21, section_key: "editorial-two", section_type: "custom_text", title: "Story" },
    { id: 22, section_key: "seasonal", section_type: "featured_products", title: "featured_products" },
    { id: 23, section_type: "custom_text", title: "No key" },
  ];
  expect(normalizeHomeSections([...rows, ...distinct]).sections.map((row) => row.id))
    .toEqual([1, 3, 5, 7, 20, 21, 22, 23]);
  expect(normalizeHomeSections([rows[0], { ...rows[1], config: { limit: 5 } }]).sections).toHaveLength(2);
  expect(normalizeHomeSections(previewData.homeSections).sections.map((row) => row.id))
    .toEqual(previewData.homeSections.map((row) => row.id));
});
