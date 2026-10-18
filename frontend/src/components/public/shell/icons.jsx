// The storefront's own line-icon set: one 24px grid, 1.9 stroke, rounded caps.
// Decorative by default — every icon-only control carries its own aria-label.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

const icon = (path, extra = {}) =>
  function Icon({ size = 18, ...rest }) {
    return (
      <svg {...base} width={size} height={size} {...extra} {...rest}>
        {path}
      </svg>
    );
  };

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </>,
);

export const CartIcon = icon(
  <>
    <path d="M3.5 4h2L8 14.6a2 2 0 0 0 2 1.5h6.7a2 2 0 0 0 2-1.6L20.5 8H6.6" />
    <circle cx="10" cy="20" r="1.3" />
    <circle cx="17" cy="20" r="1.3" />
  </>,
);

export const MenuIcon = icon(
  <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" strokeWidth="2" />,
);

export const GridIcon = icon(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </>,
);

/* The neutral stand-in for a category with no artwork of its own. A tag, not a
   product or a folder: it says "a part of the catalogue" without implying what
   is inside it. */
export const TagIcon = icon(
  <>
    <path d="M11.4 3.5H20a.5.5 0 0 1 .5.5v8.6a1 1 0 0 1-.3.7l-7.2 7.2a1 1 0 0 1-1.4 0l-7.9-7.9a1 1 0 0 1 0-1.4l7.2-7.2a1 1 0 0 1 .5-.5Z" />
    <circle cx="16.4" cy="7.6" r="1.4" />
  </>,
);

// Appliance fallbacks share the existing icon grid and stroke treatment.
const applianceCategories = [
  [/coffee|drink|قهو|مشروب/, icon(<><path d="M5 9h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4ZM16 10h2a3 3 0 0 1 0 6h-2M8 3v3M12 3v3M3 22h17" /></>)],
  [/clean|vacuum|تنظيف|عناية بالمنزل|مكانس/, icon(<><path d="M7 16v-6a4 4 0 0 1 8 0v5M15 15l3 5M16 21h6" /><rect x="3" y="12" width="8" height="8" rx="3" /><circle cx="5.5" cy="21" r="1" /><circle cx="9" cy="21" r="1" /></>)],
  [/heat|cool|climat|fan|تدفئ|تبريد|مراوح|تكييف/, icon(<><circle cx="12" cy="9" r="7" /><circle cx="12" cy="9" r="1.5" /><path d="M12 7.5V4M13.5 9H17M12 10.5V14M10.5 9H7M12 16v5M7 22h10" /></>)],
  [/personal|hair|عناية شخص|شعر|حلاقة/, icon(<><path d="M5 6h10a4 4 0 0 1 0 8H5ZM5 6 2 5v10l3-1M10 14l1 7h4l-1-7M18 7l3-1M19 10h3M18 13l3 1" /></>)],
  [/kitchen|cook|مطبخ|طهي|طبخ/, icon(<><path d="M7 4h10l-1 11H8ZM9 15l-2 6h12l-2-6M10 8h4M10 11h3M9 2h6M17 6h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" /></>)],
  [/small.home|iron|منزلية|مكاوي|كي/, icon(<><path d="M3 17 7 9h9l5 8v3H3ZM9 9V6h6l2 3M3 17h18M7 13h5M15 5V2" /></>)],
];
const ApplianceIcon = icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M5 8h14" /><circle cx="12" cy="14" r="4" /><path d="M8 5.5h1M12 5.5h1" /></>);

export function CategoryIcon({ category, ...props }) {
  const label = `${category?.slug || ""} ${category?.name || ""}`.toLowerCase();
  const Icon = applianceCategories.find(([pattern]) => pattern.test(label))?.[1] || ApplianceIcon;
  return <Icon {...props} />;
}

export const GridDenseIcon = icon(
  <>
    <rect x="3" y="3" width="4.6" height="4.6" rx="1" />
    <rect x="9.7" y="3" width="4.6" height="4.6" rx="1" />
    <rect x="16.4" y="3" width="4.6" height="4.6" rx="1" />
    <rect x="3" y="9.7" width="4.6" height="4.6" rx="1" />
    <rect x="9.7" y="9.7" width="4.6" height="4.6" rx="1" />
    <rect x="16.4" y="9.7" width="4.6" height="4.6" rx="1" />
  </>,
);

export const FilterIcon = icon(
  <path d="M4 6h16M7 12h10M10 18h4" strokeWidth="2" />,
);

export const PhoneIcon = icon(
  <path d="M4 5c0-1 1-2 2-2h2l2 5-2 1c1 3 3 5 6 6l1-2 5 2v2c0 1-1 2-2 2C10 19 5 14 4 5Z" />,
);

export const UserIcon = icon(
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2" />
  </>,
);

export const HomeIcon = icon(
  <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />,
);

export const ChevronDown = icon(<path d="m6 9.5 6 6 6-6" strokeWidth="2" />);

/** Points the way text flows: in RTL "forward" is to the left. */
export const ArrowForward = icon(<path d="M19 12H5m6-6-6 6 6 6" strokeWidth="2" />);

export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7" strokeWidth="2.2" />);

export const PlusIcon = icon(<path d="M12 5v14M5 12h14" strokeWidth="2" />);

export const MinusIcon = icon(<path d="M5 12h14" strokeWidth="2" />);

export const TrashIcon = icon(
  <>
    <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
  </>,
);

export const EyeIcon = icon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const BoxIcon = icon(
  <>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </>,
);

export const TruckIcon = icon(
  <>
    <path d="M2.5 6.5h11v9h-11zM13.5 10h4l3 3v2.5h-7z" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </>,
);

export const WalletIcon = icon(
  <>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M16.5 14.5h1.5" />
  </>,
);

export const ShieldIcon = icon(
  <path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6Z" />,
);

export const SparkIcon = icon(
  <path d="M12 3.5 13.9 9l5.6 1.9-5.6 2L12 20.5 10.1 12.9 4.5 11 10.1 9Z" />,
);

export const WhatsAppIcon = ({ size = 22, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6a11 11 0 0 1-4.2-4.3c-.4-.7-.7-1.4-.7-2 0-.7.3-1.3.6-1.6.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.5l-.3.4c-.1.2-.3.3-.1.6.4.7.9 1.3 1.5 1.8.6.5 1.1.7 1.4.8.2.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1l1.6.8c.3.1.5.2.5.4.1.1.1.5-.1 1Z" />
  </svg>
);
