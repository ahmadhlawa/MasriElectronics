import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/StoreProvider.jsx";
import { useCategoryNav, useMoney } from "../hooks/useStorefront.js";
import { catalogService } from "../services/catalog.js";
import { storefrontService } from "../services/storefront.js";
import { publicApi } from "../api/publicApi.js";
import { isStaticPreview } from "../preview/staticPreview.js";
import { productView } from "../utils/productView.js";
import Hero from "../components/public/home/Hero.jsx";
import TrustStrip from "../components/public/home/TrustStrip.jsx";
import BrandMosaic from "../components/public/home/BrandMosaic.jsx";
import { homeBrands } from "../homeBrands.js";
import SectionHead from "../components/public/shell/SectionHead.jsx";
import CategoryCard from "../components/public/catalog/CategoryCard.jsx";
import ProductGrid, { GridSkeleton } from "../components/public/catalog/ProductGrid.jsx";
import { ArrowForward } from "../components/public/shell/icons.jsx";
import { useViewportReveal } from "../hooks/useViewportReveal.js";

/**
 * Fixed homepage composition. Product data remains live, while section order and
 * copy are deliberately part of the approved storefront rather than Admin content.
 */
const SECTIONS = {
  categories: { kind: "categories", fallbackTitle: "تسوّق حسب القسم", more: "/shop" },
  featured_products: {
    kind: "products",
    layout: "grid",
    source: "featured",
    fallbackTitle: "منتجات مختارة",
    more: "/shop",
    limit: 8,
  },
  new_products: {
    kind: "products",
    layout: "grid",
    source: "newest",
    fallbackTitle: "وصل حديثاً",
    more: "/shop?sort=newest",
    limit: 8,
  },
  bestsellers: {
    kind: "products",
    layout: "rail",
    source: "bestsellers",
    fallbackTitle: "الأكثر مبيعاً",
    more: "/shop",
    limit: 10,
  },
  packages: {
    kind: "products",
    layout: "packages",
    source: "packages",
    fallbackTitle: "باقات جاهزة",
    more: "/packages",
    limit: 6,
  },
  silicone_molds: {
    kind: "products",
    layout: "split",
    source: "molds",
    fallbackTitle: "قوالب سيليكون",
    more: "/molds",
    limit: 4,
  },
  custom_text: { kind: "text", fallbackTitle: "" },
};

const LOADERS = {
  featured: (limit) => catalogService.featured(limit),
  newest: (limit) => catalogService.newest(limit),
  bestsellers: (limit) => catalogService.bestsellers(limit),
  packages: (limit) => catalogService.packages({ page_size: limit }),
  molds: (limit) => catalogService.molds({ page_size: limit }),
};

const HOME_SECTIONS = [
  { id: "categories", type: "categories", title: "تسوّق حسب التصنيف", description: "كل ما تحتاجه لبيتك في مكان واحد.", config: {} },
  { id: "featured", type: "featured_products", title: "منتجات مختارة", description: "اختيارات عملية للاستخدام اليومي.", config: {} },
  { id: "bestsellers", type: "bestsellers", title: "الأكثر طلباً", description: "أجهزة يحبها عملاؤنا.", config: {} },
  { id: "new", type: "new_products", title: "وصل حديثاً", description: "تشكيلة حديثة تواكب احتياجات المنزل.", config: {} },
  { id: "service", type: "custom_text", title: "أجهزة أصلية + كفالة + أسعار تنافسية", description: "شحن سريع | خدمة عملاء على مدار الساعة", config: {} },
];

function RevealSection({ className, children }) {
  const revealProps = useViewportReveal();
  return <section className={className} {...revealProps}>{children}</section>;
}

