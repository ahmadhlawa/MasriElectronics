import { useCategoryNav, useMoney } from "../../../hooks/useStorefront.js";

/**
 * Every control here maps onto a query parameter the products endpoint really
 * supports. Nothing decorative: a filter that cannot change the result set does
 * not belong on the page.
 */
export default function FilterPanel({ filters, patch, reset, showCategories, ceiling, brands = [], definitions = [] }) {
  const categories = useCategoryNav();
  const money = useMoney();
  const max = filters.maxPrice ?? ceiling;
  const attributeValue = (key, operator) => filters.attributes
    .find((item) => item.startsWith(`${key}:${operator}:`))?.split(":").slice(2).join(":") || "";
  const setAttribute = (key, operator, value) => {
    const prefix = `${key}:${operator}:`;
    const remaining = filters.attributes.filter((item) => !item.startsWith(prefix));
    patch({ attributes: value === "" ? remaining : [...remaining, `${prefix}${value}`] });
  };

  return (
    <div className="vs-filters">
      <div className="vs-filters__group">
        <div className="vs-filters__legend-row">
          <span className="vs-filters__legend">تصفية النتائج</span>
          <button type="button" className="vs-activefilters__clear" onClick={reset}>
            إعادة تعيين
          </button>
        </div>
      </div>

      {showCategories && categories.length > 0 && (
        <fieldset className="vs-filters__group">
          <legend className="vs-filters__legend">الأقسام</legend>
          {categories.map((category) => (
            <label key={category.slug} className="vs-check">
              <input
                type="radio"
                name="vs-filter-category"
                checked={filters.category === category.slug}
                onChange={() => patch({ cat: category.slug })}
              />
              {category.name}
              <span className="vs-check__count">{category.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      {brands.length > 0 && (
        <fieldset className="vs-filters__group">
          <legend className="vs-filters__legend">العلامة التجارية</legend>
          <select className="vs-select vs-filterselect" aria-label="العلامة التجارية" value={filters.brandId ?? ""} onChange={(event) => patch({ brand: event.target.value || null })}>
            <option value="">كل العلامات</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </fieldset>
      )}

      {definitions.filter((definition) => definition.filterable && definition.type !== "text").map((definition) => (
        <fieldset className="vs-filters__group" key={definition.id}>
          <legend className="vs-filters__legend">{definition.label}{definition.unit ? ` (${definition.unit})` : ""}</legend>
          {definition.type === "number" ? (
            <div className="vs-filterrange">
              <input className="vs-select" type="number" step="any" aria-label={`${definition.label} من`} placeholder="من" value={attributeValue(definition.key, "gte")} onChange={(event) => setAttribute(definition.key, "gte", event.target.value)} />
              <input className="vs-select" type="number" step="any" aria-label={`${definition.label} إلى`} placeholder="إلى" value={attributeValue(definition.key, "lte")} onChange={(event) => setAttribute(definition.key, "lte", event.target.value)} />
            </div>
          ) : (
            <select className="vs-select vs-filterselect" aria-label={definition.label} value={attributeValue(definition.key, "eq")} onChange={(event) => setAttribute(definition.key, "eq", event.target.value)}>
              <option value="">الكل</option>
              {(definition.type === "boolean" ? [{ code: "true", label: "نعم" }, { code: "false", label: "لا" }] : definition.enum_choices || []).map((choice) => <option key={choice.code} value={choice.code}>{choice.label}</option>)}
            </select>
          )}
        </fieldset>
      ))}

      <fieldset className="vs-filters__group">
        <legend className="vs-filters__legend">السعر الأقصى — {money(max)}</legend>
        <input
          className="vs-range"
          type="range"
          min="0"
          max={ceiling}
          step={Math.max(1, Math.round(ceiling / 100))}
          value={max}
          onChange={(event) =>
            patch({ max: Number(event.target.value) >= ceiling ? null : event.target.value })
          }
          aria-label="السعر الأقصى"
        />
      </fieldset>

      <fieldset className="vs-filters__group">
        <legend className="vs-filters__legend">التوفّر والعروض</legend>
        <label className="vs-check">
          <input
            type="checkbox"
            checked={filters.onSale}
            onChange={(event) => patch({ sale: event.target.checked })}
          />
          المنتجات المخفّضة فقط
        </label>
        <label className="vs-check">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(event) => patch({ stock: event.target.checked })}
          />
          المتوفر في المخزون فقط
        </label>
      </fieldset>
    </div>
  );
}
