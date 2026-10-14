import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import {
  categoryFixture,
  renderApp,
  settingsFixture,
  storefrontRoutes,
  stubApi,
} from "./utils.jsx";

/** A root category with children, so mobile navigation has children to expand. */
const parentCategory = {
  ...categoryFixture,
  id: 7,
  name: "مطبوعات المناسبات",
  slug: "event-print",
  children: [
    { id: 8, name: "لافتات", slug: "signs", product_count: 4 },
    { id: 9, name: "ستاندات", slug: "stands", product_count: 2 },
  ],
};

const heroSlides = [
  {
    id: 1,
    title: "إعلان الأول",
    subtitle: "",
    description: "",
    button_label: "",
    button_url: "/shop",
    image_url: "/media/preview/one.png",
    sort_order: 0,
  },
  {
    id: 2,
    title: "إعلان الثاني",
    subtitle: "",
    description: "",
    button_label: "",
    button_url: "/shop",
    image_url: "/media/preview/two.png",
    sort_order: 1,
  },
];

describe("homepage hero", () => {
  const heroRoutes = {
    ...storefrontRoutes,
    "/api/v1/hero-slides": heroSlides,
  };

  it("shows exactly one advertising image at a time", async () => {
    stubApi(heroRoutes);
    renderApp("/");

    await waitFor(() => expect(document.querySelectorAll(".vs-hero__slide")).toHaveLength(2));
    expect(document.querySelectorAll('.vs-hero__slide[data-active="true"]')).toHaveLength(1);
    expect(document.querySelector('.vs-hero__slide[data-active="true"] img')).toHaveAttribute(
      "src",
      "/media/preview/one.png",
    );
  });

  it("renders no promotional cards beside the hero", async () => {
    stubApi(heroRoutes);
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-hero")).not.toBeNull());
    expect(document.querySelector(".vs-promocol")).toBeNull();
    expect(document.querySelectorAll(".vs-promo")).toHaveLength(0);
  });

  it("leaves the hero empty when the database has no slides", async () => {
    stubApi({ ...heroRoutes, "/api/v1/hero-slides": [] });
    renderApp("/");

    await waitFor(() =>
      expect(document.querySelector(".vs-header .vs-logo__name")).toHaveTextContent(settingsFixture.store_name_ar),
    );
    expect(document.querySelector(".vs-hero__slide")).toBeNull();
  });

  it("renders no controls over the uploaded artwork", async () => {
    stubApi(heroRoutes);
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-hero")).not.toBeNull());
    expect(document.querySelector(".vs-hero__dots")).toBeNull();
    expect(document.querySelector(".vs-hero__arrows")).toBeNull();
  });

  it("does not autoplay when the visitor has asked for reduced motion", async () => {
    window.__mediaMatches = (query) => query.includes("prefers-reduced-motion");
    stubApi(heroRoutes);
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-hero")).not.toBeNull());
    const active = () =>
      [...document.querySelectorAll(".vs-hero__slide")].findIndex(
        (slide) => slide.dataset.active === "true",
      );
    expect(active()).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(active()).toBe(0);
  });
});

describe("hero advertisement copy", () => {
  /** One finished advertisement, one slide the Admin gave supporting copy. */
  const mixedSlides = [
    {
      id: 11,
      title: "إعلان جاهز",
      subtitle: "",
      description: "",
      button_label: "",
      button_url: "",
      image_url: "/media/preview/complete-ad.png",
      sort_order: 0,
    },
    {
      id: 12,
      title: "عنوان الشريحة",
      subtitle: "عنوان فرعي",
      description: "نص كتبه المسؤول في لوحة التحكم.",
      button_label: "تسوّق",
      button_url: "/shop",
      image_url: "/media/preview/with-copy.png",
      sort_order: 1,
    },
  ];

  const routesFor = (slides) => ({
    ...storefrontRoutes,
    "/api/v1/hero-slides": slides,
  });

  it("shows an image-only advertisement with nothing printed over it", async () => {
    stubApi(routesFor(mixedSlides));
    renderApp("/");

    await waitFor(() => expect(document.querySelectorAll(".vs-hero__slide")).toHaveLength(2));
    const [advert, withCopy] = document.querySelectorAll(".vs-hero__slide");

    // The artwork carries its own typography: no heading, no paragraph, no
    // eyebrow, no button and no darkening veil laid over it.
    expect(advert.querySelector(".vs-hero__body")).toBeNull();
    expect(advert.querySelector(".vs-hero__veil")).toBeNull();
    expect(advert.querySelector(".vs-hero__cta")).toBeNull();
    expect(screen.queryByText("إعلان جاهز")).not.toBeInTheDocument();
    expect(advert.querySelector("img")).toHaveAttribute("alt", "");

    // Masri Electronics ignores legacy copy fields even if a record still carries them.
    expect(withCopy.querySelector(".vs-hero__body")).toBeNull();
    expect(withCopy.querySelector(".vs-hero__veil")).toBeNull();
    expect(withCopy.querySelector(".vs-hero__cta")).toBeNull();
    expect(screen.queryByText("نص كتبه المسؤول في لوحة التحكم.")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".vs-hero__body")).toHaveLength(0);
  });

  it("omits a slide with no artwork instead of fabricating a fallback", async () => {
    stubApi(
      routesFor([
        {
          id: 13,
          title: "بدون صورة",
          subtitle: "",
          description: "",
          button_label: "",
          button_url: "",
          image_url: null,
          sort_order: 0,
        },
      ]),
    );
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-header")).not.toBeNull());
    expect(document.querySelector(".vs-hero")).toBeNull();
    expect(screen.queryByText("بدون صورة")).not.toBeInTheDocument();
  });

  it("runs the hero band outside the page container", async () => {
    stubApi(routesFor(mixedSlides));
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-hero")).not.toBeNull());
    const row = document.querySelector(".vs-herorow");
    expect(row.classList.contains("vs-container")).toBe(false);
    expect(row.closest(".vs-container")).toBeNull();
  });
});

