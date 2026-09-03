// Safe identity fallbacks used until StoreSettings loads. Runtime identity comes
// from the instance profile via StoreSettings; this is only the client-side
// fallback for a first paint or unavailable API.
export const HEADER_LOGO_URL = "/branding/logo-without-name.png";
export const FOOTER_LOGO_URL = "/branding/logo1.png";
export const FAVICON_URL = HEADER_LOGO_URL;
export const LOGO_URL = FOOTER_LOGO_URL;
export const STORE_TAGLINE = "";

export const STORE_IDENTITY = Object.freeze({
  nameAr: "المصري للأدوات الكهربائية",
  name: "Masri Electronics",
  facebookUrl: "https://www.facebook.com/people/%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A-%D9%84%D9%84%D8%A7%D8%AF%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A6%D9%8A%D8%A9/61584581612056/",
});

export const STORE_NAME_AR = STORE_IDENTITY.nameAr;
export const STORE_NAME_LATIN = STORE_IDENTITY.name;
