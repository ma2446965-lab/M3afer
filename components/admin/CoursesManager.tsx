"use client";
// Admin tab «الكورسات 📦»: create/edit courses, attach & reorder their
// lectures, and set the bundle discount (discountPct). Prices stay lecture-
// level — the course price is ALWAYS computed at checkout
// (lib/courses.ts computeCourseQuote), never stored here.
// lectureCount is denormalized on the course doc for cheap public cards;
// every attach/detach/reorder/delete recounts it from the source of truth.
import { useEffect, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { LECTURES_COL } from "@/lib/lectures";
import {
  COURSES_COL,
  COURSE_PURCHASES_COL,
  COURSE_DISCOUNT_CAP,
  DEFAULT_COURSE_DISCOUNT_PCT,
  reorderNeighbor,
  sanitizeDiscountPct,
  sortCourseLectures,
  validateCourseDraft
} from "@/lib/courses";
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
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  Package,
  Loader2,
  PlusCircle,
  Trash2,
  Save,
  UploadCloud,
  RefreshCw,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Link2,
  Unlink,
  BarChart3,
  Pencil,
  X
} from "lucide-react";

const safeName = (n: string) => n.replace(/[^\w.\-ء-ي]/g, "_").slice(-60);

function Thumb({ path }: { path?: string | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let on = true;
    if (path) getDownloadURL(ref(storage, path)).then((u) => on && setUrl(u)).catch(() => {});
    return () => { on = false; };
  }, [path]);
  if (!url) return <div className="w-14 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-violet-400"><Package size={16} /></div>;
  return <img src={url} alt="" className="w-14 h-10 rounded-lg object-cover" />;
}

