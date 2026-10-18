import { Link } from "react-router-dom";
import AddToCartButton from "../../AddToCartButton.jsx";
import Media from "../shell/Media.jsx";
import { productBadges } from "../../../utils/productView.js";
import { useProductActions } from "../../../hooks/useStorefront.js";
import { CartIcon, EyeIcon } from "../shell/icons.jsx";

/**
 * The catalogue card. Takes a view built by `productView`, so a card never
 * reaches into the raw API shape and every surface shows the same states.
 *
 * Buying information stays visible on every storefront surface.
 *
 * The primary button is the product's own action: a direct add for a simple
 * product, "choose an option" for one that needs a variant, and disabled when
 * the product is sold out.
 */
export default function ProductCard({ view, listing = false, eager = false }) {
  const { openQuick, primaryAction } = useProductActions();
  if (!view) return null;

  const badges = productBadges(view);
  const cardSpecs = (view.cardAttributes.length ? view.cardAttributes : listing ? view.specs : []).slice(0, 2);
  const identity = view.modelNumber || view.sku;
  const stockLabel = view.soldOut ? "غير متوفر حالياً" : view.lowStock ? `بقي ${view.stock} فقط` : "متوفر في المخزون";

  return (
    <article className={`vs-card${listing ? " vs-card--listing" : ""}`} data-stock={view.soldOut ? "out" : "in"}>
      <div className="vs-card__media">
        <Link to={view.href} className="vs-card__link" aria-label={view.name}>
          <Media
            ratio="var(--vs-ar-product)"
            src={view.imageUrl}
            fallback={view.bg}
            alt=""
            imgClass="vs-card__img"
            eager={eager}
          />
        </Link>

        {badges.length > 0 && (
          <div className="vs-card__badges">
            {badges.map((badge) => (
              <span key={badge.key} className={`vs-badge vs-badge--${badge.tone}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className="vs-iconbtn vs-card__quick"
          onClick={() => openQuick(view)}
          aria-label={`نظرة سريعة على ${view.name}`}
          title="نظرة سريعة"
        >
          <EyeIcon size={17} />
        </button>
      </div>

      <div className="vs-card__panel">
        <Link to={view.href} className="vs-card__title vs-clamp-2">
          {view.name}
        </Link>
        {(view.brandName || identity) && (
          <span className="vs-card__identity vs-clamp-1">
            {view.brandName}{view.brandName && identity ? " | " : ""}<bdi>{identity}</bdi>
          </span>
        )}
        {cardSpecs.length > 0 && (
          <ul className="vs-card__specs">
            {cardSpecs.map(([name, value]) => <li key={`${name}-${value}`}>{name}: {value}</li>)}
          </ul>
        )}

        <div className="vs-card__meta">
          <div className="vs-price">
            <span className="vs-price__now">{view.priceText}</span>
            {view.hasSale && <del className="vs-price__was">{view.oldText}</del>}
          </div>
          {stockLabel && <span className="vs-card__stock">{stockLabel}</span>}
        </div>

        <div className="vs-card__acts">
          <AddToCartButton
            onAdd={primaryAction(view)}
            label={view.actionLabel}
            mobileLabel={view.soldOut ? "غير متوفر" : view.canAddDirectly ? "أضف للعربة" : "اختر الخيارات"}
            icon={view.canAddDirectly ? <CartIcon size={16} /> : null}
            disabled={view.soldOut}
            className="vs-btn vs-btn--primary vs-card__cta"
          />
        </div>
      </div>
    </article>
  );
}
