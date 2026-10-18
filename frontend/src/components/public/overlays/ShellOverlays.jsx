import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { OVERLAY, useStore } from "../../../app/StoreProvider.jsx";
import useMediaQuery from "../../../hooks/useMediaQuery.js";
import { whatsappHref } from "../../../utils/format.js";
import CartDrawer from "../cart/CartDrawer.jsx";
import MobileMenu from "../navigation/MobileMenu.jsx";
import SearchOverlay from "../search/SearchOverlay.jsx";
import QuickView from "./QuickView.jsx";
import Toast from "./Toast.jsx";
import { WhatsAppIcon } from "../shell/icons.jsx";

/**
 * Every shell-level overlay in one place, all driven by the single `overlay`
 * value — which is what makes "only one open at a time" a property of the state
 * rather than a rule each trigger has to remember.
 */
export default function ShellOverlays() {
  const store = useStore();
  const { overlay, closeAll, settings } = store;
  const isMobile = useMediaQuery("(max-width: 899px)");
  const { pathname, search } = useLocation();
  const waRef = useRef(null);
  const wa = whatsappHref(settings.whatsapp, `مرحباً، لدي استفسار عن ${settings.storeName}`);

  useEffect(() => {
    const link = waRef.current;
    if (!link || typeof document.elementsFromPoint !== "function") return undefined;
    let frame = null;
    const check = () => {
      frame = null;
      const footerTop = document.querySelector(".vs-footer")?.getBoundingClientRect().top;
      // Lift support above the footer instead of covering its navigation links.
      link.style.bottom = footerTop < window.innerHeight
        ? `${Math.min(window.innerHeight - 80, Math.max(24, window.innerHeight - footerTop + 16))}px`
        : "";
      const box = link.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const points = [[0, 0], [-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]];
      const blocked = points.some(([dx, dy]) => document.elementsFromPoint(x + dx * box.width, y + dy * box.height)
        .some((node) => !link.contains(node) && node.closest(
          ".vs-card__panel, .vs-pkg__panel, .vs-pdp__buy, .vs-main button, .vs-main input, .vs-main select, .vs-main a:not(.vs-card__link):not(.vs-pkg__link), .vs-footer a",
        )));
      // Keep a deliberately focused support link available to keyboard users.
      link.style.visibility = blocked && document.activeElement !== link ? "hidden" : "";
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(check); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.querySelector(".vs-public"), { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    link.addEventListener("focus", schedule);
    link.addEventListener("blur", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      link.removeEventListener("focus", schedule);
      link.removeEventListener("blur", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
      link.style.visibility = "";
      link.style.bottom = "";
    };
  }, [isMobile, pathname, search, wa]);

  return (
    <>
      <MobileMenu open={overlay === OVERLAY.MENU} onClose={closeAll} />
      <SearchOverlay open={overlay === OVERLAY.SEARCH} onClose={closeAll} />
      <CartDrawer open={overlay === OVERLAY.CART} onClose={closeAll} />
      <QuickView open={overlay === OVERLAY.QUICK} slug={store.quickSlug} onClose={closeAll} />

      <Toast message={store.toast} onView={() => store.openOverlay(OVERLAY.CART)} />

      {!isMobile && wa !== "#" && (
        <a
          ref={waRef}
          className="vs-wa"
          href={wa}
          target="_blank"
          rel="noopener"
          aria-label="تواصل عبر واتساب"
        >
          <WhatsAppIcon size={24} />
        </a>
      )}
    </>
  );
}
