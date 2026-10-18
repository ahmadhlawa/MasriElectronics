import { useEffect, useId, useRef, useState } from "react";
import ProductCard from "./ProductCard.jsx";
import PackageCard from "./PackageCard.jsx";
import { ArrowForward } from "../shell/icons.jsx";

function ProductRail({ children }) {
  const ref = useRef(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const rail = ref.current;
    if (!rail) return;
    const position = Math.abs(rail.scrollLeft);
    const start = position < 2;
    const end = position + rail.clientWidth >= rail.scrollWidth - 2;
    setEdges((current) => current.start === start && current.end === end ? current : { start, end });
  };
  useEffect(() => {
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ref.current) observer?.observe(ref.current);
    return () => observer?.disconnect();
  }, [children]);
  const scroll = (forward) => {
    const rail = ref.current;
    const direction = getComputedStyle(rail).direction === "rtl" ? -1 : 1;
    rail.scrollBy({ left: direction * (forward ? 1 : -1) * rail.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="vs-product-rail">
      <div className="vs-rail" ref={ref} id={id} onScroll={measure} tabIndex={0} role="region" aria-label="تصفّح المنتجات">
        {children}
      </div>
      {!(edges.start && edges.end) && (
        <div className="vs-product-rail__controls" role="group" aria-label="التنقل بين المنتجات">
          <button type="button" className="vs-iconbtn" aria-label="المنتجات السابقة" aria-controls={id} disabled={edges.start} onClick={() => scroll(false)}><ArrowForward size={18} /></button>
          <button type="button" className="vs-iconbtn" aria-label="المنتجات التالية" aria-controls={id} disabled={edges.end} onClick={() => scroll(true)}><ArrowForward size={18} /></button>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton reserves both the appliance image and the visible buying details.
 */
export function CardSkeleton() {
  return (
    <div className="vs-cardskel" aria-hidden="true">
      <div className="vs-skel vs-cardskel__media" />
      <div className="vs-cardskel__body">
        <div className="vs-skel" style={{ height: 13, width: "88%" }} />
        <div className="vs-skel" style={{ height: 13, width: "56%" }} />
        <div className="vs-skel" style={{ height: 40, marginTop: 6 }} />
      </div>
    </div>
  );
}

const WRAPPER = {
  grid: "vs-grid",
  packages: "vs-grid vs-grid--packages",
  categories: "vs-grid vs-grid--cats",
  rail: "vs-rail",
  // "plain" emits the cards with no wrapper, for a parent that already is a grid.
  plain: null,
};

export function GridSkeleton({ count = 8, variant = "grid" }) {
  return (
    <div className={WRAPPER[variant] || WRAPPER.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * One grid for products and packages alike: a package renders its own card, so
 * a mixed result set still reads correctly.
 */
export default function ProductGrid({ views, variant = "grid", eagerCount = 4, listing = false }) {
  if (!views?.length) return null;
  const cards = views.map((view, index) =>
    view.isPackage ? (
      <PackageCard key={view.id} view={view} listing={listing} eager={index < eagerCount} />
    ) : (
      <ProductCard key={view.id} view={view} listing={listing} eager={index < eagerCount} />
    ),
  );
  const wrapper = WRAPPER[variant];
  if (variant === "rail") return <ProductRail>{cards}</ProductRail>;
  return wrapper ? <div className={wrapper}>{cards}</div> : cards;
}
