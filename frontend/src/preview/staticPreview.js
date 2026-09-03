import { previewData } from "./demoData.js";

export const isStaticPreview = import.meta.env.VITE_STATIC_PREVIEW === "true";

const matches = (product, params = {}) => {
  if (params.category && product.category_slug !== params.category) return false;
  if (params.on_sale && !(product.compare_at_price > product.price)) return false;
  if (params.in_stock && !product.in_stock) return false;
  if (params.product_type && product.product_type !== params.product_type) return false;
  if (params.min_price != null && product.price < Number(params.min_price)) return false;
  if (params.max_price != null && product.price > Number(params.max_price)) return false;
  if (params.q) {
    const term = String(params.q).toLowerCase();
    if (!(product.name + " " + product.category_name + " " + product.short_description).toLowerCase().includes(term)) return false;
  }
  return true;
};

export function previewProducts(params = {}) {
  let items = previewData.products.filter((product) => matches(product, params));
  if (params.sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
  if (params.sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
  if (params.sort === "newest") items = [...items].sort((a, b) => Number(b.is_new) - Number(a.is_new) || b.sort_order - a.sort_order);
  const pageSize = Number(params.page_size || 24);
  const page = Number(params.page || 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, pages: Math.ceil(items.length / pageSize), page };
}

export { previewData };
