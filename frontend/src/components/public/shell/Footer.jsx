import { Link } from "react-router-dom";
import { useStore } from "../../../app/StoreProvider.jsx";
import { useCategoryNav } from "../../../hooks/useStorefront.js";
import { footerLinks } from "../../../store.js";
import { ltrContactNumberProps, whatsappHref } from "../../../utils/format.js";
import { FOOTER_LOGO_URL, HEADER_LOGO_URL } from "../../../brand.js";
import useMediaQuery from "../../../hooks/useMediaQuery.js";
import TrustStrip from "../home/TrustStrip.jsx";
import { HomeIcon, PhoneIcon, WalletIcon, WhatsAppIcon } from "./icons.jsx";

function SocialIcon({ name }) {
  const paths = {
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>,
    facebook: <path d="M13.5 21v-8h2.75l.41-3h-3.16V8.08c0-.87.24-1.46 1.49-1.46H16.6V3.94c-.28-.04-1.24-.12-2.36-.12-2.33 0-3.92 1.42-3.92 4.03V10H7.7v3h2.62v8h3.18Z" fill="currentColor" stroke="none" />,
    tiktok: <path d="M14.5 3c.4 2.15 1.61 3.43 3.5 3.83v3.08a7.28 7.28 0 0 1-3.5-1.04v5.96a5.34 5.34 0 1 1-4.61-5.29v3.11a2.25 2.25 0 1 0 1.52 2.13V3h3.09Z" fill="currentColor" stroke="none" />,
    youtube: <path d="M21 7.2a2.8 2.8 0 0 0-1.96-1.98C17.3 4.75 12 4.75 12 4.75s-5.3 0-7.04.47A2.8 2.8 0 0 0 3 7.2C2.53 8.95 2.53 12 2.53 12S2.53 15.05 3 16.8a2.8 2.8 0 0 0 1.96 1.98c1.74.47 7.04.47 7.04.47s5.3 0 7.04-.47A2.8 2.8 0 0 0 21 16.8c.47-1.75.47-4.8.47-4.8S21.47 8.95 21 7.2ZM10.2 15.37V8.63L15.82 12l-5.62 3.37Z" fill="currentColor" stroke="none" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function validExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Contact, categories and policies are sourced from the existing storefront. */
export default function Footer() {
  const { settings } = useStore();
  const mobile = useMediaQuery("(max-width: 699px)");
  const categories = useCategoryNav();

  if (mobile) {
    const locationUrl = validExternalUrl(settings.locationUrl);
    return (
      <footer className="vs-footer vs-footer--compact">
        <div className="vs-container vs-footer__compact-inner">
          <img className="vs-footer__compact-logo" src={HEADER_LOGO_URL} alt={settings.storeName} loading="lazy" />
          {(settings.phone || settings.whatsapp || locationUrl) && (
            <nav className="vs-footer__compact-actions" aria-label="تواصل معنا">
              {settings.phone && <a href={`tel:${settings.phone}`}><PhoneIcon size={18} />اتصال</a>}
              {settings.whatsapp && <a href={whatsappHref(settings.whatsapp, "")} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={18} />واتساب</a>}
              {locationUrl && <a href={locationUrl} target="_blank" rel="noopener noreferrer"><HomeIcon size={18} />الموقع</a>}
            </nav>
          )}
        </div>
      </footer>
    );
  }

  const year = new Date().getFullYear();
  const socials = [
    { key: "instagram", label: "إنستغرام", href: settings.instagram, visible: settings.instagramVisible },
    { key: "facebook", label: "فيسبوك", href: settings.facebook, visible: settings.facebookVisible },
    { key: "tiktok", label: "تيك توك", href: settings.tiktok, visible: settings.tiktokVisible },
    { key: "youtube", label: "يوتيوب", href: settings.youtube, visible: settings.youtubeVisible },
  ].map((item) => ({ ...item, href: item.visible ? validExternalUrl(item.href) : null })).filter((item) => item.href);
  const supportLinks = [...footerLinks.service.items, ...footerLinks.policies.items];
  const linkGroups = [
    { title: "روابط سريعة", items: [["الرئيسية", "/"], ...footerLinks.shop.items] },
    { title: "خدمة العملاء", items: supportLinks },
    ...(categories.length ? [{ title: "الأقسام الرئيسية", items: categories.slice(0, 7).map((category) => [category.name, category.href]) }] : []),
  ];

  return (
    <>
      <section className="vs-prefooter" aria-label="معلومات الدفع والتوصيل">
        <div className="vs-container"><TrustStrip /></div>
      </section>
      <footer className="vs-footer">
        <div className="vs-container vs-footer__top">
          <div className="vs-footer__brand">
            {FOOTER_LOGO_URL && <img className="vs-footer__logo-img" src={FOOTER_LOGO_URL} alt={settings.storeName} loading="lazy" />}
            <span className="vs-footer__name">{settings.storeName}</span>
            {(settings.seoDescription || settings.tagline) && <p className="vs-footer__desc">{settings.seoDescription || settings.tagline}</p>}
          </div>

          {linkGroups.map((group) => {
            const links = group.items.map(([label, href]) => <Link key={href} to={href}>{label}</Link>);
            return (
              <nav key={group.title} className="vs-footer__col" aria-label={group.title}>
                <h2 className="vs-footer__title">{group.title}</h2>
                {links}
              </nav>
            );
          })}

          <div className="vs-footer__col vs-footer__contact">
            <h2 className="vs-footer__title">تواصل معنا</h2>
            {settings.address && <div className="vs-footer__contact-line"><HomeIcon size={19} />{settings.locationUrl ? <a href={settings.locationUrl} target="_blank" rel="noopener noreferrer">{settings.address}</a> : <span>{settings.address}</span>}</div>}
            {settings.phone && <div className="vs-footer__contact-line"><PhoneIcon size={19} /><a href={`tel:${settings.phone}`} {...ltrContactNumberProps}>{settings.phone}</a></div>}
            {settings.whatsapp && <div className="vs-footer__contact-line"><WhatsAppIcon size={19} /><a href={whatsappHref(settings.whatsapp, "")} target="_blank" rel="noopener noreferrer" {...ltrContactNumberProps}>{settings.whatsapp}</a></div>}
            {settings.email && <div className="vs-footer__contact-line"><span aria-hidden="true">@</span><a href={`mailto:${settings.email}`}>{settings.email}</a></div>}
            {settings.hours && <p className="vs-footer__hours">{settings.hours}</p>}
            {socials.length > 0 && (
              <div className="vs-footer__social-row" aria-label="روابط التواصل الاجتماعي">
                {socials.map((item) => <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} title={item.label}><SocialIcon name={item.key} /></a>)}
              </div>
            )}
          </div>
        </div>

        <div className="vs-footer__bottom">
          <div className="vs-container vs-footer__bottom-row">
            <nav className="vs-footer__legal" aria-label="السياسات">
              <Link to="/page/privacy-policy">الخصوصية</Link>
              <Link to="/page/terms">الشروط والأحكام</Link>
              <Link to="/page/return-policy">سياسة الإرجاع</Link>
            </nav>
            <span>© {year} {settings.storeName}. جميع الحقوق محفوظة</span>
            <span className="vs-footer__payment"><WalletIcon size={22} /> الدفع عند الاستلام</span>
          </div>
        </div>
        <div className="vs-footer__credit">
          <div className="vs-container vs-footer__credit-row">
            <img src="/branding/tfn.png" alt="TFN Technologies Team" loading="lazy" />
            <span>Developed by TFN Technologies Team</span>
          </div>
        </div>
      </footer>
    </>
  );
}
