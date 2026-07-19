"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db, storage } from "@/lib/firebase";
import { isFreeLecture, LECTURES_COL, PURCHASES_COL } from "@/lib/lectures";
import { COURSE_PRODUCT } from "@/lib/plans";
import {
  computeCourseQuote,
  courseOwnership,
  sanitizeDiscountPct,
  sortCourseLectures,
  COURSES_COL,
  DEFAULT_COURSE_DISCOUNT_PCT
} from "@/lib/courses";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import {
  Package,
  Loader2,
  Clock3,
  Lock,
  BadgeCheck,
  Gift,
  AlertTriangle,
  CreditCard,
  LogIn,
  ChevronLeft,
  PlayCircle
} from "lucide-react";

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (state === "success")
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-2xl text-sm font-bold">
        ✅ الدفع تم بنجاح! بنفتح لك كل محاضرات الكورس — بنأكد تلقائيًا خلال ثواني...
      </div>
    );
  if (state === "fail")
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3.5 rounded-2xl text-sm font-bold">
        ⚠️ الدفع ما تمش — مفيش فلوس اتخصمت. جرب تاني براحتك.
      </div>
    );
  if (state === "pending")
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 p-3.5 rounded-2xl text-sm font-bold">
        ⏳ الدفع قيد المراجعة — هيتفعّل لوحده أول ما يتأكد.
      </div>
    );
  return null;
}

function CourseThumb({ path }: { path?: string | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let on = true;
    if (path) getDownloadURL(ref(storage, path)).then((u) => on && setUrl(u)).catch(() => {});
    return () => { on = false; };
  }, [path]);
  if (!url) {
    return (
      <div className="w-full h-40 rounded-[24px] bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white/90">
        <PlayCircle size={52} className="opacity-80" />
      </div>
    );
  }
  return <img src={url} alt="" className="w-full h-40 object-cover rounded-[24px]" />;
}

function CourseDetailInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = String(params?.id || "");

  const [course, setCourse] = useState<any | null>(null);
  const [lectures, setLectures] = useState<any[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"loading" | "ready" | "missing">("loading");
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!courseId) return;
    setPhase("loading");
    setErr("");
    try {
      const cSnap = await getDoc(doc(db, COURSES_COL, courseId));
      if (!cSnap.exists() || (cSnap.data() as any).published === false) {
        setPhase("missing");
        return;
      }
      setCourse({ id: cSnap.id, ...(cSnap.data() as any) });
      const lSnap = await getDocs(query(collection(db, LECTURES_COL), where("courseId", "==", courseId)));
      const list = lSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((l) => l.published !== false);
      setLectures(sortCourseLectures(list));
      if (user) {
        const oSnap = await getDocs(query(collection(db, PURCHASES_COL), where("studentId", "==", user.uid)));
        setOwnedIds(new Set(oSnap.docs.map((d) => (d.data() as any).lectureId)));
      } else {
        setOwnedIds(new Set());
      }
      setPhase("ready");
    } catch (e: any) {
      console.error("course load failed", e);
      setErr("تعذر التحميل — جرب تاني");
      setPhase("missing");
    }
  }, [courseId, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Post-payment auto-confirm: poll until grants fan out to all lectures.
  const params2 = useSearchParams();
  useEffect(() => {
    if (params2.get("payment") !== "success") return;
    setConfirming(true);
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      await load();
      if (tries >= 10) {
        setConfirming(false);
        clearInterval(t);
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = sanitizeDiscountPct(course?.discountPct ?? DEFAULT_COURSE_DISCOUNT_PCT);
  const quote = computeCourseQuote(lectures, courseId, ownedIds, pct);
  const own = courseOwnership(lectures, courseId, ownedIds);
  const totalMin = lectures.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);

  const buyCourse = async () => {
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
      return;
    }
    if (paying) return;
    setPaying(true);
    setErr("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/fatorak/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ product: COURSE_PRODUCT.kind, courseId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error || "تعذر إنشاء رابط الدفع");
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e?.message || "حصل خطأ — جرب تاني");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto p-4 pt-6 md:pt-10 space-y-4">
        <Link href="/courses" className="inline-flex items-center gap-1 text-xs text-violet-600 font-bold hover:underline">
          <ChevronLeft size={14} className="-scale-x-100" /> كل الكورسات
        </Link>

        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>
        {confirming && (
          <p className="text-xs text-violet-600 bg-violet-50 dark:bg-violet-900/20 p-3 rounded-xl flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> جاري تأكيد الدفع وفتح كل المحاضرات تلقائيًا...
          </p>
        )}

        {phase === "loading" && (
          <div className="space-y-3 animate-pulse">
            <div className="w-full h-40 bg-gray-200 dark:bg-gray-800 rounded-[24px]" />
            <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
          </div>
        )}

        {phase === "missing" && (
          <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 text-gray-400">
            <AlertTriangle size={36} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold">{err || "الكورس ده مش موجود أو مش منشور"}</p>
          </div>
        )}

        {phase === "ready" && course && (
          <>
            <CourseThumb path={course.thumbnailPath} />

            <div>
              <h1 className="font-bold text-xl leading-snug">{course.title}</h1>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-3 flex-wrap">
                {course.subjectName && <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-2 py-0.5 rounded-full">{course.subjectName}</span>}
                {course.teacherName && <span>👨‍🏫 {course.teacherName}</span>}
                <span className="flex items-center gap-1"><Clock3 size={12} /> {own.totalLectures} محاضرة{totalMin > 0 ? ` • ${totalMin} دقيقة` : ""}</span>
                {own.ownedCount > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><BadgeCheck size={11} /> عندك {own.ownedCount} من {own.totalLectures}</span>}
              </p>
              {!!course.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-3 bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700">
                  {course.description}
                </p>
              )}
            </div>

            {/* ownership progress */}
            {own.totalLectures > 0 && own.ownedCount > 0 && !own.allOwned && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700 space-y-2">
                <p className="text-xs font-bold text-gray-500">تقدّم ملكيتك في الكورس: {own.ownedCount}/{own.totalLectures}</p>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all" style={{ width: `${Math.round((own.ownedCount / own.totalLectures) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* buy-course CTA */}
            {!own.allOwned && quote && (
              <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 border-2 border-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.12)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-bold">خد الكورس كامل بخصم {Math.round(pct * 100)}% 📦</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {quote.count} محاضرة {own.ownedCount > 0 ? "متبقية عليك" : "مدفوعة"} — بدل ما تشتري كل واحدة لوحدها بـ {quote.grossEgp} ج.م
                    </p>
                  </div>
                  <div className="text-left">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">{quote.totalEgp}</span>
                      <span className="text-gray-500 font-bold text-sm">ج.م</span>
                    </div>
                    {quote.savedEgp > 0 && <p className="text-[11px] text-amber-600 font-bold">بتوفّر {quote.savedEgp} ج.م 🔥</p>}
                  </div>
                </div>
                {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{err}</p>}
                {!user ? (
                  <Link
                    href={`/auth/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    <LogIn size={18} /> سجّل دخولك عشان تشتري الكورس
                  </Link>
                ) : (
                  <button
                    onClick={buyCourse}
                    disabled={paying}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                    {paying ? "بنجهز لينك الدفع..." : `افتح الكورس كامل — ${quote.totalEgp} ج.م`}
                  </button>
                )}
                <p className="text-[11px] text-gray-400 text-center">دفع آمن عبر فواترك — فيزا/فوري/محافظ 💳 • الشراء بينفعّل كل المحاضرات فورًا</p>
              </div>
            )}
            {own.allOwned && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
                <p className="font-bold text-green-700 dark:text-green-300">الكورس ده بتاعك كامل 🎉 — برافو عليك!</p>
              </div>
            )}

            {/* lectures list */}
            <div className="space-y-2">
              <h2 className="font-bold text-sm text-gray-500">محتوى الكورس ({own.totalLectures} محاضرة)</h2>
              {lectures.map((l, i) => {
                const owned = ownedIds.has(l.id);
                const free = isFreeLecture(l);
                return (
                  <Link
                    key={l.id}
                    href={`/lectures/${l.id}`}
                    className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl p-3.5 border dark:border-gray-700 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      owned ? "bg-green-100 text-green-700" : free ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300"
                    }`}>
                      {owned ? <BadgeCheck size={18} /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate group-hover:text-violet-600 transition-colors">{l.title}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                        {!!l.durationMin && <span className="flex items-center gap-0.5"><Clock3 size={10} /> {l.durationMin} د</span>}
                        {owned && <span className="text-green-600 font-bold">عندك ✅</span>}
                        {!owned && free && <span className="text-emerald-600 font-bold flex items-center gap-0.5"><Gift size={10} /> معاينة مجانية</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-left">
                      {owned ? (
                        <span className="text-[11px] text-green-600 font-bold">شوفها ▶</span>
                      ) : free ? (
                        <span className="text-[11px] text-emerald-600 font-bold">شوفها ببلاش ▶</span>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1"><Lock size={11} /> {l.priceEgp} ج.م</span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {lectures.length === 0 && (
                <p className="text-xs text-gray-400 text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700">
                  الكورس ده لسه مفيهوش محاضرات منشورة — ارجع له كمان شوية.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
          <Loader2 className="animate-spin text-violet-500" size={32} />
        </div>
      }>
        <CourseDetailInner />
      </Suspense>
    </ErrorBoundary>
  );
}
