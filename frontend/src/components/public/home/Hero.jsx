import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useMediaQuery from "../../../hooks/useMediaQuery.js";
import { imagePath, isPreviewPlaceholder } from "../../../utils/placeholder.js";
import { resolveHeroDestination } from "../../../utils/heroTarget.js";
import { ArrowForward } from "../shell/icons.jsx";

const INTERVAL_MS = 6000;

/** Preserve the approved artwork and add accessible slide navigation. */
export default function Hero({ slides }) {
  const mobile = useMediaQuery("(max-width: 899px)");
  const [index, setIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visibleSlides = slides.filter((slide) => slide.imageUrl?.trim() && !failedUrls.includes(slide.imageUrl) && !isPreviewPlaceholder(slide.imageUrl));
  const count = visibleSlides.length;
  const activeIndex = count ? index % count : 0;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (count < 2 || hidden || paused || hovered) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count, hidden, paused, hovered]);

  if (!count) return null;

  return (
    <section className="vs-hero" aria-label="العروض" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}>
      {visibleSlides.map((slide, slideIndex) => {
        const approvedArtwork = imagePath(slide.imageUrl) === "/branding/hero.png";
        const mobileHeadline = "حلول كهربائية متكاملة لبيتك ومشروعك";
        const destination = resolveHeroDestination(slide) || (mobile && approvedArtwork ? "/shop" : null);
        const active = slideIndex === activeIndex;
        const artwork = (
          <>
            <div className="vs-mediabox vs-hero__media">
              <img className="vs-media" src={slide.imageUrl} alt="" loading={slideIndex === 0 ? "eager" : "lazy"} decoding="async"
                onError={() => setFailedUrls((current) => current.includes(slide.imageUrl) ? current : [...current, slide.imageUrl])} />
            </div>
            {mobile && approvedArtwork && (
              <div className="vs-hero__copy">
                <h1>{mobileHeadline}</h1>
                {destination && <span className="vs-hero__cta">تصفّح المنتجات <ArrowForward size={16} /></span>}
              </div>
            )}
          </>
        );
        return (
          <div
            key={slide.id}
            className={`vs-hero__slide${approvedArtwork ? " vs-hero__slide--approved" : ""}`}
            data-active={active}
            aria-hidden={!active}
          >
            {destination ? (
              <Link
                to={destination}
                className="vs-hero__link"
                aria-label={mobile && approvedArtwork ? mobileHeadline : slide.title || "فتح العرض"}
                tabIndex={active ? 0 : -1}
              >
                {artwork}
              </Link>
            ) : artwork}
          </div>
        );
      })}
      {count > 1 && (
        <>
          <button type="button" className="vs-hero__arrow vs-hero__arrow--prev" aria-label="العرض السابق" onClick={() => { setPaused(true); setIndex((current) => (current - 1 + count) % count); }}><ArrowForward size={19} /></button>
          <button type="button" className="vs-hero__arrow vs-hero__arrow--next" aria-label="العرض التالي" onClick={() => { setPaused(true); setIndex((current) => (current + 1) % count); }}><ArrowForward size={19} /></button>
          <div className="vs-hero__controls">
            {visibleSlides.map((slide, position) => <button key={slide.id} type="button" className="vs-hero__dot" aria-label={`العرض ${position + 1}`} aria-pressed={position === activeIndex} onClick={() => { setPaused(true); setIndex(position); }} />)}
            <button type="button" className="vs-hero__pause" aria-label={paused ? "تشغيل العروض تلقائياً" : "إيقاف العروض التلقائية"} aria-pressed={paused} onClick={() => setPaused((current) => !current)}>{paused ? "تشغيل" : "إيقاف"}</button>
          </div>
        </>
      )}
    </section>
  );
}
