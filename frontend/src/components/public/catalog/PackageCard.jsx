import { Link } from "react-router-dom";
import AddToCartButton from "../../AddToCartButton.jsx";
import Media from "../shell/Media.jsx";
import { useProductActions } from "../../../hooks/useStorefront.js";
import { ArrowForward, BoxIcon } from "../shell/icons.jsx";

/** Packages share the product card rhythm and show their real contents. */
export default function PackageCard({ view, listing = false, eager = false }) {
  const { primaryAction } = useProductActions();
  if (!view) return null;

  const items = view.packageItems || [];
  // Whatever the payload actually knows about the contents — the item names when
  // the detail projection supplied them, otherwise the count. Never an invention.
  const contents = items.length
    ? items
        .slice(0, 3)
        .map((item) => item.label)
        .filter(Boolean)
        .join(" • ")
    : view.packageCount > 0
      ? view.packageCount === 1
        ? "يحتوي على عنصر واحد"
        : `يحتوي على ${view.packageCount} عناصر`
      : view.short || "";

  return (
    <article className={`vs-pkg${listing ? " vs-pkg--listing" : ""}`} data-stock={view.soldOut ? "out" : "in"}>
      <div className="vs-pkg__media">
        <Link to={view.href} className="vs-pkg__link" aria-label={view.name}>
          <Media
            ratio="var(--vs-ar-package)"
            src={view.imageUrl}
            fallback={view.bg}
            alt=""
            imgClass="vs-pkg__img"
            eager={eager}
          />
          {view.secondaryImageUrl && (
            <img
              className="vs-pkg__img2"
              src={view.secondaryImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
        </Link>

        <div className="vs-pkg__badges">
          <span className="vs-badge vs-badge--package">بكج</span>
          {view.hasSale && <span className="vs-badge vs-badge--sale">{view.discountText}</span>}
        </div>

        <Link to={view.href} className="vs-pkg__details" data-card-action="details">
          التفاصيل <ArrowForward size={14} />
        </Link>
      </div>

      <div className="vs-pkg__panel">
        {view.brandName && <span className="vs-card__brand">{view.brandName}</span>}
        <Link to={view.href} className="vs-pkg__title vs-clamp-2">
          {view.name}
        </Link>
        {(view.modelNumber || view.sku) && <span className="vs-card__sku">{view.modelNumber ? "الموديل" : "رمز المنتج"}: <bdi>{view.modelNumber || view.sku}</bdi></span>}

        {contents && (
          <span className="vs-pkg__contents vs-clamp-2">
            <BoxIcon size={14} />
            {contents}
          </span>
        )}

        <div className="vs-card__meta">
          <div className="vs-price">
            <span className="vs-price__now">{view.priceText}</span>
            {view.hasSale && <del className="vs-price__was">{view.oldText}</del>}
          </div>
          <span className="vs-card__stock">{view.soldOut ? "غير متوفر حالياً" : "متوفر في المخزون"}</span>
        </div>

        <div className="vs-pkg__acts">
          <AddToCartButton
            onAdd={primaryAction(view)}
            label={view.actionLabel}
            disabled={view.soldOut}
            className="vs-btn vs-btn--primary vs-pkg__cta"
          />
        </div>
      </div>
    </article>
  );
}
