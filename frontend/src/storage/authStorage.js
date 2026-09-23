// Admin session persistence. Only the access token and the (non-sensitive) profile
// the API returns are kept; a rejected token is cleared by the API client's 401 hook.
import { readJson, remove, writeJson } from "./safeStorage.js";

const AUTH_KEY = "masri_electronics_admin_auth_v1";

export const authStorage = {
  load() {
    const value = readJson(AUTH_KEY, null);
    if (!value || typeof value.token !== "string" || !value.token) return null;
    return { token: value.token, admin: value.admin || null };
  },
  save(token, admin) {
    writeJson(AUTH_KEY, { token, admin });
  },
  clear() {
    remove(AUTH_KEY);
  },
};

export const orderTokenStorage = {
  save(orderNumber, token) {
    writeJson(`masri_electronics_order_${orderNumber}`, token, "session");
  },
  load(orderNumber) {
    const value = readJson(`masri_electronics_order_${orderNumber}`, null, "session");
    return typeof value === "string" ? value : null;
  },
};
