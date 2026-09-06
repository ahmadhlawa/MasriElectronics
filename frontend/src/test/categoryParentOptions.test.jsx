import { describe, expect, it } from "vitest";

import { categoryParentOptions } from "../admin/pages/CatalogScreens.jsx";

describe("category parent options", () => {
  it("excludes the edited category and descendants while retaining valid parents", () => {
    const root = { id: 1, name: "root", parent_id: null };
    const child = { id: 2, name: "child", parent_id: 1 };
    const grandchild = { id: 3, name: "grandchild", parent_id: 2 };
    const other = { id: 4, name: "other", parent_id: null };

    expect(categoryParentOptions([root, child, grandchild, other], root)).toEqual([
      { value: 4, label: "other" },
    ]);
    expect(categoryParentOptions([root, child, grandchild, other], child)).toEqual([
      { value: 1, label: "root" },
      { value: 4, label: "other" },
    ]);
  });
});