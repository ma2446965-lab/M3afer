"use client";
// Admin panel tab for the "جدولي" 50-EGP planner service.
// Lists scheduleRequests; the admin uploads the hand-built schedule image
// (Firebase Storage) and hits "إرسال" → the request becomes fulfilled and the
// student sees/downloads the image on /planner.
import { useEffect, useRef, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { PLANNER_PRODUCT } from "@/lib/plans";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import {
  CalendarDays,
  Loader2,
  UploadCloud,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Copy
} from "lucide-react";

const FILTERS = [
  { id: "pending", label: "بانتظار التنفيذ ⏳" },
  { id: "awaiting_payment", label: "لم يدفع بعد 💳" },
  { id: "fulfilled", label: "تم التسليم ✅" },
  { id: "all", label: "الكل" }
] as const;

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-EG", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "—";

const hoursSince = (iso?: string | null) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 3_600_000)) : 0;
};

function RequestCard({ r, onFulfilled }: { r: any; onFulfilled: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(r.status === "pending");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const intake = r.intake || {};
  const hs = r.status === "pending" ? hoursSince(r?.payment?.paidAt) : 0;
  const overdue = r.status === "pending" && hs >= 24;

  const send = async () => {
    if (!file || busy) return;
    setBusy(true);
    setErr("");
    try {
      const safe = file.name.replace(/[^\w.\-ء-ي]/g, "_").slice(-60);
      const path = `planner-fulfillments/${r.id}/${Date.now()}-${safe}`;
      await uploadBytes(ref(storage, path), file);
      await updateDoc(doc(db, "scheduleRequests", r.id), {
        status: "fulfilled",
        fulfillment: {
          imagePath: path,
          note: note.trim() || null,
          sentAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      });
      onFulfilled();
    } catch (e: any) {
      console.error("fulfill failed", e);
      setErr(
        e?.code === "storage/unauthorized" || e?.code === "permission-denied"
          ? "مرفوض — تأكد إن Storage مفعّل و storage.rules اتنشرت في الـ console"
          : e?.message || "فشل الإرسال"
      );
    } finally {
      setBusy(false);
    }
  };

  const copyUuid = async () => {
    try {
      await navigator.clipboard.writeText(r.studentUuid || r.studentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={`bg-white dark:bg-navy-800 rounded-2xl border-2 overflow-hidden ${overdue ? "border-red-300 dark:border-red-800" : "border-slate-100 dark:border-navy-700"}`}>
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between gap-2 text-right">
        <div>
          <p className="font-bold text-sm">{intake.fullName || "—"}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {fmt(r.createdAt)} • {r.paid ? `مدفوع ${r?.payment?.amountEgp ?? PLANNER_PRODUCT.priceEgp} ج.م` : "لم يدفع"}
            {r.status === "pending" && <> • عدّى {hs} ساعة من الدفع</>}
          </p>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
            overdue
              ? "bg-red-100 text-red-600"
              : r.status === "fulfilled"
              ? "bg-green-100 text-green-700"
              : r.status === "pending"
              ? "bg-accent-100 text-accent-700"
              : "bg-slate-100 dark:bg-navy-700 text-slate-500"
          }`}
        >
          {overdue ? "متأخر! 🚨" : r.status === "fulfilled" ? "تم التسليم ✅" : r.status === "pending" ? "قيد التنفيذ ⏳" : "لم يدفع 💳"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t dark:border-navy-700 pt-3">
          {/* student meta */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button onClick={copyUuid} className="font-mono bg-slate-100 dark:bg-navy-700 px-2 py-1 rounded-lg flex items-center gap-1">
              <Copy size={11} /> {copied ? "اتنسخ ✅" : r.studentUuid || r.studentId}
            </button>
            <span className="text-slate-400">{r.studentEmail}</span>
            {(intake.grade || intake.track) && (
              <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 px-2 py-1 rounded-lg">
                {intake.grade} {intake.track ? `• ${intake.track}` : ""}
              </span>
            )}
            {intake.pomodoroPreferred && <span className="bg-red-50 text-red-500 px-2 py-1 rounded-lg">بومودورو 🍅</span>}
            <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 px-2 py-1 rounded-lg">
              {intake.dailyHoursTarget ?? "—"} ساعة/يوم
            </span>
          </div>

          {/* intake details */}
          {Array.isArray(intake.weekly) && intake.weekly.length > 0 && (
            <div className="text-xs space-y-1.5">
              <p className="font-bold text-slate-500">الجدول الأسبوعي:</p>
              {intake.weekly.map((d: any) => (
                <div key={d.day} className="bg-slate-50 dark:bg-navy-700/50 rounded-lg p-2">
                  <b>{d.day}</b>
                  {d.busy && <p className="text-slate-500">🔒 مشغول: {d.busy}</p>}
                  {d.free && <p className="text-slate-500">🟢 فاضي: {d.free}</p>}
                </div>
              ))}
            </div>
          )}
          {intake.prioritySubjects?.length > 0 && (
            <p className="text-xs text-slate-500"><b>أولويات:</b> {intake.prioritySubjects.join("، ")}</p>
          )}
          {intake.upcomingExams && <p className="text-xs text-slate-500"><b>امتحانات قريبة:</b> {intake.upcomingExams}</p>}
          {intake.notes && <p className="text-xs text-slate-500"><b>ملاحظات:</b> {intake.notes}</p>}
          {r.payment?.invoiceId != null && (
            <p className="text-[11px] text-slate-400 font-mono">invoice: {String(r.payment.invoiceId)} • {r.payment.method || ""}</p>
          )}

          {/* fulfillment */}
          {r.status === "fulfilled" ? (
            <p className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-2.5 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 size={14} /> اتسلّم {fmt(r?.fulfillment?.sentAt)}
              {r?.fulfillment?.note && <>(📝 {r.fulfillment.note})</>}
            </p>
          ) : (
            <div className="bg-brand-50/60 dark:bg-brand-900/10 border border-brand-100 dark:border-teal-900/30 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-teal-700 dark:text-brand-300 flex items-center gap-1">
                <UploadCloud size={14} /> ارفع صورة الجدول الجاهزة (PNG/JPG حتى 5MB):
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-500 file:text-white file:font-bold"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ملاحظة للطالب (اختياري)"
                className="w-full p-2 rounded-lg border dark:border-navy-600 bg-white dark:bg-navy-700 text-xs outline-none"
              />
              {err && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {err}</p>}
              <button
                onClick={send}
                disabled={!file || busy}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {busy ? "بيترفع ويتبعت..." : "إرسال للطالب ✅"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlannerRequestsManager() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "scheduleRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
        setErr("");
      },
      (e) => {
        console.error("planner admin listen failed", e);
        setErr("تعذر التحميل — تأكد إن firestore.rules الجديدة اتنشرت في الـ console");
        setLoading(false);
      }
    );
    return unsub;
  }, [tick]);

  const counts = list.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const filtered = filter === "all" ? list : list.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-500" /> طلبات «جدولي» المدفوعة
        </h2>
        <button onClick={() => setTick((t) => t + 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-navy-700" title="تحديث">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${
              filter === f.id ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-navy-700 text-slate-500"
            }`}
          >
            {f.label} {f.id === "all" ? `(${list.length})` : counts[f.id] ? `(${counts[f.id]})` : ""}
          </button>
        ))}
      </div>

      {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{err}</p>}
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center p-8 bg-white dark:bg-navy-800 rounded-2xl border dark:border-navy-700">
          <Clock className="mx-auto mb-2 opacity-50" /> مفيش طلبات في الفلتر ده
        </p>
      ) : (
        filtered.map((r) => <RequestCard key={r.id} r={r} onFulfilled={() => setTick((t) => t + 1)} />)
      )}
    </div>
  );
}
