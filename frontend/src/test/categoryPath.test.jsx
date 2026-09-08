import { describe, expect, it } from "vitest";
import { categoryPath } from "../admin/pages/ProductEditorPage.jsx";

describe("categoryPath", () => {
  it("shows the complete category hierarchy", () => {
    const categories = [
      { id: 1, parent_id: null, name: "الأجهزة" },
      { id: 2, parent_id: 1, name: "المطبخ" },
      { id: 3, parent_id: 2, name: "القلايات" },
    ];
    expect(categoryPath(categories[2], categories)).toBe("الأجهزة > المطبخ > القلايات");
  });
});
