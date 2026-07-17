"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Subject, SubjectInput, EMPTY_SUBJECT } from "@/lib/booking";
import { Plus, Pencil, Trash2, X, Loader2, BookOpen } from "lucide-react";

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const labelCls = "text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block";

export default function SubjectsManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectInput>(EMPTY_SUBJECT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Live subscription — the table updates instantly on any add/edit/delete
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "subjects"),
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Subject, "id">) })
        );
        rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        setSubjects(rows);
        setListLoading(false);
      },
      (err) => {
        console.error(err);
        setListError("مش قادر أقرا collection المواد — اتأكد من Firestore Security Rules");
        setListLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_SUBJECT });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description,
      teacherName: s.teacherName,
      price: s.price,
      imageUrl: s.imageUrl
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return setFormError("اسم المادة مطلوب");
    if (!form.teacherName.trim()) return setFormError("اسم المدرس مطلوب");
    if (form.price < 0) return setFormError("السعر لازم يكون 0 أو أكتر");

    setSaving(true);
    setFormError("");
    const payload: SubjectInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      teacherName: form.teacherName.trim(),
      price: Number(form.price) || 0,
      imageUrl: form.imageUrl.trim()
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "subjects", editing.id), { ...payload });
      } else {
        await addDoc(collection(db, "subjects"), payload);
      }
      setFormOpen(false);
    } catch (e: any) {
      setFormError(
        e?.code === "permission-denied"
          ? "مفيش صلاحية كتابة — اتأكد إن role بتاعك 'admin' في Firestore وإن القواعد الجديدة اترفعت (Firebase Console)"
          : e?.message || "حصل خطأ أثناء الحفظ"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Subject) => {
    if (!window.confirm(`متأكد إنك عايز تحذف مادة "${s.name}"؟`)) return;
    try {
      await deleteDoc(doc(db, "subjects", s.id));
    } catch (e: any) {
      window.alert("فشل الحذف: " + (e?.code === "permission-denied" ? "مفيش صلاحية" : e?.message || ""));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="font-bold flex items-center gap-2">
          <BookOpen size={18} /> المواد الدراسية
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded-full">
            {subjects.length}
          </span>
        </h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl"
        >
          <Plus size={16} /> إضافة مادة
        </button>
      </div>

      {listLoading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      ) : listError ? (
        <p className="p-6 text-sm text-red-500">{listError}</p>
      ) : subjects.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">
          مفيش مواد لسه — دوس &quot;إضافة مادة&quot; وابدأ 📚
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-xs text-gray-400 border-b dark:border-gray-700 text-right">
                <th className="p-3 font-medium">الصورة</th>
                <th className="p-3 font-medium">اسم المادة</th>
                <th className="p-3 font-medium">المدرس</th>
                <th className="p-3 font-medium">الوصف</th>
                <th className="p-3 font-medium">السعر</th>
                <th className="p-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {subjects.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="p-3">
                    {s.imageUrl ? (
                      <img
                        src={s.imageUrl}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg">
                        📚
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-bold">{s.name}</td>
                  <td className="p-3 text-gray-500 dark:text-gray-400">{s.teacherName}</td>
                  <td className="p-3 text-gray-500 dark:text-gray-400 max-w-[220px]">
                    <span className="line-clamp-2 text-xs">{s.description || "—"}</span>
                  </td>
                  <td className="p-3 font-bold whitespace-nowrap">{s.price} ج.م</td>
                  <td className="p-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(s)}
                        title="تعديل"
                        className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        title="حذف"
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !saving && setFormOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">{editing ? "تعديل مادة" : "إضافة مادة جديدة"}</h3>
              <button
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>اسم المادة *</label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: فيزياء"
                />
              </div>
              <div>
                <label className={labelCls}>اسم المدرس *</label>
                <input
                  className={inputCls}
                  value={form.teacherName}
                  onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                  placeholder="مثال: أ. محمد سامي"
                />
              </div>
              <div>
                <label className={labelCls}>السعر (ج.م)</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.valueAsNumber || 0 })}
                />
              </div>
              <div>
                <label className={labelCls}>الوصف</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف قصير للمادة..."
                />
              </div>
              <div>
                <label className={labelCls}>رابط الصورة (imageUrl)</label>
                <input
                  dir="ltr"
                  className={inputCls}
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="mt-2 w-full h-32 object-cover rounded-lg bg-gray-100 dark:bg-gray-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>

              {formError && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
                  {formError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editing ? "حفظ التعديلات" : "إضافة"}
                </button>
                <button
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-gray-700"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
