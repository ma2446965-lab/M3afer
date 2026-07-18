"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import HamburgerMenu from "@/components/HamburgerMenu";
import BottomNav from "@/components/BottomNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db, storage } from "@/lib/firebase";
import { PLANNER_PRODUCT } from "@/lib/plans";
import { getSubjectsForGradeTrack } from "@/lib/subjects";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import {
  CalendarDays,
  Clock,
  Loader2,
  Check,
  RefreshCw,
  CreditCard,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
  ExternalLink,
  Timer,
  ChevronDown,
  PartyPopper
} from "lucide-react";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: "بانتظار الدفع 💳", cls: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" },
  pending: { label: "قيد التنفيذ ⏳", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  fulfilled: { label: "تم التسليم ✅", cls: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" }
};

const hoursSince = (iso?: string | null): number => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 3_600_000));
};

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (!state) return null;
  const map: Record<string, { text: string; cls: string }> = {
    success: {
      text: "✅ استلمنا الدفع! جاري تأكيده تلقائيًا — وطلبك هيتحول لـ «قيد التنفيذ» خلال ثوانٍ. هيتم الرد بجدولك خلال 24 ساعة 🎉",
      cls: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30"
    },
    pending: {
      text: "⏳ استلمنا طلبك — أكمل الدفع بالطريقة اللي اخترتها (فوري/محفظة) وهيتأكد تلقائيًا.",
      cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30"
    },
    failed: {
      text: "❌ الدفع ما تمش. طلبك محفوظ — اضغط «أكمل الدفع» جنبه وجرب تاني.",
      cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900/30"
    }
  };
  const item = map[state];
  if (!item) return null;
  return <p className={`text-sm p-3 rounded-xl border leading-relaxed ${item.cls}`}>{item.text}</p>;
}

/** Fulfilled schedule image — download URL is only fetchable for the owner
 *  (Storage rules check the request doc), so loading happens on demand. */
