import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "../../../hooks/useMediaQuery.js";
import { TagIcon } from "../shell/icons.jsx";

function CategoryLogo({ category, duplicate }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const hasImage = category.imageUrl && category.imageUrl !== failedUrl;
  return (
    <Link to={category.href} className="vs-category-logos__item" aria-label={category.name} tabIndex={duplicate ? -1 : undefined}>
      {hasImage ? (
        <img src={category.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(category.imageUrl)} />
      ) : (
        <span className="vs-category-logos__fallback" aria-hidden="true"><TagIcon size={28} /></span>
      )}
      <span className="vs-category-logos__label">{category.name}</span>
    </Link>
  );
}

/** Native scrolling keeps touch and keyboard navigation independent of autoplay. */
export default function CategoryLogoCarousel({ categories, label = "تسوّق حسب التصنيف" }) {
  const viewportRef = useRef(null);
  const groupRef = useRef(null);
  const spanRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const [overflow, setOverflow] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const looping = overflow && !reducedMotion;

  useEffect(() => {
    const viewport = viewportRef.current;
    const group = groupRef.current;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(group).paddingInlineEnd) || 0;
      spanRef.current = group.getBoundingClientRect().width;
      setOverflow(group.scrollWidth - gap > viewport.clientWidth + 1);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(viewport);
    observer?.observe(group);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [categories]);

  useEffect(() => {
    if (!looping || hovered || focused || stopped) return undefined;
    const viewport = viewportRef.current;
    const sign = getComputedStyle(viewport).direction === "rtl" ? -1 : 1;
    let position = Math.abs(viewport.scrollLeft);
    let previous = null;
    let frame;
    const move = (now) => {
      const span = spanRef.current;
      if (previous !== null && span > 0 && !document.hidden) {
        // Keep fractional progress: native scrollLeft may round to whole pixels.
        position = (position + Math.min(now - previous, 64) * 0.02) % span;
        viewport.scrollLeft = sign * position;
      }
      previous = now;
      frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, [looping, hovered, focused, stopped, categories]);

  const stop = () => setStopped(true);
  return (
    <div className="vs-category-logos">
      <div
        ref={viewportRef}
        className="vs-category-logos__viewport"
        role="region"
        aria-label={label}
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
        onPointerDown={stop}
        onTouchStart={stop}
        onWheel={stop}
        onKeyDown={stop}
      >
        <div className="vs-category-logos__track">
          <div ref={groupRef} className="vs-category-logos__group">
            {categories.map((category) => <CategoryLogo key={category.slug} category={category} />)}
          </div>
          {looping && (
            <div className="vs-category-logos__group" aria-hidden="true">
              {categories.map((category) => <CategoryLogo key={category.slug} category={category} duplicate />)}
            </div>
          )}
        </div>
      </div>
      {looping && (
        <button type="button" className="vs-category-logos__motion" onClick={() => setStopped((current) => !current)}>
          {stopped ? "تشغيل حركة الأقسام" : "إيقاف حركة الأقسام"}
        </button>
      )}
    </div>
  );
}
