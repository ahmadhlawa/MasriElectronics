import { Link } from "react-router-dom";
import AddToCartButton from "../../AddToCartButton.jsx";
import Media from "../shell/Media.jsx";
import { productBadges } from "../../../utils/productView.js";
import { useCardReveal } from "../../../hooks/useCardReveal.js";
import { useViewportReveal } from "../../../hooks/useViewportReveal.js";
import { useProductActions } from "../../../hooks/useStorefront.js";
import { EyeIcon, PlusIcon } from "../shell/icons.jsx";

/**
 * The catalogue card. Takes a view built by `productView`, so a card never
 * reaches into the raw API shape and every surface shows the same states.
 *
 * On the homepage the details panel keeps its existing reveal behaviour.
 * Listing cards keep the panel visible so name, price and stock can be scanned.
 *
 * The primary button is the product's own action: a direct add for a simple
 * product, "choose an option" for one that needs a variant, and disabled when
 * the product is sold out.
 */
export default function ProductCard({ view, listing = false, eager = false, revealDelay = 0 }) {
  const { openQuick, primaryAction } = useProductActions();
  const { cardProps } = useCardReveal();
  const revealProps = useViewportReveal(revealDelay);
  if (!view) return null;

  const badges = productBadges(view);
  const listingSpecs = view.cardAttributes.length ? view.cardAttributes : view.specs;
  // Listing cards state availability in the visible panel. Other cards retain
  // the existing sold-out veil and disabled button.
  const stockLabel = view.soldOut ? (listing ? "غير متوفر حالياً" : "") : view.lowStock ? `بقي ${view.stock} فقط` : "متوفر";

  return (
    <article className={`vs-card${listing ? " vs-card--listing" : ""}`} {...revealProps} {...(listing ? {} : cardProps)}>
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

        {view.soldOut && !listing && (
          <div className="vs-card__veil">
            <span>غير متوفر حالياً</span>
          </div>
        )}
      </div>

      <div className="vs-card__panel">
        {listing && view.brandName && <span className="vs-card__brand">{view.brandName}</span>}
        <Link to={view.href} className="vs-card__title vs-clamp-2">
          {view.name}
        </Link>
        {listing && (view.modelNumber || view.sku) && <span className="vs-card__sku">{view.modelNumber ? "رقم الموديل" : "رمز المنتج"}: <bdi>{view.modelNumber || view.sku}</bdi></span>}
        {listing && listingSpecs.length > 0 && (
          <ul className="vs-card__specs">
            {listingSpecs.map(([name, value]) => <li key={`${name}-${value}`}>{name}: {value}</li>)}
          </ul>
        )}

        <div className="vs-card__meta">
          <div className="vs-price">
            <span className="vs-price__now">{view.priceText}</span>
            {view.hasSale && <span className="vs-price__was">{view.oldText}</span>}
          </div>
          {stockLabel && <span className="vs-card__stock">{stockLabel}</span>}
        </div>

        <div className="vs-card__acts">
          <AddToCartButton
            onAdd={primaryAction(view)}
            label={view.actionLabel}
            icon={view.canAddDirectly ? <PlusIcon size={15} /> : null}
            disabled={view.soldOut}
            className="vs-btn vs-btn--primary vs-card__cta"
          />
          <button
            type="button"
            className="vs-iconbtn vs-card__quick"
            onClick={() => openQuick(view)}
            aria-label={`نظرة سريعة على ${view.name}`}
            title="نظرة سريعة"
          >
            <EyeIcon size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
