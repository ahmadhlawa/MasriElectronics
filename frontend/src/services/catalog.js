// Translates API payloads into the shape the storefront components expect.
// The design speaks of `price` (struck through) and `sale`; the API speaks of
// `price` (what is charged) and `compare_at_price` (the reference price).
import { publicApi } from "../api/publicApi.js";
import { backgroundFor, galleryFor } from "../utils/placeholder.js";
import { isStaticPreview, previewData, previewProducts } from "../preview/staticPreview.js";

export function normalizeProduct(raw) {
  if (!raw) return null;
  const hasCompare = raw.compare_at_price != null && raw.compare_at_price > raw.price;
  const seed = raw.category_slug || raw.slug;
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    productType: raw.product_type,
    categoryId: raw.category_id ?? null,
    categoryName: raw.category_name || "",
    categorySlug: raw.category_slug || "",
    brandId: raw.brand_id ?? null,
    brandName: raw.brand_name || "",
    brandLogoUrl: raw.brand_logo_url || null,
    // list price (struck through) and the discounted price actually charged
    price: hasCompare ? Number(raw.compare_at_price) : Number(raw.price),
    sale: hasCompare ? Number(raw.price) : null,
    sku: raw.sku || "",
    modelNumber: raw.model_number || "",
    cardAttributes: (raw.card_attributes || []).slice(0, 2),
    attributes: raw.attributes || [],
    stock: raw.stock_quantity ?? 0,
    trackInventory: raw.track_inventory !== false,
    inStock: raw.in_stock !== false,
    isNew: !!raw.is_new,
    featured: !!raw.is_featured,
    bestSeller: !!raw.is_bestseller,
    short: raw.short_description || "",
    description: raw.description || "",
    imageUrl: raw.primary_image_url || null,
    // Present on the list projection too, so a card can cross-fade to it on
    // hover without fetching the product's detail payload.
    secondaryImageUrl: raw.secondary_image_url || null,
    bg: backgroundFor(raw.primary_image_url, seed),
    gallery: galleryFor(raw.images, seed),
    images: raw.images || [],
    specs: (raw.specifications || []).map((spec) => [spec.name, spec.value]),
    options: raw.options || [],
    variants: raw.variants || [],
    // Present on both projections: the list payload omits the option rows, so a
    // card relies on the flag alone to decide direct-add vs. choose-an-option.
    hasOptions: !!raw.has_options || (raw.options || []).length > 0,
    packageItemCount: raw.package_item_count ?? (raw.package_items || []).length,
    packageItems: (raw.package_items || []).map((item) => ({
      id: item.id,
      productId: item.included_product_id,
      label: item.display_note || item.included_product_name || "",
      slug: item.included_product_slug || "",
      quantity: item.quantity,
      bg: backgroundFor(item.included_product_image_url, item.included_product_slug || item.id),
    })),
  };
}

export function normalizeCategory(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description || "",
    imageUrl: raw.image_url || null,
    bg: backgroundFor(raw.image_url, raw.slug),
    featured: !!raw.is_featured,
    count: raw.product_count ?? 0,
    children: (raw.children || []).map((child) => ({
      id: child.id,
      slug: child.slug,
      name: child.name,
      count: child.product_count ?? 0,
    })),
  };
}

const page = (response) => ({
  items: (response?.items || []).map(normalizeProduct),
  total: response?.total ?? 0,
  pages: response?.pages ?? 0,
  page: response?.page ?? 1,
});

export const catalogService = {
  async list(params) {
    if (isStaticPreview) return page(previewProducts(params));
    return page(await publicApi.products(params));
  },
  async bySlug(slug) {
    if (isStaticPreview) return normalizeProduct(previewData.products.find((item) => item.slug === slug));
    return normalizeProduct(await publicApi.product(slug));
  },
  async related(slug, limit = 4) {
    if (isStaticPreview) {
      const product = previewData.products.find((item) => item.slug === slug);
      return previewData.products.filter((item) => item.slug !== slug && item.category_slug === product?.category_slug).slice(0, limit).map(normalizeProduct);
    }
    const rows = await publicApi.relatedProducts(slug, limit);
    return rows.map(normalizeProduct);
  },
  async categories() {
    if (isStaticPreview) return previewData.categories.map(normalizeCategory);
    const rows = await publicApi.categories();
    return rows.map(normalizeCategory);
  },
  async category(slug) {
    if (isStaticPreview) return normalizeCategory(previewData.categories.find((item) => item.slug === slug));
    return normalizeCategory(await publicApi.category(slug));
  },
  async categoryAttributes(slug) {
    if (isStaticPreview) return [];
    return publicApi.categoryAttributes(slug);
  },
  async brands() {
    if (isStaticPreview) return [...new Map(previewData.products.filter((row) => row.brand_id && row.brand_name).map((row) => [row.brand_id, { id: row.brand_id, name: row.brand_name }])).values()];
    return publicApi.brands();
  },
  async featured(limit = 8) {
    if (isStaticPreview) return page({ ...previewProducts(), items: previewData.products.filter((item) => item.is_featured).slice(0, limit) });
    return page(await publicApi.featuredProducts({ page_size: limit }));
  },
  async newest(limit = 8) {
    if (isStaticPreview) return page({ ...previewProducts(), items: previewData.products.filter((item) => item.is_new).slice(0, limit) });
    return page(await publicApi.newProducts({ page_size: limit }));
  },
  async bestsellers(limit = 8) {
    if (isStaticPreview) return page({ ...previewProducts(), items: previewData.products.filter((item) => item.is_bestseller).slice(0, limit) });
    return page(await publicApi.bestsellers({ page_size: limit }));
  },
  async packages(params) {
    return page(await publicApi.packages(params));
  },
  async molds(params) {
    return page(await publicApi.molds(params));
  },
};
