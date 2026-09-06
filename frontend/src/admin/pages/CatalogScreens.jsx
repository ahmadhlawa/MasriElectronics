import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../api/adminApi.js";
import ResourceScreen from "../ResourceScreen.jsx";
import { Badge } from "../ui.jsx";


export function categoryParentOptions(rows, category) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const descendants = new Set();
  const collectDescendants = (parentId) => {
    rows.filter((row) => row.parent_id === parentId).forEach((child) => {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        collectDescendants(child.id);
      }
    });
  };
  if (category) collectDescendants(category.id);

  const labelFor = (row) => {
    const labels = [row.name];
    const visited = new Set([row.id]);
    let parent = byId.get(row.parent_id);
    while (parent && !visited.has(parent.id)) {
      labels.unshift(parent.name);
      visited.add(parent.id);
      parent = byId.get(parent.parent_id);
    }
    return labels.join(" / ");
  };

  return rows
    .filter((row) => row.id !== category?.id && !descendants.has(row.id))
    .map((row) => ({ value: row.id, label: labelFor(row) }));
}

export function CategoriesPage() {
  const [parents, setParents] = useState([]);

  useEffect(() => {
    adminApi
      .listCategories({ page_size: 100 })
      .then((result) => setParents(result.items || []))
      .catch(() => setParents([]));
  }, []);

  const fetchList = useCallback((params) => adminApi.listCategories(params), []);

  return (
    <ResourceScreen
      title="الأقسام"
      description="أقسام المتجر وترتيب ظهورها في الواجهة."
      paginated
      createLabel="إضافة قسم"
      fetchList={fetchList}
      createItem={adminApi.createCategory}
      updateItem={adminApi.updateCategory}
      deleteItem={adminApi.deleteCategory}
      columns={[
        { key: "name", title: "الاسم" },
        { key: "slug", title: "الرابط" },
        { key: "product_count", title: "عدد المنتجات" },
        { key: "sort_order", title: "الترتيب" },
        {
          key: "is_active",
          title: "الحالة",
          render: (row) => (
            <Badge tone={row.is_active ? "good" : "bad"}>{row.is_active ? "فعّال" : "مخفي"}</Badge>
          ),
        },
      ]}
      fields={(editingCategory) => [
        { name: "name", title: "اسم القسم", required: true },
        { name: "slug", title: "الرابط (اختياري)", hint: "يُولَّد من الاسم إذا تُرك فارغاً", omitWhenEmpty: true },
        { name: "description", title: "الوصف", type: "textarea", rows: 3 },
        { name: "image_url", title: "صورة القسم", type: "media", emptyAsNull: true },
        {
          name: "parent_id",
          title: "القسم الأب",
          type: "select",
          emptyAsNull: true,
          options: categoryParentOptions(parents, editingCategory),
        },
        { name: "sort_order", title: "الترتيب", type: "number", defaultValue: 0 },
        { name: "is_featured", title: "قسم مميّز", type: "checkbox" },
        { name: "is_active", title: "فعّال", type: "checkbox", defaultValue: true },
      ]}
    />
  );
}

export function BrandsPage() {
  const fetchList = useCallback((params) => adminApi.listBrands(params), []);
  return (
    <ResourceScreen
      title="العلامات التجارية"
      description="العلامات المرتبطة بالمنتجات والشعارات المعروضة في المتجر."
      paginated
      createLabel="إضافة علامة"
      fetchList={fetchList}
      createItem={adminApi.createBrand}
      updateItem={adminApi.updateBrand}
      deleteItem={adminApi.deleteBrand}
      columns={[
        { key: "logo_url", title: "الشعار", render: (row) => row.logo_url ? <img src={row.logo_url} alt="" style={{ width: 48, height: 32, objectFit: "contain" }} /> : "—" },
        { key: "name", title: "الاسم" },
      ]}
      fields={[
        { name: "name", title: "اسم العلامة", required: true },
        { name: "logo_url", title: "الشعار", type: "media", emptyAsNull: true },
      ]}
    />
  );
}