export default function HomePage() {
  const store = useStore();
  const money = useMoney();
  const categories = useCategoryNav();

  const [hero, setHero] = useState({ slides: [], status: "loading" });
  const [lists, setLists] = useState({});
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    let cancelled = false;
    storefrontService.heroSlides().then(
      (slides) => {
        if (cancelled) return;
        setHero({
          slides,
          status: "ready",
        });
      },
      () => !cancelled && setHero({ slides: [], status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (isStaticPreview) {
      setBrands(homeBrands);
      return undefined;
    }
    publicApi.brands()
      .then((rows) => !cancelled && setBrands(rows.map((brand) => ({ id: brand.id, name: brand.name, logo: brand.logo_url }))))
      .catch(() => !cancelled && setBrands([]));
    return () => { cancelled = true; };
  }, []);

  const needed = useMemo(() => {
    const wanted = new Map();
    HOME_SECTIONS.forEach((section) => {
      const spec = SECTIONS[section.type];
      if (spec?.kind === "products") {
        wanted.set(spec.source, Math.max(wanted.get(spec.source) || 0, spec.limit));
      }
    });
    return [...wanted.entries()];
  }, []);

  useEffect(() => {
    if (!needed.length) return undefined;
    let cancelled = false;
    needed.forEach(([source, limit]) => {
      setLists((current) =>
        current[source] ? current : { ...current, [source]: { items: [], status: "loading" } },
      );
      LOADERS[source](limit)
        .then((result) => {
          if (cancelled) return;
          setLists((current) => ({
            ...current,
            [source]: { items: result.items, status: "ready" },
          }));
        })
        .catch(() => {
          // One failed list must not take the homepage with it.
          if (cancelled) return;
          setLists((current) => ({ ...current, [source]: { items: [], status: "error" } }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [needed]);

  const views = (source) =>
    (lists[source]?.items || []).map((product) => productView(product, money));

  const rendered = HOME_SECTIONS
    .map((section) => {
      const spec = SECTIONS[section.type];
      if (!spec) return null;
      const title = section.title || spec.fallbackTitle;

      if (spec.kind === "categories") {
        if (!categories.length) return null;
        const limit = section.config?.limit || 8;
        return (
          <section key={section.id} className="vs-container vs-section">
            <SectionHead
              eyebrow={section.description || null}
              title={title}
              moreHref={spec.more}
            />
            <div className="vs-grid vs-grid--cats">
              {categories.slice(0, limit).map((category, index) => (
                <CategoryCard key={category.slug} category={category} compact eager={index < 6} revealDelay={Math.min(index * 70, 280)} />
              ))}
            </div>
          </section>
        );
      }

      if (spec.kind === "text") {
        if (!section.title && !section.description) return null;
        return (
          <RevealSection key={section.id} className="vs-container vs-section">
            <div className="vs-split__panel">
              <h2 className="vs-split__title">{section.title}</h2>
              {section.description && <p className="vs-split__desc">{section.description}</p>}
              <Link to="/shop" className="vs-btn vs-btn--lg vs-split__cta">
                تصفّح المتجر <ArrowForward size={16} />
              </Link>
            </div>
          </RevealSection>
        );
      }

      const list = lists[spec.source];
      if (!list || list.status === "error") return null;

      if (list.status === "loading") {
        return (
          <RevealSection key={section.id} className="vs-container vs-section">
            <SectionHead title={title} description={section.description} />
            <GridSkeleton count={spec.layout === "packages" ? 3 : 4} />
          </RevealSection>
        );
      }

      const items = views(spec.source).slice(0, spec.limit);
      // A section with nothing in it, or a lone card stranded in a wide row, is
      // worse than no section at all.
      if (items.length < 2) return null;

      if (spec.layout === "split") {
        return (
          <RevealSection key={section.id} className="vs-container vs-section">
            <div className="vs-split">
              <div className="vs-split__panel">
                <h2 className="vs-split__title">{title}</h2>
                {section.description && <p className="vs-split__desc">{section.description}</p>}
                <Link to={spec.more} className="vs-btn vs-btn--lg vs-split__cta">
                  عرض الكل <ArrowForward size={16} />
                </Link>
              </div>
              <div className="vs-split__grid">
                <ProductGrid views={items.slice(0, 4)} variant="plain" eagerCount={0} />
              </div>
            </div>
          </RevealSection>
        );
      }

      return (
        <section key={section.id} className="vs-container vs-section">
          <SectionHead
            title={title}
            description={section.description}
            moreHref={spec.more}
          />
          <ProductGrid views={items} variant={spec.layout} eagerCount={0} />
        </section>
      );
    })
    .filter(Boolean);

  // Before the catalog arrives there is no hero and every fixed section drops out, which
  // would leave the header sitting straight on top of the trust strip. Say so
  // instead: the store is real and reachable, it just has nothing to show yet.
  const stillLoading =
    hero.status === "loading" ||
    needed.some(([source]) => (lists[source]?.status ?? "loading") === "loading");
  const nothingToShow =
    !stillLoading && !hero.slides.length && !rendered.length && !categories.length;

  return (
    <div className="vs-home">
      {/* Deliberately outside `.vs-container`: the advertising band runs the full
          storefront width, stopping only where the category rail's gutter
          begins. Every section below it stays inside the container. */}
      {hero.status === "loading" ? (
        <div className="vs-herorow">
          <div className="vs-skel vs-hero--skel" />
        </div>
      ) : hero.slides.length > 0 ? (
        <div className="vs-herorow">
          <Hero slides={hero.slides} />
        </div>
      ) : null}

      {rendered}

      <BrandMosaic brands={brands} />

      {nothingToShow && (
        <RevealSection className="vs-container vs-section vs-section--empty-store">
          <div className="vs-state">
            <h2 className="vs-state__title">المتجر قيد التجهيز</h2>
            <p className="vs-state__body">
              نعمل على إضافة المنتجات، وسيظهر المعروض هنا فور توفره. يسعدنا تواصلكم معنا في
              أي وقت.
            </p>
            <Link to="/contact" className="vs-btn vs-btn--primary vs-btn--lg">
              تواصل معنا
            </Link>
          </div>
        </RevealSection>
      )}

      <section className="vs-container vs-section--tight">
        <TrustStrip />
      </section>
    </div>
  );
}