describe("store logo", () => {
  const branded = {
    ...storefrontRoutes,
    "/api/v1/store/settings": { ...settingsFixture, logo_url: "/brand/store-logo.png" },
  };

  it("clips the logo to a fixed viewport and leaves the file untouched", async () => {
    stubApi(branded);
    renderApp("/");

    // The header's, not the footer's — both render the same file.
    await waitFor(() => expect(document.querySelector(".vs-header .vs-logo__img")).not.toBeNull());
    const logo = document.querySelector(".vs-header .vs-logo__img");
    expect(logo.closest(".vs-logo__box")).not.toBeNull();
    expect(logo).toHaveAttribute("src", "/branding/logo-without-name.png");
    // The mark is decorative: the wordmark beside it already names the store, so
    // announcing it twice is what a screen reader would otherwise get.
    expect(logo).toHaveAttribute("alt", "");
    expect(logo).toHaveAttribute("aria-hidden", "true");
    // Nothing measurable here — no canvas in jsdom — so the fit must not have
    // written any geometry of its own: the stylesheet's `contain` still rules.
    expect(logo.getAttribute("style")).toBeNull();
  });

  it("writes the store name beside the mark rather than behind it", async () => {
    stubApi(branded);
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-logo__name")).not.toBeNull());
    // Masri Electronics's supplied logo is a square lockup whose own wordmark is illegible at
    // header size, so the name is set in type next to it — a logo never removes
    // the store's name from the header.
    expect(document.querySelector(".vs-logo__name")).toHaveTextContent(settingsFixture.store_name_ar);
    expect(document.querySelector(".vs-header .vs-logo__box")).not.toBeNull();
  });

  it("uses the supplied Masri mark when the store has configured none", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");

    await waitFor(() => expect(document.querySelector(".vs-logo")).not.toBeNull());
    expect(document.querySelector(".vs-header .vs-logo__img")).not.toBeNull();
    // What the store *has* set still wins over the shipped defaults — the
    // fallback fills gaps, it does not overwrite the owner's identity.
    expect(document.querySelector(".vs-logo__name")).toHaveTextContent(settingsFixture.store_name_ar);
    expect(document.querySelector(".vs-logo__tag")).toHaveTextContent("أجهزة كهربائية منزلية");
  });
});

describe("homepage category strip", () => {
  it("keeps category artwork and routes in a dedicated strip", async () => {
    stubApi({ ...storefrontRoutes, "/api/v1/categories": [categoryFixture, parentCategory] });
    renderApp("/");
    const heading = await screen.findByRole("heading", { name: "تسوّق حسب التصنيف" });
    const section = heading.closest("section");
    const strip = await within(section).findByRole("region", { name: "تسوّق حسب التصنيف" });
    expect(within(strip).getAllByRole("link")).toHaveLength(2);
    expect(within(strip).getByRole("link", { name: categoryFixture.name }))
      .toHaveAttribute("href", `/category/${categoryFixture.slug}`);
    expect(within(section).getByRole("link", { name: /عرض الكل/ })).toHaveAttribute("href", "/categories");
    expect(section.querySelector(".vs-cat")).toBeNull();
  });
});
