// Presentation constants only.
//
// Every piece of commercial content (products, categories, prices, delivery areas,
// coupons, store identity) now comes from the API via
// src/services/*. What is left here is navigation structure and static copy that
// belongs to the storefront layout itself.

// Primary navigation. Every destination here is a route that always has
// something to show; the narrower tools live in the footer instead.
export const navLinks = [
  { label: "الرئيسية", href: "/" },
  { label: "كل المنتجات", href: "/shop" },
  { label: "العروض", href: "/offers" },
  { label: "البكجات", href: "/packages" },
  { label: "تواصل معنا", href: "/contact" },
];

export const footerLinks = {
  shop: {
    title: "التسوّق",
    items: [
      ["كل المنتجات", "/shop"],
      ["العروض", "/offers"],
      ["البكجات", "/packages"],
    ],
  },
  service: {
    title: "خدمة العملاء",
    items: [
      ["عربة التسوّق", "/cart"],
      ["تواصل معنا", "/contact"],
    ],
  },
  policies: {
    title: "معلومات",
    items: [
      ["من نحن", "/page/about"],
      ["سياسة الشحن", "/page/shipping-policy"],
      ["سياسة التبديل والإرجاع", "/page/return-policy"],
      ["سياسة الخصوصية", "/page/privacy-policy"],
      ["الشروط والأحكام", "/page/terms"],
    ],
  },
};

export const paymentMethods = [
  {
    key: "cash_on_delivery",
    label: "الدفع عند الاستلام",
    desc: "ادفع نقداً عند استلام الطلب",
  },
];

export const paymentMethodLabels = {
  cash_on_delivery: "الدفع عند الاستلام",
  electronic: "الدفع الإلكتروني — قريبًا",
  bank_transfer: "تحويل بنكي / يدوي",
};

export const invoiceStatusLabels = {
  issued: "صادرة",
  cancelled: "ملغاة",
};

export const orderStatusLabels = {
  pending: "بانتظار المراجعة",
  confirmed: "تم التأكيد",
  processing: "قيد التحضير",
  ready: "جاهز للشحن",
  shipped: "مع مندوب التوصيل",
  delivered: "تم التوصيل",
  cancelled: "ملغى",
};