function FulfilledImage({ path, note }: { path: string; note?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    if (url || loading) return;
    setLoading(true);
    setErr("");
    try {
      setUrl(await getDownloadURL(ref(storage, path)));
    } catch (e: any) {
      setErr("تعذر تحميل الصورة — جرب تاني أو كلم الدعم");
    } finally {
      setLoading(false);
    }
  };

  if (!url) {
    return (
      <button
        onClick={load}
        disabled={loading}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
        {loading ? "بنحضّر جدولك..." : "عرض صورة جدولي 🎉"}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt="جدول المذاكرة" className="w-full rounded-xl border dark:border-gray-700" />
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1"
      >
        <ExternalLink size={12} /> فتح/تحميل بجودة كاملة
      </a>
      {err && <p className="text-xs text-red-500">{err}</p>}
      {note && <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl">📝 ملاحظة من الإدارة: {note}</p>}
    </div>
  );
}

function PlannerPageInner() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // ---- my requests
  const [requests, setRequests] = useState<any[]>([]);
  const [reqErr, setReqErr] = useState("");

  // ---- form state (full field set — confirmed)
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [free, setFree] = useState<Record<string, string>>({});
  const [dailyHours, setDailyHours] = useState("4");
  const [prioritySubjects, setPrioritySubjects] = useState<string[]>([]);
  const [upcomingExams, setUpcomingExams] = useState("");
  const [pomodoro, setPomodoro] = useState(true);
  const [notes, setNotes] = useState("");
  const [formErr, setFormErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "scheduleRequests"), where("studentId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        setRequests(list);
        setReqErr("");
      },
      (e) => {
        console.error("scheduleRequests listen failed", e);
        setReqErr("تعذر تحميل طلباتك — لو الخدمة جديدة عندك فده غالبًا إعداد Rules في الـ console");
      }
    );
    return unsub;
  }, [user]);

  const gradeSubjects = useMemo(() => {
    if (!profile) return [] as string[];
    try {
      return (getSubjectsForGradeTrack(profile.grade as any, profile.track as any) || [])
        .map((s: any) => s?.name)
        .filter((n: unknown): n is string => typeof n === "string" && !!n);
    } catch {
      return [];
    }
  }, [profile]);

  const toggleSubject = (name: string) =>
    setPrioritySubjects((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));

  const startCheckout = async (requestId: string) => {
    const token = await user!.getIdToken();
    const res = await fetch("/api/fatorak/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ product: PLANNER_PRODUCT.kind, requestId })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) throw new Error(data?.error || "تعذر إنشاء رابط الدفع");
    window.location.href = data.url;
  };

  const handleSubmit = async () => {
    if (!user || !profile || paying) return;
    setFormErr("");
    const name = fullName.trim();
    if (name.length < 2) return setFormErr("اكتب اسمك الكامل الأول 🙏");
    if (name.length > 80) return setFormErr("الاسم طويل جدًا");
    const hasBusy = DAYS.some((d) => (busy[d] || "").trim());
    const hasFree = DAYS.some((d) => (free[d] || "").trim());
    if (!hasBusy && !hasFree) return setFormErr("اكتب ولو يوم واحد: مشغولياتك أو أوقات فراغك 🗓️");
    const hours = Number(dailyHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 16) return setFormErr("ساعات المذاكرة اليومية لازم تكون بين ٠٫٥ و ١٦");

    setPaying(true);
    try {
      // Shape MUST match firestore.rules whitelist for scheduleRequests.create
      const intake: Record<string, any> = {
        fullName: name,
        grade: profile.grade || null,
        track: profile.track || null,
        dailyHoursTarget: hours,
        prioritySubjects,
        upcomingExams: upcomingExams.trim() || null,
        pomodoroPreferred: pomodoro,
        notes: notes.trim() || null,
        weekly: DAYS.map((day) => ({
          day,
          busy: (busy[day] || "").trim() || null,
          free: (free[day] || "").trim() || null
        })).filter((d) => d.busy || d.free)
      };
      const docRef = await addDoc(collection(db, "scheduleRequests"), {
        studentId: user.uid,
        studentEmail: profile.email || user.email || "",
        studentUuid: profile.uuid || "",
        intake,
        status: "awaiting_payment",
        paid: false,
        createdAt: new Date().toISOString()
      });
      await startCheckout(docRef.id);
    } catch (e: any) {
      console.error("planner submit failed", e);
      setFormErr(
        e?.code === "permission-denied"
          ? "Firestore رفض حفظ الطلب (permission-denied) — تأكد إن rules الجديدة اتنشرت في الـ console"
          : e?.message || "حصل خطأ — جرب تاني"
      );
      setPaying(false);
    }
  };

  const handleResume = async (id: string) => {
    if (resumingId) return;
    setResumingId(id);
    try {
      await startCheckout(id);
    } catch (e: any) {
      setFormErr(e?.message || "حصل خطأ — جرب تاني");
      setResumingId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  const activePending = requests.some((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">
      <HamburgerMenu />
      <BottomNav />

      {/* Header */}
      <div className="bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 text-white p-6 pt-16 pb-8 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays /> جدولي
          </h1>
          <p className="text-white/85 text-sm mt-1">
            جدول مذاكرة مخصوص ليك بإيد خبراء — بـ {PLANNER_PRODUCT.priceEgp} ج.م مرة واحدة • الرد خلال 24 ساعة ⚡
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-5 -mt-2">
        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>

        {/* How it works */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Sparkles size={16} className="text-teal-500" /> بتشتغل إزاي؟</h3>
          <ol className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex gap-2"><span className="w-5 h-5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold flex items-center justify-center shrink-0">1</span> املى الفورم بمواعيدك ومشغولياتك وأولوياتك (دقيقتين بس)</li>
            <li className="flex gap-2"><span className="w-5 h-5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold flex items-center justify-center shrink-0">2</span> ادفع {PLANNER_PRODUCT.priceEgp} ج.م بأمان عبر فواترك</li>
            <li className="flex gap-2"><span className="w-5 h-5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold flex items-center justify-center shrink-0">3</span> فريقنا يبنيلك جدول مخصوص ويرسلهولك صورة هنا خلال 24 ساعة من الدفع</li>
          </ol>
        </div>

        {/* My requests */}
        {requests.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><Clock size={16} className="text-teal-500" /> طلباتي</h3>
            {requests.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.awaiting_payment;
              const hs = r.status === "pending" ? hoursSince(r?.payment?.paidAt) : 0;
              return (
                <div key={r.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{r?.intake?.fullName || "طلب جدول"}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long" }) : ""}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>
                  </div>

                  {r.status === "pending" && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-2.5 rounded-xl leading-relaxed">
                      ⏳ الدفع اتأكد وفريقنا شغال على جدولك — <b>هيتم الرد خلال 24 ساعة</b> من الدفع
                      {hs > 0 && <> (عدّى {hs} ساعة{hs >= 24 ? " — لو عدّى أكتر من يوم كلم الدعم 🙏" : ""})</>}
                    </p>
                  )}

                  {r.status === "awaiting_payment" && (
                    <button
                      onClick={() => handleResume(r.id)}
                      disabled={resumingId === r.id}
                      className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                    >
                      {resumingId === r.id ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      أكمل الدفع — {PLANNER_PRODUCT.priceEgp} ج.م
                    </button>
                  )}

                  {r.status === "fulfilled" && r?.fulfillment?.imagePath && (
                    <>
                      <p className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-2.5 rounded-xl flex items-center gap-1.5">
                        <PartyPopper size={14} /> جدولك وصل! اتسلّم {r?.fulfillment?.sentAt ? new Date(r.fulfillment.sentAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long" }) : ""}
                      </p>
                      <FulfilledImage path={r.fulfillment.imagePath} note={r?.fulfillment?.note} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {reqErr && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{reqErr}</p>}

        {/* New request CTA / form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
          >
            <CalendarDays size={20} /> اطلب جدولك المخصوص — {PLANNER_PRODUCT.priceEgp} ج.م
          </button>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-[24px] p-5 border-2 border-teal-400 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><CalendarDays size={18} className="text-teal-500" /> فورم طلب جدول جديد</h3>

            <div>
              <label className="text-xs font-bold text-gray-500">اسمك الكامل *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={80}
                placeholder="مثال: أحمد محمد علي"
                className="mt-1 w-full p-3 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none focus:border-teal-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">السنة/الشعبة هتتسجل تلقائيًا من حسابك: {profile?.grade || "—"} {profile?.track ? `• ${profile.track}` : ""}</p>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">جدول أسبوعك — اكتب في كل يوم: مشغولياتك الثابتة (مدرسة/دروس) وأوقات فراغك اللي تحب تذاكر فيها *</p>
              <div className="space-y-2">
                {DAYS.map((day) => (
                  <details key={day} className="border dark:border-gray-600 rounded-xl overflow-hidden" open={day === "السبت"}>
                    <summary className="cursor-pointer p-2.5 text-sm font-bold bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                      {day}
                      {((busy[day] || "") + (free[day] || "")).trim() && <Check size={14} className="text-teal-500" />}
                    </summary>
                    <div className="p-2.5 space-y-2">
                      <input
                        value={busy[day] || ""}
                        onChange={(e) => setBusy((p) => ({ ...p, [day]: e.target.value }))}
                        placeholder="مشغوليات: مثال — المدرسة 8ص-2م، درس فيزياء 4-6م"
                        className="w-full p-2.5 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs outline-none focus:border-teal-400"
                      />
                      <input
                        value={free[day] || ""}
                        onChange={(e) => setFree((p) => ({ ...p, [day]: e.target.value }))}
                        placeholder="أوقات فاضلة أفضّلها: مثال — 6-10 مساءً"
                        className="w-full p-2.5 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs outline-none focus:border-teal-400"
                      />
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Timer size={12} /> ساعات مذاكرة مستهدفة/يوم *</label>
                <input
                  type="number"
                  min={0.5}
                  max={16}
                  step={0.5}
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                  className="mt-1 w-full p-3 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none focus:border-teal-400"
                />
              </div>
              <label className="flex items-center gap-2 p-3 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 mt-5 cursor-pointer">
                <input type="checkbox" checked={pomodoro} onChange={(e) => setPomodoro(e.target.checked)} className="accent-teal-500 w-4 h-4" />
                <span className="text-xs font-bold">نظام بومودورو 🍅 (25 تركيز + 5 راحة)</span>
              </label>
            </div>

            {gradeSubjects.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">المواد اللي محتاجة أولوية (اختار اللي ينطبق):</p>
                <div className="flex flex-wrap gap-2">
                  {gradeSubjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                        prioritySubjects.includes(s)
                          ? "bg-teal-500 border-teal-500 text-white"
                          : "bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500">امتحانات/تسليمات قريبة؟ (اختياري)</label>
              <input
                value={upcomingExams}
                onChange={(e) => setUpcomingExams(e.target.value)}
                placeholder="مثال: امتحان فيزياء يوم الخميس الجاي"
                className="mt-1 w-full p-3 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none focus:border-teal-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500">ملاحظات حرة (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="أي حاجة تانية تحب نعرفها عشان الجدول يطلع مظبوط ليك..."
                className="mt-1 w-full p-3 rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none focus:border-teal-400 resize-none"
              />
            </div>

            {formErr && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {formErr}</p>}

            <button
              onClick={handleSubmit}
              disabled={paying || activePending}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
              title={activePending ? "عندك طلب قيد التنفيذ حاليًا — استنى تسليمه الأول" : ""}
            >
              {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              {paying ? "بنجهز لينك الدفع..." : `احفظ وادفع — ${PLANNER_PRODUCT.priceEgp} ج.م`}
            </button>
            {activePending && (
              <p className="text-[11px] text-center text-amber-600">عندك طلب قيد التنفيذ دلوقتي — تقدر تطلب جدول جديد بعد تسليمه ✋</p>
            )}
            <button onClick={() => setShowForm(false)} className="w-full text-xs text-gray-400 flex items-center justify-center gap-1">
              <ChevronDown size={14} className="rotate-180" /> إخفاء الفورم
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <Sparkles size={14} /> الدفع آمن عبر فواترك • جدولك بيتعمل يدويًا بعناية لكل طالب
        </p>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  return (
    <ErrorBoundary label="صفحة جدولي">
      <PlannerPageInner />
    </ErrorBoundary>
  );
}