export default function CoursesManager() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [attachPick, setAttachPick] = useState("");
  const [stats, setStats] = useState<Record<string, { count: number } | "loading">>({});

  // form state
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [description, setDescription] = useState("");
  const [discountPct, setDiscountPct] = useState(String(DEFAULT_COURSE_DISCOUNT_PCT * 100));
  const [order, setOrder] = useState("1");
  const [published, setPublished] = useState(true);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "subjects"));
        setSubjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COURSES_COL), orderBy("createdAt", "desc")),
      (snap) => {
        setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
        setErr("");
      },
      () => {
        setErr("تعذر تحميل الكورسات — تأكد إن firestore.rules الجديدة اتنشرت");
        setLoading(false);
      }
    );
    return unsub;
  }, [tick]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, LECTURES_COL), orderBy("createdAt", "desc")),
      (snap) => setLectures(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      () => {}
    );
    return unsub;
  }, [tick]);

  /** Recompute a course's denormalized lectureCount from the truth. */
  const recount = async (courseId: string) => {
    if (!courseId) return;
    try {
      const snap = await getCountFromServer(query(collection(db, LECTURES_COL), where("courseId", "==", courseId)));
      await updateDoc(doc(db, COURSES_COL, courseId), {
        lectureCount: snap.data().count,
        updatedAt: new Date().toISOString()
      });
    } catch {}
  };

  const pickSubject = (id: string) => {
    setSubjectId(id);
    const s = subjects.find((x) => x.id === id);
    if (s?.teacherName && !teacherName) setTeacherName(s.teacherName);
  };

  const resetForm = () => {
    setTitle(""); setSubjectId(""); setTeacherName(""); setDescription("");
    setDiscountPct(String(DEFAULT_COURSE_DISCOUNT_PCT * 100)); setOrder("1");
    setPublished(true); setThumbFile(null); setFormErr(""); setEditingId(null);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setTitle(c.title || "");
    setSubjectId(c.subjectId || "");
    setTeacherName(c.teacherName || "");
    setDescription(c.description || "");
    setDiscountPct(String(Math.round((c.discountPct ?? DEFAULT_COURSE_DISCOUNT_PCT) * 100)));
    setOrder(String(c.order ?? 1));
    setPublished(c.published !== false);
    setThumbFile(null);
    setFormErr("");
    setShowForm(true);
  };

  const save = async () => {
    setFormErr("");
    const v = validateCourseDraft({ title, teacherName, description });
    if (!v.ok) return setFormErr(v.reason);
    const subj = subjects.find((x) => x.id === subjectId);
    if (!subj) return setFormErr("اختار المادة");
    const pct = sanitizeDiscountPct(Number(discountPct) / 100);
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        subjectId,
        subjectName: subj.name || "",
        teacherName: teacherName.trim() || subj.teacherName || null,
        description: description.trim() || null,
        discountPct: pct,
        published,
        order: Number(order) || 0,
        updatedAt: new Date().toISOString()
      };
      let id = editingId;
      if (!id) {
        const refDoc = await addDoc(collection(db, COURSES_COL), {
          ...payload,
          thumbnailPath: null,
          lectureCount: 0,
          createdAt: new Date().toISOString()
        });
        id = refDoc.id;
      } else {
        await updateDoc(doc(db, COURSES_COL, id), payload);
      }
      if (thumbFile && id) {
        const thumbnailPath = `lecture-thumbs/${id}/${Date.now()}-${safeName(thumbFile.name)}`;
        await uploadBytes(ref(storage, thumbnailPath), thumbFile);
        await updateDoc(doc(db, COURSES_COL, id), { thumbnailPath });
      }
      resetForm();
      setShowForm(false);
    } catch (e: any) {
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
      await updateDoc(doc(db, COURSES_COL, id), { ...fields, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      setErr(e?.message || "فشل التعديل");
    }
  };

  const remove = async (c: any) => {
    if ((c.lectureCount || 0) > 0) {
      setErr(`مش هينفع تمسح «${c.title}» وفيه ${c.lectureCount} محاضرة مربوطة — فك ربطها الأول من القايمة تحت`);
      setExpandedId(c.id);
      return;
    }
    if (!confirm(`حذف الكورس «${c.title}»؟`)) return;
    try {
      await deleteDoc(doc(db, COURSES_COL, c.id));
    } catch (e: any) {
      setErr(e?.message || "فشل الحذف");
    }
  };

  const loadStats = async (id: string) => {
    setStats((p) => ({ ...p, [id]: "loading" }));
    try {
      const snap = await getCountFromServer(query(collection(db, COURSE_PURCHASES_COL), where("courseId", "==", id)));
      setStats((p) => ({ ...p, [id]: { count: snap.data().count } }));
    } catch {
      setStats((p) => ({ ...p, [id]: { count: -1 } }));
    }
  };

  const attach = async (course: any) => {
    if (!attachPick) return;
    try {
      await updateDoc(doc(db, LECTURES_COL, attachPick), { courseId: course.id });
      setAttachPick("");
      await recount(course.id);
    } catch (e: any) {
      setErr(e?.message || "فشل الربط");
    }
  };

  const detach = async (course: any, lectureId: string) => {
    try {
      await updateDoc(doc(db, LECTURES_COL, lectureId), { courseId: "" });
      await recount(course.id);
      const c = courses.find((x) => x.id === course.id);
      if (c && (c.lectureCount || 0) <= 1) setErr("");
    } catch (e: any) {
      setErr(e?.message || "فشل فك الربط");
    }
  };

  const move = async (course: any, lectureId: string, dir: "up" | "down") => {
    const sorted = sortCourseLectures(lectures.filter((l) => l.courseId === course.id));
    const ids = sorted.map((l) => l.id as string);
    const pair = reorderNeighbor(ids, lectureId, dir);
    if (!pair) return;
    const eff = new Map(sorted.map((l, i) => [l.id, l.order ?? (i + 1) * 10]));
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, LECTURES_COL, pair[0]), { order: eff.get(pair[1]) });
      batch.update(doc(db, LECTURES_COL, pair[1]), { order: eff.get(pair[0]) });
      await batch.commit();
    } catch (e: any) {
      setErr(e?.message || "فشل الترتيب");
    }
  };

  const unassigned = lectures.filter((l) => !l.courseId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2"><Package size={18} className="text-brand-500" /> إدارة الكورسات</h2>
        <div className="flex gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-navy-700" title="تحديث"><RefreshCw size={14} /></button>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
            {showForm ? <X size={14} /> : <PlusCircle size={14} />} {showForm ? "إلغاء" : "كورس جديد"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-navy-800 rounded-2xl border-2 border-violet-400 p-4 space-y-3">
          <h3 className="font-bold text-sm">{editingId ? "تعديل كورس ✏️" : "كورس جديد 📦"}</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم الكورس * (مثال: فيزياء — الباب الأول كامل)" className="w-full p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={subjectId} onChange={(e) => pickSubject(e.target.value)} className="p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 text-sm">
              <option value="">المادة... *</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="اسم المدرّس" className="p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 text-sm" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="وصف الكورس (يظهر في صفحة الكورس)" className="w-full p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 text-sm resize-none" />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-bold p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 flex items-center gap-1.5">
              خصم %
              <input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} type="number" min={0} max={COURSE_DISCOUNT_CAP * 100} className="w-14 bg-transparent outline-none" />
            </label>
            <input value={order} onChange={(e) => setOrder(e.target.value)} type="number" min={0} placeholder="الترتيب" className="p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 text-sm" />
            <label className="flex items-center gap-1.5 text-xs font-bold p-2.5 rounded-xl border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 cursor-pointer">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" /> منشور
            </label>
          </div>
          <p className="text-[11px] text-slate-400">سعر الكورس بيتحسب أوتوماتيك = مجموع أسعار محاضراته (اللي الطالب مش مالكها) − الخصم. الأسعار بتتظبط من تبويب المحاضرات 🎬.</p>
          <label className="text-xs p-2.5 rounded-xl border-2 border-dashed dark:border-navy-600 text-slate-500 flex items-center gap-2 cursor-pointer">
            <UploadCloud size={14} /> {thumbFile ? thumbFile.name : "صورة غلاف الكورس (اختياري)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setThumbFile(e.target.files?.[0] || null)} />
          </label>
          {formErr && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {formErr}</p>}
          <button onClick={save} disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? "بيترفع..." : editingId ? "حفظ التعديلات" : "حفظ الكورس"}
          </button>
        </div>
      )}

      {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{err}</p>}
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-brand-500" /></div>
      ) : courses.length === 0 ? (
        <p className="text-sm text-slate-400 text-center p-8 bg-white dark:bg-navy-800 rounded-2xl border dark:border-navy-700">
          <Package className="mx-auto mb-2 opacity-50" /> لسه مفيش كورسات — اعمل أول كورس واربط فيه محاضراتك
        </p>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => {
            const st = stats[c.id];
            const courseLectures = sortCourseLectures(lectures.filter((l) => l.courseId === c.id));
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className="bg-white dark:bg-navy-800 rounded-2xl border dark:border-navy-700 p-3.5 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Thumb path={c.thumbnailPath} />
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-bold text-sm">{c.title}</p>
                    <p className="text-[11px] text-slate-400">{c.subjectName}{c.teacherName ? ` • ${c.teacherName}` : ""} • خصم {Math.round((c.discountPct ?? 0) * 100)}% • ترتيب {c.order ?? 0}</p>
                  </div>
                  <span className="text-[10px] bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full font-bold">
                    {c.lectureCount ?? courseLectures.length} محاضرة
                  </span>
                  <label className="text-[11px] flex items-center gap-1 font-bold text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={c.published !== false} onChange={(e) => patch(c.id, { published: e.target.checked })} className="accent-brand-500" /> منشور
                  </label>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setExpandedId(expanded ? null : c.id)} className="text-[11px] bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300 px-2.5 py-1.5 rounded-lg font-bold">
                    {expanded ? "قفل القايمة ▲" : `المحاضرات (${courseLectures.length}) ▼`}
                  </button>
                  <button onClick={() => openEdit(c)} className="text-[11px] bg-slate-100 dark:bg-navy-700 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 text-slate-600 dark:text-gray-300">
                    <Pencil size={12} /> تعديل
                  </button>
                  <button onClick={() => loadStats(c.id)} className="text-[11px] bg-slate-100 dark:bg-navy-700 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 text-slate-600 dark:text-gray-300">
                    <BarChart3 size={12} />
                    {st === "loading" ? "..." : st ? (st.count < 0 ? "خطأ" : `مبيعات الكورس: ${st.count}`) : "المبيعات"}
                  </button>
                  <button onClick={() => recount(c.id)} className="text-[11px] bg-slate-100 dark:bg-navy-700 px-2.5 py-1.5 rounded-lg font-bold text-slate-600 dark:text-gray-300" title="إعادة حساب عدد المحاضرات من المصدر">
                    إعادة عدّ ⟳
                  </button>
                  <button onClick={() => remove(c)} className="text-[11px] bg-red-50 dark:bg-red-900/20 text-red-500 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1">
                    <Trash2 size={12} /> حذف
                  </button>
                </div>

                {expanded && (
                  <div className="border-t dark:border-navy-700 pt-2 space-y-1.5">
                    {courseLectures.length === 0 && (
                      <p className="text-xs text-slate-400 py-2">مفيش محاضرات مربوطة لسه — اربط من القايمة تحت، أو اعمل محاضرة جديدة من تبويب «المحاضرات 🎬» واختار الكورس ده فيها.</p>
                    )}
                    {courseLectures.map((l, i) => (
                      <div key={l.id} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-navy-700/40 rounded-lg px-2.5 py-2">
                        <span className="text-slate-400 font-mono w-5 text-center">{i + 1}</span>
                        <p className="font-bold flex-1 truncate">{l.title}</p>
                        <span className="text-slate-400">{l.priceEgp > 0 ? `${l.priceEgp} ج.م` : "مجاني"}</span>
                        <button onClick={() => move(c, l.id, "up")} disabled={i === 0} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-25" title="طلّع"><ChevronUp size={14} /></button>
                        <button onClick={() => move(c, l.id, "down")} disabled={i === courseLectures.length - 1} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-25" title="نزّل"><ChevronDown size={14} /></button>
                        <button onClick={() => detach(c, l.id)} className="p-1 rounded text-accent-600 hover:bg-accent-50 dark:hover:bg-amber-900/20" title="فك الربط (المحاضرة مش بتتمسح — بتفضل لوحدها)"><Unlink size={14} /></button>
                      </div>
                    ))}
                    {unassigned.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <select value={attachPick} onChange={(e) => setAttachPick(e.target.value)} className="flex-1 p-2 rounded-lg border dark:border-navy-600 bg-slate-50 dark:bg-navy-700 text-xs">
                          <option value="">اربط محاضرة موجودة ({unassigned.length} بدون كورس)...</option>
                          {unassigned.map((l) => (
                            <option key={l.id} value={l.id}>{l.title} — {l.subjectName}{l.priceEgp > 0 ? ` (${l.priceEgp}ج)` : " (مجاني)"}</option>
                          ))}
                        </select>
                        <button onClick={() => attach(c)} disabled={!attachPick} className="text-xs bg-brand-600 disabled:opacity-40 text-white font-bold px-3 py-2 rounded-lg flex items-center gap-1">
                          <Link2 size={12} /> اربط
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
