import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/StoreProvider.jsx";
import { useProductDetail, useVariantSelection } from "../hooks/useProductDetail.js";
import useMediaQuery from "../hooks/useMediaQuery.js";
import { useMoney, useProductActions } from "../hooks/useStorefront.js";
import { catalogService } from "../services/catalog.js";
import { attributeDisplayValue, productView } from "../utils/productView.js";
import { discountPercent } from "../utils/format.js";
import AddToCartButton from "../components/AddToCartButton.jsx";
import Gallery from "../components/public/product/Gallery.jsx";
import OptionPicker from "../components/public/product/OptionPicker.jsx";
import ProductPanels from "../components/public/product/ProductPanels.jsx";
import QuantityStepper from "../components/public/cart/QuantityStepper.jsx";
import ProductGrid from "../components/public/catalog/ProductGrid.jsx";
import SectionHead from "../components/public/shell/SectionHead.jsx";
import NotFoundRoutePage from "./NotFoundRoutePage.jsx";
import { BoxIcon, CartIcon } from "../components/public/shell/icons.jsx";

function paragraphsOf(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const store = useStore();
  const money = useMoney();
  const { addProduct } = useProductActions();
  const { product, status } = useProductDetail(slug);
  const selection = useVariantSelection(product);
  // The sticky buy bar is a phone affordance; rendering it on desktop would only
  // duplicate the price and the button in the accessibility tree.
  const compact = useMediaQuery("(max-width: 899px)");
  const desktop = useMediaQuery("(min-width: 1024px)");

  const [qty, setQty] = useState(1);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState("");
  const buyRef = useRef(null);
  const optionsRef = useRef(null);
  const buybarRef = useRef(null);
  const [showBuybar, setShowBuybar] = useState(false);

  useEffect(() => {
    setShowBuybar(false);
    const controls = buyRef.current;
    if (!compact || status !== "ready" || !controls || !("IntersectionObserver" in window)) return undefined;
    const top = parseFloat(getComputedStyle(controls).getPropertyValue("--vs-sticky-top")) || 76;
    let passed = false;
    let footerVisible = false;
    const update = () => {
      const visible = passed && !footerVisible;
      if (!visible && buybarRef.current?.contains(document.activeElement)) {
        controls.querySelector(".vs-pdp__cta")?.focus({ preventScroll: true });
      }
      setShowBuybar(visible);
    };
    const observer = new IntersectionObserver(([entry]) => {
      passed = !entry.isIntersecting && entry.boundingClientRect.bottom <= top;
      update();
    }, { rootMargin: `-${top}px 0px 0px 0px`, threshold: 0 });
    const footerObserver = new IntersectionObserver(([entry]) => {
      footerVisible = entry.isIntersecting;
      update();
    });
    observer.observe(controls);
    const footer = document.querySelector(".vs-footer");
    if (footer) footerObserver.observe(footer);
    return () => { observer.disconnect(); footerObserver.disconnect(); };
  }, [compact, status, slug]);

  useEffect(() => {
    setQty(1);
    setError("");
  }, [slug]);

  useEffect(() => setError(""), [selection.variantId, selection.selectedOptionValueIds.join("-")]);

  useEffect(() => {
    setRelated([]);
    if (status !== "ready" || !product) return undefined;
    let cancelled = false;
    store.rememberViewed(product.slug);
    catalogService
      .related(product.slug, 6)
      .then((rows) => {
        if (cancelled) return;
        const seen = new Set([product.slug]);
        setRelated(rows.filter((item) => {
          if (seen.has(item.slug)) return false;
          seen.add(item.slug);
          return true;
        }).slice(0, 6));
      })
      .catch(() => !cancelled && setRelated([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, product?.slug]);

  if (status === "loading") {
    return (
      <div className="vs-container vs-section">
        <div className="vs-pdp">
          <div className="vs-skel" style={{ aspectRatio: "1 / 1", borderRadius: 16 }} />
          <div className="vs-pdp__info">
            <div className="vs-skel" style={{ height: 14, width: "30%" }} />
            <div className="vs-skel" style={{ height: 30, width: "80%" }} />
            <div className="vs-skel" style={{ height: 34, width: "45%" }} />
            <div className="vs-skel" style={{ height: 90 }} />
            <div className="vs-skel" style={{ height: 54 }} />
          </div>
        </div>
      </div>
    );
  }

  if (status === "missing") return <NotFoundRoutePage />;

  if (status === "error" || !product) {
    return (
      <div className="vs-container vs-section">
        <div className="vs-state vs-state--error" role="alert">
          <p className="vs-state__body">تعذّر تحميل هذا المنتج. حاول مرة أخرى لاحقاً.</p>
        </div>
      </div>
    );
  }

  const view = productView(product, money);
  const selectionHasSale = view.hasSale && selection.price < product.price;
  const specs = product.specs || [];
  const structured = (product.attributes || [])
    .map((attribute) => ({ ...attribute, display: attributeDisplayValue(attribute) }))
    .filter((attribute) => attribute.label && attribute.display !== null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const keySpecs = [...structured].sort((a, b) =>
    Number(!!(b.comparable || b.show_on_card)) - Number(!!(a.comparable || a.show_on_card))
    || (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 5);
  const specIdentity = (name, value) => `${String(name).trim().replace(/\s+/g, " ").toLowerCase()}|${String(value).trim().replace(/\s+/g, " ").toLowerCase()}`;
  const structuredPairs = new Set(structured.map((attribute) => specIdentity(attribute.label, attribute.display)));
  const freeSpecs = specs.filter(([name, value]) => name && value && !structuredPairs.has(specIdentity(name, value)));
  const highlights = keySpecs.length
    ? keySpecs.map((attribute) => ({ key: attribute.key, label: attribute.label, display: attribute.display }))
    : freeSpecs.slice(0, 4).map(([label, display], index) => ({ key: `${label}-${index}`, label, display }));
  const description = paragraphsOf(product.description || product.short);

  // Returns false when the add was refused, so the button does not announce a
  // success that did not happen.
  const add = () => {
    if (selection.missingChoice) {
      setError("اختر أحد الخيارات المتاحة قبل الإضافة إلى العربة.");
      const option = optionsRef.current?.querySelector("button:not(:disabled)");
      option?.focus({ preventScroll: true });
      optionsRef.current?.scrollIntoView?.({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return false;
    }
    if (selection.soldOut || selection.unavailable) return false;
    addProduct(view, qty, selection.selected);
    return true;
  };

  const panels = [
    {
      key: "desc",
      label: "الوصف",
      content: description.length ? (
        <div className="vs-pdp__description">
          <div>
            <h2 className="vs-pdp__spec-heading">نبذة عن المنتج</h2>
            {description.map((text, index) => <p key={index} className="vs-prose">{text}</p>)}
          </div>
          {highlights.length > 0 && (
            <dl className="vs-pdp__overview">
              {highlights.slice(0, 3).map((attribute) => <div key={attribute.key}><dt>{attribute.label}</dt><dd>{attribute.display}</dd></div>)}
            </dl>
          )}
        </div>
      ) : (
        <p className="vs-prose vs-prose--muted">لا يتوفر وصف تفصيلي لهذا المنتج بعد.</p>
      ),
    },
    {
      key: "specs",
      label: "المواصفات",
      content: structured.length || freeSpecs.length ? (
        <div className="vs-pdp__specsections">
          {structured.length > 0 && (
            <section>
              <h3 className="vs-pdp__spec-heading">الخصائص الفنية</h3>
              <dl className="vs-specs">
                {structured.map((attribute) => (
                  <div className="vs-specs__row" key={attribute.key}>
                    <dt>{attribute.label}</dt><dd>{attribute.display}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {freeSpecs.length > 0 && (
            <section>
              {structured.length > 0 && <h3 className="vs-pdp__spec-heading">مواصفات إضافية</h3>}
              <dl className="vs-specs">
                {freeSpecs.map(([name, value], index) => (
                  <div className="vs-specs__row" key={`${name}-${index}`}>
                    <dt>{name}</dt><dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      ) : (
        <p className="vs-prose vs-prose--muted">لا تتوفر مواصفات إضافية لهذا المنتج.</p>
      ),
    },
    {
      key: "delivery",
      label: "التوصيل والدفع",
      content: (
        <ul className="vs-bullets">
          <li>الدفع نقداً عند الاستلام.</li>
          <li>لا يطلب المتجر بيانات بطاقات بنكية في أي مرحلة.</li>
          <li>تُحتسب رسوم التوصيل حسب المنطقة في صفحة إتمام الطلب.</li>
          <li>
            راجع <Link to="/page/return-policy">سياسة التبديل والإرجاع</Link> قبل الطلب.
          </li>
        </ul>
      ),
    },
  ];

  const availability = (
    <p className="vs-pdp__stock" data-tone={selection.soldOut ? "out" : selection.stock < 5 && product.trackInventory ? "low" : "ok"}>
      {selection.soldOut
        ? "غير متوفر حالياً"
        : !product.trackInventory
          ? "متوفر"
          : selection.stock < 5
            ? `متبقٍ ${selection.stock} فقط`
            : "متوفر في المخزون"}
    </p>
  );
  const pricing = (
    <div className="vs-pdp__pricing">
      <div className="vs-price vs-price--lg">
        <span className="vs-price__now">{money(selection.price)}</span>
        {selectionHasSale && <del className="vs-price__was">{view.oldText}</del>}
      </div>
      {selectionHasSale && (
        <span className="vs-pdp__saving">
          وفّر {desktop ? `${discountPercent(selection.price, product.price)}٪` : money(product.price - selection.price)}
        </span>
      )}
    </div>
  );
  const keySpecifications = highlights.length > 0 && (
    <section className="vs-pdp__key-specs" aria-label="أبرز المواصفات">
      <h2>أبرز المواصفات</h2>
      <dl>
        {highlights.map((attribute) => (
          <div key={attribute.key}><dt>{attribute.label}</dt><dd>{attribute.display}</dd></div>
        ))}
      </dl>
    </section>
  );
  const shortDescription = product.short && (
    <p className="vs-pdp__short">{product.short}</p>
  );
  return (
    <>
      <div className="vs-container vs-pdp-crumbs">
        <nav className="vs-crumbs" aria-label="مسار التصفح">
          <Link to="/">الرئيسية</Link>
          <span aria-hidden="true">›</span>
          {view.categoryHref ? (
            <>
              <Link to={view.categoryHref}>{view.categoryName}</Link>
              <span aria-hidden="true">›</span>
            </>
          ) : null}
          <span className="vs-crumbs__here">{view.name}</span>
        </nav>
      </div>

      <div className="vs-container">
        <div className="vs-pdp">
          <Gallery images={product.images} fallback={view.bg} alt={view.name} />

          <div className="vs-pdp__info">
            <div className="vs-pdp__heading">
              <div className="vs-pdp__badges" data-empty={!(view.isPackage || view.isNew || (!desktop && selectionHasSale))}>
                {view.isPackage && <span className="vs-badge vs-badge--package">بكج</span>}
                {!desktop && selectionHasSale && <span className="vs-badge vs-badge--sale">−{discountPercent(selection.price, product.price)}٪</span>}
                {view.isNew && <span className="vs-badge vs-badge--new">جديد</span>}
              </div>

              <h1 className="vs-pdp__title">{view.name}</h1>
              <div className="vs-pdp__identity">
                {product.brandName && <span className="vs-pdp__brand">{product.brandName}</span>}
                {product.modelNumber && <span className="vs-pdp__model">الموديل: <bdi>{product.modelNumber}</bdi></span>}
                {product.sku && <span className="vs-pdp__sku">رمز المنتج: <bdi>{product.sku}</bdi></span>}
              </div>
            </div>

            {availability}
            {pricing}
            {shortDescription || keySpecifications}
            <div className="vs-pdp__purchase">
              {selection.requiresChoice && (
                <div ref={optionsRef}>
                  <OptionPicker
                    product={product}
                    variants={selection.variants}
                    variantId={selection.variantId}
                    onPick={selection.setVariantId}
                    simpleChoices={selection.simpleChoices}
                    onSimplePick={selection.setSimpleChoice}
                    error={error}
                  />
                </div>
              )}

              {selection.unavailable && (
                <p className="vs-pdp__notice" role="status">
                  هذا المنتج بحاجة إلى تحديد الخيارات مع فريق المتجر قبل الطلب.
                </p>
              )}

              {view.isPackage && product.packageItems.length > 0 && (
                <div className="vs-pkgbox">
                  <h2 className="vs-pkgbox__title">
                    <BoxIcon size={17} /> محتويات البكج
                  </h2>
                  <ul>
                    {product.packageItems.map((item) => (
                      <li key={item.id}>
                        {item.slug ? (
                          <Link to={`/product/${item.slug}`}>{item.label}</Link>
                        ) : (
                          item.label
                        )}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="vs-pdp__buy" ref={buyRef}>
                <span className="vs-pdp__quantity-label">الكمية</span>
                <QuantityStepper
                  value={qty}
                  onDecrease={() => setQty((value) => Math.max(1, value - 1))}
                  onIncrease={() => setQty((value) => value + 1)}
                  size="lg"
                />
                {qty > 1 && <span className="vs-pdp__subtotal">الإجمالي: <bdi>{money(selection.price * qty)}</bdi></span>}
                <div className="vs-pdp__actions">
                  <AddToCartButton
                    onAdd={add}
                    icon={<CartIcon size={18} />}
                    label={
                      selection.soldOut
                        ? "غير متوفر حالياً"
                        : "أضف إلى العربة"
                    }
                    disabled={selection.soldOut || selection.unavailable}
                    className="vs-btn vs-btn--primary vs-btn--lg vs-pdp__cta"
                  />
                </div>
              </div>
            </div>


          </div>

        </div>
        <section className="vs-pdp__panels" aria-label="تفاصيل المنتج">
          <ProductPanels panels={panels} />
        </section>
      </div>

      {related.length > 0 && (
        <section className="vs-container vs-section vs-related" aria-label="قد يعجبك أيضًا">
          <SectionHead title="قد يعجبك أيضًا" moreHref={view.categoryHref || "/shop"} />
          <ProductGrid
            views={related.map((item) => productView(item, money))}
            eagerCount={0}
            variant="rail"
            listing
          />
        </section>
      )}

      {compact && showBuybar && !store.overlay && (
      <div className="vs-buybar" ref={buybarRef} role="region" aria-label="شراء المنتج">
        <div className="vs-buybar__text">
          <span className="vs-buybar__name">{view.name}</span>
          <span className="vs-buybar__price">{money(selection.price * qty)}</span>
        </div>
        <AddToCartButton
          onAdd={add}
          label={selection.soldOut ? "غير متوفر" : selection.missingChoice ? "اختر الخيارات" : "أضف إلى العربة"}
          disabled={selection.soldOut || selection.unavailable}
          className="vs-btn vs-btn--primary vs-buybar__cta"
        />
      </div>
      )}
    </>
  );
}
