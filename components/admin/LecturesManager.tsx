"use client";
// Admin tab: recorded-lectures marketplace manager.
// Create lectures (title/subject/price/YouTube URL/thumbnail/notes PDF),
// toggle publish, inline price edits, delete, and per-lecture sales stats.
// Media (videoUrl/notesPdfPath) is written into lectures/{id}/private/media —
// the rules-lock that hides it from everyone except buyers/admin.
import { useEffect, useRef, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { parseYouTubeId, LECTURES_COL, PURCHASES_COL } from "@/lib/lectures";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import {
  Clapperboard,
  Loader2,
  PlusCircle,
  Trash2,
  Save,
  UploadCloud,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Gift,
  X
} from "lucide-react";

const safeName = (n: string) => n.replace(/[^\w.\-ء-ي]/g, "_").slice(-60);

export default function LecturesManager() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tick, setTick] = useState(0);

  // form state
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [priceEgp, setPriceEgp] = useState("25");
  const [isPreview, setIsPreview] = useState(false);
  const [published, setPublished] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [stats, setStats] = useState<Record<string, { count: number } | "loading">>({});

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "subjects"));
        setSubjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const q = query(collection(db, LECTURES_COL), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLectures(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
        setErr("");
      },
      (e) => {
        console.error("lectures admin listen failed", e);
        setErr("تعذر التحميل — تأكد إن firestore.rules الجديدة اتنشرت");
        setLoading(false);
      }
    );
    return unsub;
  }, [tick]);

  const pickSubject = (id: string) => {
    setSubjectId(id);
    const s = subjects.find((x) => x.id === id);
    if (s?.teacherName && !teacherName) setTeacherName(s.teacherName);
  };

  const resetForm = () => {
    setTitle(""); setSubjectId(""); setTeacherName(""); setDescription("");
    setDurationMin(""); setPriceEgp("25"); setIsPreview(false); setPublished(true);
    setVideoUrl(""); setThumbFile(null); setPdfFile(null); setFormErr("");
  };

  const createLecture = async () => {
    setFormErr("");
    if (title.trim().length < 3) return setFormErr("العنوان لازم 3 أحرف على الأقل");
    const subj = subjects.find((x) => x.id === subjectId);
    if (!subj) return setFormErr("اختار المادة");
    const price = Number(priceEgp);
    if (!Number.isFinite(price) || price < 0 || price > 100000) return setFormErr("سعر غير صالح");
    if (price > 0 && !isPreview && !parseYouTubeId(videoUrl)) return setFormErr("لينك يوتيوب غير صالح (للمحاضرة المدفوعة لازم فيديو)");
    if (saving) return;
    setSaving(true);
    try {
      const base = {
        title: title.trim(),
        description: description.trim() || null,
        subjectId,
        subjectName: subj.name || "",
        teacherName: teacherName.trim() || subj.teacherName || null,
        durationMin: durationMin ? Number(durationMin) || null : null,
        priceEgp: price,
        isFreePreview: isPreview,
        published,
        order: lectures.length + 1,
        thumbnailPath: null as string | null,
        createdAt: new Date().toISOString()
      };
      const refDoc = await addDoc(collection(db, LECTURES_COL), base);
      const id = refDoc.id;
      let thumbnailPath: string | null = null;
      let notesPdfPath: string | null = null;
      if (thumbFile) {
        thumbnailPath = `lecture-thumbs/${id}/${Date.now()}-${safeName(thumbFile.name)}`;
        await uploadBytes(ref(storage, thumbnailPath), thumbFile);
        await updateDoc(refDoc, { thumbnailPath });
      }
      if (pdfFile) {
        notesPdfPath = `lecture-notes/${id}/${Date.now()}-${safeName(pdfFile.name)}`;
        await uploadBytes(ref(storage, notesPdfPath), pdfFile);
      }
      await setDoc(doc(db, LECTURES_COL, id, "private", "media"), {
        videoUrl: videoUrl.trim() || null,
        notesPdfPath,
        updatedAt: new Date().toISOString()
      });
      resetForm();
      setShowForm(false);
    } catch (e: any) {
      console.error("create lecture failed", e);
      setFormErr(
        e?.code === "permission-denied" || e?.code === "storage/unauthorized"
          ? "مرفوض — تأكد إن firestore.rules و storage.rules الجديدة اتنشرت"
          : e?.message || "فشل الحفظ"
      );
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, fields: Record<string, any>) => {
    try {
      await updateDoc(doc(db, LECTURES_COL, id), fields);
    } catch (e: any) {
      setErr(e?.message || "فشل التعديل");
    }
  };

  const loadStats = async (id: string) => {
    setStats((p) => ({ ...p, [id]: "loading" }));
    try {
      const snap = await getCountFromServer(query(collection(db, PURCHASES_COL), where("lectureId", "==", id)));
      setStats((p) => ({ ...p, [id]: { count: snap.data().count } }));
    } catch {
      setStats((p) => ({ ...p, [id]: { count: -1 } }));
    }
  };

  const remove = async (l: any) => {
    const st = stats[l.id];
    const count = st && st !== "loading" ? st.count : "?";
    if (!confirm(`حذف «${l.title}»؟ (${count} مشتري — مشترينهم هيحتفظوا بسجلاتهم)`)) return;
    try {
      await deleteDoc(doc(db, LECTURES_COL, l.id));
    } catch (e: any) {
      setErr(e?.message || "فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2"><Clapperboard size={18} className="text-indigo-500" /> إدارة المحاضرات</h2>
        <div className="flex gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700" title="تحديث"><RefreshCw size={14} /></button>
          <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
            {showForm ? <X size={14} /> : <PlusCircle size={14} />} {showForm ? "إلغاء" : "محاضرة جديدة"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-400 p-4 space-y-3">
          <h3 className="font-bold text-sm">محاضرة جديدة 🎬</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المحاضرة *" className="w-full p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={subjectId} onChange={(e) => pickSubject(e.target.value)} className="p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm">
              <option value="">المادة... *</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="اسم المدرّس" className="p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="وصف قصير (يظهر تحت الفيديو)" className="w-full p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm resize-none" />
          <div className="grid grid-cols-3 gap-2">
            <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} type="number" min={1} placeholder="المدة (دقيقة)" className="p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm" />
            <input value={priceEgp} onChange={(e) => setPriceEgp(e.target.value)} type="number" min={0} placeholder="السعر ج.م (0=مجاني)" className="p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm" />
            <label className="flex items-center gap-1.5 text-xs font-bold p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-pointer">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-indigo-500" /> منشورة
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-emerald-600 cursor-pointer">
            <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} className="accent-emerald-500" />
            <Gift size={14} /> معاينة مجانية (الكل يشوفها ببلاش — طُعم بيع مثالي)
          </label>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="لينك يوتيوب (Unlisted) — watch?v= أو youtu.be" className="w-full p-2.5 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-mono" dir="ltr" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs p-2.5 rounded-xl border-2 border-dashed dark:border-gray-600 text-gray-500 flex items-center gap-2 cursor-pointer">
              <UploadCloud size={14} /> {thumbFile ? thumbFile.name : "صورة الغلاف (اختياري)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setThumbFile(e.target.files?.[0] || null)} />
            </label>
            <label className="text-xs p-2.5 rounded-xl border-2 border-dashed dark:border-gray-600 text-gray-500 flex items-center gap-2 cursor-pointer">
              <UploadCloud size={14} /> {pdfFile ? pdfFile.name : "ملاحظات PDF (اختياري)"}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          {formErr && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {formErr}</p>}
          <button onClick={createLecture} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? "بيترفع..." : "حفظ المحاضرة"}
          </button>
        </div>
      )}

      {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{err}</p>}
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : lectures.length === 0 ? (
        <p className="text-sm text-gray-400 text-center p-8 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700">
          <Clapperboard className="mx-auto mb-2 opacity-50" /> لسه مفيش محاضرات — ضيف أول واحدة من الزرار فوق
        </p>
      ) : (
        <div className="space-y-2">
          {lectures.map((l) => {
            const st = stats[l.id];
            return (
            <div key={l.id} className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-3.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm flex-1 min-w-[140px]">{l.title}</p>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{l.subjectName}</span>
                {l.isFreePreview && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Gift size={10} /> معاينة</span>}
                <label className="text-[11px] flex items-center gap-1 font-bold text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={l.published !== false} onChange={(e) => patch(l.id, { published: e.target.checked })} className="accent-indigo-500" /> منشورة
                </label>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-400">السعر:</span>
                  <input
                    key={`p-${l.id}-${l.priceEgp}`}
                    defaultValue={l.priceEgp}
                    type="number"
                    min={0}
                    className="w-20 p-1.5 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0 && v !== l.priceEgp) patch(l.id, { priceEgp: v });
                    }}
                  />
                  <span className="text-gray-400">ج.م</span>
                </div>
                <button onClick={() => loadStats(l.id)} className="text-[11px] bg-gray-100 dark:bg-gray-700 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <BarChart3 size={12} />
                  {st === "loading"
                    ? "..."
                    : st
                    ? st.count < 0
                      ? "خطأ"
                      : `مبيعات: ${st.count} (${st.count * (l.priceEgp || 0)} ج.م)`
                    : "المبيعات"}
                </button>
                <button onClick={() => remove(l)} className="text-[11px] bg-red-50 dark:bg-red-900/20 text-red-500 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1">
                  <Trash2 size={12} /> حذف
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
