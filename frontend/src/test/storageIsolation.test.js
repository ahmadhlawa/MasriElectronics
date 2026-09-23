import { describe, expect, it } from "vitest";

import { authStorage, orderTokenStorage } from "../storage/authStorage.js";
import { cartStorage, searchStorage, viewedStorage } from "../storage/cartStorage.js";

describe("Masri browser storage isolation", () => {
  it("ignores legacy commerce state and persists only Masri-namespaced keys", () => {
    window.localStorage.setItem("commerce_admin_auth_v1", JSON.stringify({ token: "legacy" }));
    window.localStorage.setItem("commerce_cart_v1", JSON.stringify([{ productId: 1, qty: 1 }]));
    window.localStorage.setItem("commerce_viewed_v1", JSON.stringify(["legacy-product"]));
    window.localStorage.setItem("commerce_searches_v1", JSON.stringify(["legacy search"]));
    window.sessionStorage.setItem("commerce_order_42", JSON.stringify("legacy-order-token"));

    expect(authStorage.load()).toBeNull();
    expect(cartStorage.load()).toEqual([]);
    expect(viewedStorage.load()).toEqual([]);
    expect(searchStorage.load()).toEqual([]);
    expect(orderTokenStorage.load(42)).toBeNull();

    authStorage.save("masri-token", null);
    cartStorage.save([{ productId: 2, qty: 1 }]);
    viewedStorage.push("masri-product");
    searchStorage.push("masri search");
    orderTokenStorage.save(42, "masri-order-token");

    expect(window.localStorage.getItem("masri_electronics_admin_auth_v1")).toContain("masri-token");
    expect(window.localStorage.getItem("masri_electronics_cart_v1")).toContain("productId");
    expect(window.localStorage.getItem("masri_electronics_viewed_v1")).toContain("masri-product");
    expect(window.localStorage.getItem("masri_electronics_searches_v1")).toContain("masri search");
    expect(window.sessionStorage.getItem("masri_electronics_order_42")).toContain("masri-order-token");
  });
});
