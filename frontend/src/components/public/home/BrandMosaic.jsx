import { useEffect, useRef } from "react";
import SectionHead from "../shell/SectionHead.jsx";

const PANEL_CAPACITY = 8;

/** Fixed eight-slot compositions repeat for larger collections, without shuffling. */
export default function BrandMosaic({ brands = [], title = "العلامات التجارية" }) {
  const scrollRef = useRef(null);
  const panels = [];
  for (let offset = 0; offset < brands.length; offset += PANEL_CAPACITY) {
    panels.push(brands.slice(offset, offset + PANEL_CAPACITY));
  }

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || brands.length <= PANEL_CAPACITY) return undefined;
    const onWheel = (event) => {
      // Preserve native trackpad/shift-wheel scrolling and browser zoom.
      if (event.deltaX || !event.deltaY || event.shiftKey || event.ctrlKey) return;
      const direction = getComputedStyle(scroller).direction === "rtl" ? -1 : 1;
      const position = scroller.scrollLeft * direction;
      const maximum = scroller.scrollWidth - scroller.clientWidth;
      if ((event.deltaY < 0 && position <= 1) || (event.deltaY > 0 && position >= maximum - 1)) return;
      event.preventDefault();
      scroller.scrollBy({ left: direction * Math.sign(event.deltaY) * scroller.clientWidth });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [brands.length]);

  if (!brands.length) return null;
  return (
    <section className="vs-container vs-section vs-brands">
      <SectionHead title={title} />
      <div ref={scrollRef} className="vs-brand-panels" role="region" aria-label={title} tabIndex={panels.length > 1 ? 0 : undefined}>
        {panels.map((panel, index) => (
          <ul className="vs-brand-mosaic" aria-label={`${title} ${index + 1} / ${panels.length}`} key={panel[0].id}>
            {panel.map((brand) => (
              <li className="vs-brand-mosaic__tile" key={brand.id}>
                <img src={brand.logo} alt={brand.name} loading="lazy" decoding="async" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
