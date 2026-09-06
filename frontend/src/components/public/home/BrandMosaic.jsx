import SectionHead from "../shell/SectionHead.jsx";

/** Fixed eight-slot compositions repeat for larger collections, without shuffling. */
export default function BrandMosaic({ brands = [], title = "العلامات التجارية" }) {
  if (!brands.length) return null;
  return (
    <section className="vs-container vs-section vs-brands">
      <SectionHead title={title} />
      <ul className="vs-brand-mosaic" aria-label={title}>
        {brands.map((brand) => (
          <li className="vs-brand-mosaic__tile" key={brand.id}>
            <img src={brand.logo} alt={brand.name} loading="lazy" decoding="async" />
          </li>
        ))}
      </ul>
    </section>
  );
}
