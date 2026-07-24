"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db, storage } from "@/lib/firebase";
import { LECTURE_PRODUCT } from "@/lib/plans";
import { isFreeLecture, parseYouTubeId, purchaseId, LECTURES_COL, PURCHASES_COL } from "@/lib/lectures";
import { COURSES_COL } from "@/lib/courses";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import {
  Clapperboard,
  Loader2,
  Lock,
  Clock3,
  FileText,
  RefreshCw,
  CreditCard,
  AlertTriangle,
  BadgeCheck,
  ArrowRight,
  Gift,
  LogIn,
  Package
} from "lucide-react";

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (!state) return null;
  const map: Record<string, { text: string; cls: string }> = {
    success: { text: "✅ الدفع تم! جاري فتح المحاضرة تلقائيًا — ثوانٍ 🎉", cls: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100" },
    pending: { text: "⏳ استلمنا طلبك — أكمل الدفع وهتتفتح فور التأكيد.", cls: "bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 border-accent-100" },
    failed: { text: "❌ الدفع ما تمش — جرب تاني.", cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100" }
  };
  const item = map[state];
  if (!item) return null;
  return <p className={`text-sm p-3 rounded-xl border leading-relaxed ${item.cls}`}>{item.text}</p>;
}

function PdfLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    getDownloadURL(ref(storage, path))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [path]);
  if (err) return null;
  if (!url) return <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> بنحضّر الملاحظات...</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
      <FileText size={16} /> ملاحظات المحاضرة (PDF)
    </a>
  );
}

