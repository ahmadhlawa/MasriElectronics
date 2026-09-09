import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useCategoryNav } from "../hooks/useStorefront.js";
import CategoryCard from "../components/public/catalog/CategoryCard.jsx";

export default function CategoriesPage() {
  const categories = useCategoryNav();

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
      <div className="vs-categories-page__grid">
        {categories.map((category, index) => (
          <article className="vs-categories-page__item" key={category.slug}>
            <CategoryCard category={category} eager={index < 4} />
            {category.children.length > 0 && (
              <nav className="vs-categories-page__children" aria-label={`الأقسام الفرعية لـ ${category.name}`}>
                {category.children.map((child) => (
                  <Link key={child.slug} to={child.href}>{child.name}</Link>
                ))}
              </nav>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
