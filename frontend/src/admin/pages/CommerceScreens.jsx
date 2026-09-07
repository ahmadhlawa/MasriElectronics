import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../api/adminApi.js";
import ResourceScreen from "../ResourceScreen.jsx";
import sx from "../../sx.js";
import { Badge, Button, Field, card, input, useFeedback } from "../ui.jsx";
import { formatDate } from "../../utils/format.js";

function FreeDeliveryThreshold() {
  const feedback = useFeedback();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getSettings().then((settings) => setValue(settings.free_delivery_threshold ?? ""))
      .catch((error) => feedback.error(error.message || "تعذّر تحميل إعداد التوصيل."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings({ free_delivery_threshold: value === "" ? null : Number(value) });
      feedback.success("تم حفظ إعداد التوصيل المجاني.");
    } catch (error) {
      feedback.error(error.message || "تعذّر حفظ إعداد التوصيل.");
    } finally {
      setSaving(false);
    }
  };

  return <section style={{ ...card, ...sx`margin-top:16px` }}>
    {feedback.node}
    <h2 style={sx`margin:0 0 6px;font-size:16px`}>التوصيل المجاني</h2>
    <p style={sx`margin:0 0 12px;font-size:13px;color:#766669`}>اتركه فارغًا لتعطيل التوصيل المجاني. يطبّق على المجموع الفرعي لجميع المدن.</p>
    <div style={sx`display:flex;gap:12px;align-items:end;flex-wrap:wrap`}>
      <Field title="التوصيل مجانًا عند مبلغ (ILS)"><input type="number" min="0.01" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} style={input} /></Field>
      <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button>
    </div>
  </section>;
}

export function CouponsPage() {
  const fetchList = useCallback((params) => adminApi.listCoupons(params), []);
  return (
    <ResourceScreen
      title="أكواد الخصم"
      description="الخصومات تُحسب على الخادم عند إتمام الطلب."
      paginated
      createLabel="إضافة كود"
      fetchList={fetchList}
      createItem={adminApi.createCoupon}
      updateItem={adminApi.updateCoupon}
      deleteItem={adminApi.deleteCoupon}
      describeRow={(row) => row.code}
      columns={[
        { key: "code", title: "الكود" },
        {
          key: "discount_value",
          title: "الخصم",
          render: (row) =>
            row.discount_type === "percentage" ? `${row.discount_value}٪` : row.discount_value,
        },
        { key: "min_order_amount", title: "حد أدنى" },
        {
          key: "used_count",
          title: "الاستخدام",
          render: (row) => `${row.used_count}${row.usage_limit ? ` / ${row.usage_limit}` : ""}`,
        },
        { key: "ends_at", title: "ينتهي", render: (row) => formatDate(row.ends_at) || "—" },
        {
          key: "is_active",
          title: "الحالة",
          render: (row) => (
            <Badge tone={row.is_active ? "good" : "bad"}>{row.is_active ? "فعّال" : "موقوف"}</Badge>
          ),
        },
      ]}
      fields={[
        { name: "code", title: "الكود", required: true, placeholder: "WELCOME10" },
        { name: "description", title: "الوصف الظاهر للعميل" },
        {
          name: "discount_type",
          title: "نوع الخصم",
          type: "select",
          required: true,
          defaultValue: "percentage",
          options: [
            { value: "percentage", label: "نسبة مئوية" },
            { value: "fixed", label: "مبلغ ثابت" },
          ],
        },
        { name: "discount_value", title: "قيمة الخصم", type: "number", step: "0.01", defaultValue: 10 },
        { name: "min_order_amount", title: "الحد الأدنى للطلب", type: "number", step: "0.01", defaultValue: 0 },
        { name: "max_discount_amount", title: "أقصى خصم (اختياري)", type: "number", step: "0.01", emptyAsNull: true },
        { name: "usage_limit", title: "حد الاستخدام (اختياري)", type: "number", emptyAsNull: true },
        { name: "starts_at", title: "يبدأ في", type: "date" },
        { name: "ends_at", title: "ينتهي في", type: "date" },
        { name: "is_active", title: "فعّال", type: "checkbox", defaultValue: true },
      ]}
    />
  );
}

export function DeliveryAreasPage() {
  const fetchList = useCallback(() => adminApi.listDeliveryAreas(), []);
  return (
    <>
    <ResourceScreen
      title="مناطق التوصيل"
      description="رسوم التوصيل تُطبَّق حسب المنطقة التي يختارها العميل."
      createLabel="إضافة منطقة"
      fetchList={fetchList}
      createItem={adminApi.createDeliveryArea}
      updateItem={adminApi.updateDeliveryArea}
      deleteItem={adminApi.deleteDeliveryArea}
      columns={[
        { key: "name", title: "المنطقة" },
        { key: "delivery_fee", title: "رسوم التوصيل" },
        { key: "estimated_days", title: "المدة المتوقعة", render: (row) => row.estimated_days || "—" },
        { key: "sort_order", title: "الترتيب" },
        {
          key: "is_active",
          title: "الحالة",
          render: (row) => (
            <Badge tone={row.is_active ? "good" : "bad"}>{row.is_active ? "فعّالة" : "موقوفة"}</Badge>
          ),
        },
      ]}
      fields={[
        { name: "name", title: "اسم المنطقة", required: true },
        { name: "delivery_fee", title: "رسوم التوصيل", type: "number", step: "0.01", defaultValue: 0 },
        { name: "estimated_days", title: "المدة المتوقعة", placeholder: "١–٢ أيام عمل" },
        { name: "sort_order", title: "الترتيب", type: "number", defaultValue: 0 },
        { name: "is_active", title: "فعّالة", type: "checkbox", defaultValue: true },
      ]}
    />
    <FreeDeliveryThreshold />
    </>
  );
}