function LectureWatchInner() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lectureId = String(params?.id || "");

  const [lecture, setLecture] = useState<any | null>(null);
  // Published parent course title for the cross-link chip (null = standalone).
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [media, setMedia] = useState<any | null>(null);
  const [owned, setOwned] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "locked" | "missing">("loading");
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Guests can open the page (title/price/description are public) — the
  // private-media read below is what actually gates watching/purchasing.
  const load = useCallback(async () => {
    if (!lectureId) return;
    setPhase("loading");
    setErr("");
    try {
      const lecSnap = await getDoc(doc(db, LECTURES_COL, lectureId));
      if (!lecSnap.exists()) {
        setPhase("missing");
        return;
      }
      const lec = { id: lecSnap.id, ...(lecSnap.data() as any) };
      setLecture(lec);
      // Cross-link: if the lecture belongs to a published course, resolve the
      // course title for the "📦 جزء من كورس" chip (public read, non-fatal).
      if (lec.courseId) {
        try {
          const cSnap = await getDoc(doc(db, COURSES_COL, lec.courseId));
          setCourseTitle(cSnap.exists() && cSnap.data().published !== false ? String(cSnap.data().title || "") : null);
        } catch {
          setCourseTitle(null);
        }
      } else {
        setCourseTitle(null);
      }
      if (!user) {
        // Signed-out: skip the media probe entirely → locked card with a
        // "sign in to buy/watch" CTA.
        setOwned(false);
        setMedia(null);
        setPhase("locked");
        return;
      }
      // Purchase doc (for the ✅ badge) — access itself is decided by the
      // private-media read below (rules: owner/admin/free only).
      try {
        const ownSnap = await getDoc(doc(db, PURCHASES_COL, purchaseId(lectureId, user.uid)));
        setOwned(ownSnap.exists());
      } catch {
        setOwned(false);
      }
      try {
        const mediaSnap = await getDoc(doc(db, LECTURES_COL, lectureId, "private", "media"));
        if (mediaSnap.exists()) {
          setMedia(mediaSnap.data());
          setPhase("ready");
          return;
        }
      } catch {
        // permission-denied → locked
      }
      setMedia(null);
      setPhase("locked");
    } catch (e: any) {
      console.error("lecture load failed", e);
      setErr("تعذر التحميل — جرب تاني");
      setPhase("missing");
    }
  }, [user, lectureId]);

  useEffect(() => {
    load();
  }, [load]);

  // Post-payment auto-confirm: poll until the webhook flips the purchase.
  const params2 = useSearchParams();
  useEffect(() => {
    if (params2.get("payment") !== "success") return;
    setConfirming(true);
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      await load();
      if (phase === "ready" || tries >= 10) {
        setConfirming(false);
        clearInterval(t);
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async () => {
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(`/lectures/${lectureId}`)}`);
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
        body: JSON.stringify({ product: LECTURE_PRODUCT.kind, lectureId })
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-900">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  const ytId = parseYouTubeId(media?.videoUrl);
  const free = isFreeLecture(lecture);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 pb-24 md:pb-0">

      <div className="max-w-3xl mx-auto p-4 pt-6 md:pt-10 space-y-4">
        <Link href="/lectures" className="text-xs text-brand-600 dark:text-brand-400 font-bold inline-flex items-center gap-1">
          <ArrowRight size={14} /> رجوع للمحاضرات
        </Link>

        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>
        {confirming && phase !== "ready" && (
          <p className="text-xs text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-900/20 border border-accent-100 p-3 rounded-xl flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> جاري تأكيد الدفع وفتح المحاضرة تلقائيًا...
          </p>
        )}

        {phase === "loading" && (
          <div className="aspect-video bg-slate-200 dark:bg-navy-800 rounded-2xl animate-pulse" />
        )}

        {phase === "missing" && (
          <div className="text-center p-12 bg-white dark:bg-navy-800 rounded-2xl border dark:border-navy-700 text-slate-400">
            <AlertTriangle size={36} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold">{err || "المحاضرة دي مش موجودة أو اتشالت"}</p>
          </div>
        )}

        {(phase === "ready" || phase === "locked" || phase === "missing") && lecture && (
          <>
            <div>
              <h1 className="font-bold text-xl leading-snug">{lecture.title}</h1>
              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-3 flex-wrap">
                {lecture.teacherName && <span>👨‍🏫 {lecture.teacherName}</span>}
                {!!lecture.durationMin && <span className="flex items-center gap-1"><Clock3 size={12} /> {lecture.durationMin} دقيقة</span>}
                {lecture.subjectName && <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full">{lecture.subjectName}</span>}
                {lecture.courseId && courseTitle && (
                  <Link
                    href={`/courses/${lecture.courseId}`}
                    className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold hover:bg-brand-100 dark:hover:bg-brand-900/50 transition"
                  >
                    <Package size={11} /> من كورس: {courseTitle} — شوف الكورس كامل بخصم ←
                  </Link>
                )}
                {owned && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><BadgeCheck size={11} /> عندك ✅</span>}
                {free && lecture?.isFreePreview && <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Gift size={11} /> معاينة مجانية</span>}
              </p>
            </div>

            {phase === "ready" && (
              <>
                {ytId ? (
                  <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`}
                      title={lecture.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <p className="text-xs text-accent-600 bg-accent-50 dark:bg-accent-900/20 p-3 rounded-xl">رابط الفيديو غير صالح — الإدارة اتبلغت، جرب كمان شوية 🙏</p>
                )}
                {!!media?.notesPdfPath && <PdfLink path={media.notesPdfPath} />}
              </>
            )}

            {phase === "locked" && (
              <div className="bg-white dark:bg-navy-800 rounded-[24px] p-6 border-2 border-brand-500 shadow-[0_0_0_4px_rgba(99,102,241,0.12)] text-center space-y-4">
                <div className="w-14 h-14 mx-auto bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center text-brand-600">
                  <Lock size={26} />
                </div>
                <div>
                  <p className="font-bold text-lg">
                    {!user && free ? "معاينة مجانية — سجّل وشوفها 🎁" : "المحاضرة دي مدفوعة 🔒"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {free
                      ? "المعاينة دي مجانية تمامًا — محتاجة بس حساب عشان تشغّلها"
                      : "اشتريها مرة واحدة وتفضل معاك للأبد — وشوف الملاحظات PDF كمان"}
                  </p>
                </div>
                <div className="flex items-baseline justify-center gap-2">
                  {free ? (
                    <span className="text-4xl font-black bg-gradient-to-r from-brand-600 to-navy-700 bg-clip-text text-transparent">مجانًا</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black bg-gradient-to-r from-brand-600 to-navy-700 bg-clip-text text-transparent">{lecture.priceEgp}</span>
                      <span className="text-slate-500 font-bold">ج.م</span>
                    </>
                  )}
                </div>
                {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{err}</p>}
                {!user ? (
                  <Link
                    href={`/auth/login?next=${encodeURIComponent(`/lectures/${lectureId}`)}`}
                    className="w-full bg-gradient-to-r from-brand-700 to-brand-500 hover:opacity-95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    <LogIn size={18} />
                    سجّل دخولك عشان {free ? "تشوف المعاينة" : "تشتري المحاضرة"}
                  </Link>
                ) : (
                  <button
                    onClick={buy}
                    disabled={paying}
                    className="w-full bg-gradient-to-r from-brand-600 to-navy-700 hover:opacity-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                    {paying ? "بنجهز لينك الدفع..." : `افتح المحاضرة — ${lecture.priceEgp} ج.م`}
                  </button>
                )}
                <Link href="/lectures" className="block text-xs text-brand-500 font-bold">
                  أو وفر مع باقة المادة كاملة (خصم 20%) ←
                </Link>
                <p className="text-[11px] text-slate-400">دفع آمن عبر فواترك — فيزا/فوري/محافظ 💳</p>
              </div>
            )}

            {!!lecture.description && (
              <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-navy-800 rounded-2xl p-4 border dark:border-navy-700">
                {lecture.description}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={load} className="text-xs text-slate-400 flex items-center gap-1 hover:text-slate-600">
                <RefreshCw size={12} /> تحديث
              </button>
              <span className="text-[11px] text-gray-300 dark:text-slate-600 flex items-center gap-1"><Clapperboard size={11} /> محتوى محمي — يظهر فقط لمن اشتراه</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LectureWatchPage() {
  return (
    <ErrorBoundary label="صفحة المحاضرة">
      <LectureWatchInner />
    </ErrorBoundary>
  );
}
