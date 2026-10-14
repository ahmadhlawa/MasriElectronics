import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/StoreProvider.jsx";
import { useCategoryNav } from "../hooks/useStorefront.js";
import { TagIcon } from "../components/public/shell/icons.jsx";

function CategoryTile({ category, eager }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const hasImage = category.imageUrl && category.imageUrl !== failedUrl;
  return (
    <Link to={category.href} className="vs-categories-page__tile" aria-label={`${category.name} — ${category.countText}`}>
      <span className="vs-categories-page__image">
        {hasImage ? (
          <img src={category.imageUrl} alt="" loading={eager ? "eager" : "lazy"}
            decoding="async" onError={() => setFailedUrl(category.imageUrl)} />
        ) : (
          <TagIcon size={28} />
        )}
      </span>
      <span className="vs-categories-page__name">{category.name}</span>
    </Link>
  );
}

export default function CategoriesPage() {
  const categories = useCategoryNav();
  const { ready, loadError } = useStore();

  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") || "";
    document.title = "كل الأقسام | المصري";
    meta?.setAttribute("content", "تصفّح كل أقسام Masri المصري للأدوات الكهربائية واختر القسم المناسب لمنتجاتك.");
    return () => {
      document.title = previousTitle;
      meta?.setAttribute("content", previousDescription);
    };
  }, []);

  return (
    <div className="vs-container vs-section vs-categories-page">
      <nav className="vs-crumbs" aria-label="مسار التصفح">
        <Link to="/">الرئيسية</Link>
        <span aria-hidden="true">›</span>
        <span className="vs-crumbs__here">الأقسام</span>
      </nav>
      <header className="vs-categories-page__head">
        <h1>كل الأقسام</h1>
        <p>اختر القسم المناسب لتصفّح منتجاته.</p>
      </header>
      <div className="vs-categories-page__grid" data-count={categories.length}>
        {categories.map((category, index) => (
          <CategoryTile category={category} eager={index < 4} key={category.slug} />
        ))}
      </div>
      {ready && !loadError && categories.length === 0 && (
        <p>لا توجد أقسام متاحة حاليًا.</p>
      )}
    </div>
  );
}
