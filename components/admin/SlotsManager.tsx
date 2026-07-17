"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Subject, LessonSlot, SlotInput, EMPTY_SLOT, formatSlotDate } from "@/lib/booking";
import { Plus, Pencil, Trash2, X, Loader2, CalendarDays } from "lucide-react";

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const labelCls = "text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block";

export default function SlotsManager() {
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LessonSlot | null>(null);
  const [form, setForm] = useState<SlotInput>(EMPTY_SLOT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Subjects are needed for the dropdown + resolving subjectId → name in the table
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "subjects"), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, "id">) }));
      rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
      setSubjects(rows);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "slots"),
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<LessonSlot, "id">) })
        );
        // Upcoming first
        rows.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
        setSlots(rows);
        setListLoading(false);
      },
      (err) => {
        console.error(err);
        setListError("مش قادر أقرا collection المواعيد — اتأكد من Firestore Security Rules");
        setListLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name || "مادة محذوفة";

  const filteredSlots = filterSubject
    ? slots.filter((s) => s.subjectId === filterSubject)
    : slots;

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_SLOT, subjectId: subjects[0]?.id || "" });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (s: LessonSlot) => {
    setEditing(s);
    setForm({
      subjectId: s.subjectId,
      date: s.date,
      time: s.time,
      capacity: s.capacity,
      bookedCount: s.bookedCount
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.subjectId) return setFormError("اختار المادة");
    if (!form.date) return setFormError("اختار التاريخ");
    if (!form.time) return setFormError("اختار الوقت");
    if (form.capacity < 1) return setFormError("السعة لازم تكون 1 على الأقل");
    if (form.bookedCount < 0 || form.bookedCount > form.capacity)
      return setFormError("عدد المحجوزين لازم يكون بين 0 والسعة");

    setSaving(true);
    setFormError("");
    const payload: SlotInput = {
      subjectId: form.subjectId,
      date: form.date,
      time: form.time,
      capacity: Number(form.capacity),
      bookedCount: Number(form.bookedCount)
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "slots", editing.id), { ...payload });
      } else {
        await addDoc(collection(db, "slots"), payload);
      }
      setFormOpen(false);
    } catch (e: any) {
      setFormError(
        e?.code === "permission-denied"
          ? "مفيش صلاحية كتابة — اتأكد إن role بتاعك 'admin' في Firestore وإن القواعد الجديدة اترفعت"
          : e?.message || "حصل خطأ أثناء الحفظ"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: LessonSlot) => {
    if (!window.confirm(`متأكد إنك عايز تحذف ميعاد "${formatSlotDate(s.date)} - ${s.time}"؟`)) return;
    try {
      await deleteDoc(doc(db, "slots", s.id));
    } catch (e: any) {
      window.alert("فشل الحذف: " + (e?.code === "permission-denied" ? "مفيش صلاحية" : e?.message || ""));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b dark:border-gray-700">
        <h2 className="font-bold flex items-center gap-2">
          <CalendarDays size={18} /> المواعيد المتاحة
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded-full">
            {filteredSlots.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">كل المواد</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl"
          >
            <Plus size={16} /> إضافة ميعاد
          </button>
        </div>
      </div>

      {listLoading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      ) : listError ? (
        <p className="p-6 text-sm text-red-500">{listError}</p>
      ) : filteredSlots.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">
          {slots.length === 0
            ? "مفيش مواعيد لسه — ضيف مادة الأول (لو مفيش) وبعدين دوس \"إضافة ميعاد\" 📅"
            : "مفيش مواعيد للمادة دي"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs text-gray-400 border-b dark:border-gray-700 text-right">
                <th className="p-3 font-medium">المادة</th>
                <th className="p-3 font-medium">التاريخ</th>
                <th className="p-3 font-medium">الوقت</th>
                <th className="p-3 font-medium">السعة</th>
                <th className="p-3 font-medium">المحجوز</th>
                <th className="p-3 font-medium">المتبقي</th>
                <th className="p-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredSlots.map((s) => {
                const remaining = s.capacity - s.bookedCount;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-bold">{subjectName(s.subjectId)}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatSlotDate(s.date)}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-300" dir="ltr">
                      {s.time}
                    </td>
                    <td className="p-3">{s.capacity}</td>
                    <td className="p-3">{s.bookedCount}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          remaining <= 0
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : remaining <= Math.max(1, Math.floor(s.capacity * 0.25))
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        }`}
                      >
                        {remaining <= 0 ? "مكتمل ❌" : `${remaining} متاح`}
                      </span>
                    </td>
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
                );
              })}
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
              <h3 className="font-bold text-lg">{editing ? "تعديل ميعاد" : "إضافة ميعاد جديد"}</h3>
              <button
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {subjects.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl">
                ⚠️ لازم تضيف مادة الأول من تاب &quot;المواد&quot; قبل ما تقدر تضيف مواعيد
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>المادة *</label>
                  <select
                    className={inputCls}
                    value={form.subjectId}
                    onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  >
                    <option value="">— اختار المادة —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} • {s.teacherName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>التاريخ *</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>الوقت *</label>
                    <input
                      type="time"
                      className={inputCls}
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>السعة (عدد الطلاب) *</label>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.valueAsNumber || 0 })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>المحجوز حاليًا (عادة 0)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={form.bookedCount}
                      onChange={(e) => setForm({ ...form, bookedCount: e.target.valueAsNumber || 0 })}
                    />
                  </div>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
