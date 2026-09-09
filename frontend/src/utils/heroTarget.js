const STRUCTURED_ROUTES = Object.freeze({
  products: "/shop",
  offers: "/offers",
  packages: "/packages",
  categories: "/categories",
});

function legacyDestination(buttonUrl) {
  if (Object.values(STRUCTURED_ROUTES).includes(buttonUrl)) return buttonUrl;
  const match = /^\/category\/([^/?#]+)$/.exec(buttonUrl || "");
  if (!match) return null;
  try {
    return `/category/${encodeURIComponent(decodeURIComponent(match[1]))}`;
  } catch {
    return null;
  }
}

export function resolveHeroDestination(slide) {
  if (slide?.targetType != null) {
    if (slide.targetType === "none") return null;
    if (slide.targetType === "category") {
      return slide.targetSlug ? `/category/${encodeURIComponent(slide.targetSlug)}` : null;
    }
    return STRUCTURED_ROUTES[slide.targetType] || null;
  }
  return legacyDestination(slide?.buttonUrl);
}
