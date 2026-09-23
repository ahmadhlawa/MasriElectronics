import { useEffect, useState } from "react";
import sx from "../sx.js";
import { adminApi } from "../api/adminApi.js";
import { Button, Field, Modal, Spinner, input, textarea, useFeedback } from "./ui.jsx";

const BLANK = { key: "", label: "", type: "number", unit: "", choices: "", filterable: false, comparable: false, show_on_card: false, sort_order: 0 };
const typeNames = { number: "رقم", enum: "قائمة", boolean: "نعم/لا", text: "نص" };

function formFrom(row) {
  return row ? { ...row, unit: row.unit || "", choices: row.enum_choices.map((choice) => `${choice.code}:${choice.label}`).join("\n") } : { ...BLANK };
}

function payloadFrom(form) {
  return {
    key: form.key.trim(), label: form.label.trim(), type: form.type,
    unit: form.type === "number" ? form.unit.trim() || null : null,
    choices: form.type === "enum" ? form.choices.split("\n").filter((line) => line.trim()).map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1 || !line.slice(separator + 1).trim()) throw new Error("اكتب كل خيار بصيغة code:الاسم.");
      return { code: line.slice(0, separator).trim(), label: line.slice(separator + 1).trim() };
    }) : [],
    filterable: form.filterable, comparable: form.comparable, show_on_card: form.show_on_card,
    sort_order: Number(form.sort_order) || 0,
  };
}

export default function CategoryAttributesEditor({ category, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const feedback = useFeedback();

  const load = async () => {
    setLoading(true);
    try { setRows(await adminApi.listCategoryAttributes(category.id)); }
    catch (error) { feedback.error(error.message || "تعذّر تحميل الخصائص."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [category.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (row) => { setEditing(row || "new"); setForm(formFrom(row)); };
  const save = async () => {
    setSaving(true);
    try {
      const payload = payloadFrom(form);
      if (editing === "new") await adminApi.createCategoryAttribute(category.id, payload);
      else await adminApi.updateCategoryAttribute(category.id, editing.id, payload);
      setEditing(null);
      feedback.success("تم حفظ الخاصية.");
      await load();
    } catch (error) { feedback.error(error.message || "تعذّر حفظ الخاصية."); }
    finally { setSaving(false); }
  };
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal title={`خصائص القسم: ${category.name}`} onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>إغلاق</Button>}>
      {feedback.node}
      <p style={sx`margin:0 0 12px;font-size:13px;color:#766669`}>الترتيب يحدد ترتيب الخصائص في بطاقة المنتج.</p>
      {loading ? <Spinner /> : rows.map((row) => (
        <div key={row.id} style={sx`display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:1px solid #F3EBE0;padding:10px 0`}>
          <span><strong>{row.label}</strong> <small>({row.key} · {typeNames[row.type]} · {row.sort_order})</small></span>
          <Button variant="ghost" onClick={() => open(row)}>تعديل {row.label}</Button>
        </div>
      ))}
      {!loading && !rows.length && <p>لا توجد خصائص لهذا القسم.</p>}
      {!editing && <Button variant="secondary" onClick={() => open(null)} style={sx`margin-top:12px`}>إضافة خاصية</Button>}
      {editing && (
        <div style={sx`display:flex;flex-direction:column;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid #F3EBE0`}>
          <strong>{editing === "new" ? "خاصية جديدة" : `تعديل ${editing.label}`}</strong>
          <div style={sx`display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px`}>
            <Field title="اسم الخاصية"><input value={form.label} onChange={(event) => change("label", event.target.value)} style={input} /></Field>
            <Field title="مفتاح الخاصية" hint="أحرف إنجليزية صغيرة وأرقام وشرطة سفلية"><input value={form.key} onChange={(event) => change("key", event.target.value)} style={input} dir="ltr" /></Field>
            <Field title="نوع الخاصية"><select value={form.type} onChange={(event) => change("type", event.target.value)} style={input}>{Object.entries(typeNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            {form.type === "number" && <Field title="الوحدة (اختياري)"><input value={form.unit} onChange={(event) => change("unit", event.target.value)} style={input} /></Field>}
            <Field title="ترتيب العرض"><input type="number" value={form.sort_order} onChange={(event) => change("sort_order", event.target.value)} style={input} /></Field>
          </div>
          {form.type === "enum" && <Field title="خيارات القائمة" hint="خيار لكل سطر بصيغة code:الاسم، مثل front_load:تحميل أمامي"><textarea value={form.choices} onChange={(event) => change("choices", event.target.value)} rows={4} style={textarea} dir="ltr" /></Field>}
          <div style={sx`display:flex;gap:16px;flex-wrap:wrap`}>
            {[["filterable", "قابلة للتصفية"], ["comparable", "قابلة للمقارنة"], ["show_on_card", "تظهر في البطاقة"]].map(([key, label]) => (
              <label key={key} style={sx`display:flex;align-items:center;gap:6px;font-size:13px`}><input type="checkbox" checked={!!form[key]} onChange={(event) => change(key, event.target.checked)} />{label}</label>
            ))}
          </div>
          <div style={sx`display:flex;gap:8px`}><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الخاصية"}</Button><Button variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button></div>
        </div>
      )}
    </Modal>
  );
}
