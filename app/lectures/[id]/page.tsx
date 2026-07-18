"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db, storage } from "@/lib/firebase";
import { LECTURE_PRODUCT } from "@/lib/plans";
import { isFreeLecture, parseYouTubeId, purchaseId, LECTURES_COL, PURCHASES_COL } from "@/lib/lectures";
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
  Gift
} from "lucide-react";

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (!state) return null;
  const map: Record<string, { text: string; cls: string }> = {
    success: { text: "✅ الدفع تم! جاري فتح المحاضرة تلقائيًا — ثوانٍ 🎉", cls: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100" },
    pending: { text: "⏳ استلمنا طلبك — أكمل الدفع وهتتفتح فور التأكيد.", cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100" },
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
  if (!url) return <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> بنحضّر الملاحظات...</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
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
  const [media, setMedia] = useState<any | null>(null);
  const [owned, setOwned] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "locked" | "missing">("loading");
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user || !lectureId) return;
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
    if (!user || paying) return;
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const ytId = parseYouTubeId(media?.videoUrl);
  const free = isFreeLecture(lecture);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">

      <div className="max-w-3xl mx-auto p-4 pt-6 md:pt-10 space-y-4">
        <Link href="/lectures" className="text-xs text-indigo-600 dark:text-indigo-400 font-bold inline-flex items-center gap-1">
          <ArrowRight size={14} /> رجوع للمحاضرات
        </Link>

        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>
        {confirming && phase !== "ready" && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 p-3 rounded-xl flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> جاري تأكيد الدفع وفتح المحاضرة تلقائيًا...
          </p>
        )}

        {phase === "loading" && (
          <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        )}

        {phase === "missing" && (
          <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 text-gray-400">
            <AlertTriangle size={36} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold">{err || "المحاضرة دي مش موجودة أو اتشالت"}</p>
          </div>
        )}

        {(phase === "ready" || phase === "locked" || phase === "missing") && lecture && (
          <>
            <div>
              <h1 className="font-bold text-xl leading-snug">{lecture.title}</h1>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-3 flex-wrap">
                {lecture.teacherName && <span>👨‍🏫 {lecture.teacherName}</span>}
                {!!lecture.durationMin && <span className="flex items-center gap-1"><Clock3 size={12} /> {lecture.durationMin} دقيقة</span>}
                {lecture.subjectName && <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{lecture.subjectName}</span>}
                {owned && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><BadgeCheck size={11} /> عندك ✅</span>}
                {free && lecture?.isFreePreview && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Gift size={11} /> معاينة مجانية</span>}
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
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">رابط الفيديو غير صالح — الإدارة اتبلغت، جرب كمان شوية 🙏</p>
                )}
                {!!media?.notesPdfPath && <PdfLink path={media.notesPdfPath} />}
              </>
            )}

            {phase === "locked" && (
              <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 border-2 border-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.12)] text-center space-y-4">
                <div className="w-14 h-14 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Lock size={26} />
                </div>
                <div>
                  <p className="font-bold text-lg">المحاضرة دي مدفوعة 🔒</p>
                  <p className="text-xs text-gray-400 mt-1">اشتريها مرة واحدة وتفضل معاك للأبد — وشوف الملاحظات PDF كمان</p>
                </div>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{lecture.priceEgp}</span>
                  <span className="text-gray-500 font-bold">ج.م</span>
                </div>
                {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{err}</p>}
                <button
                  onClick={buy}
                  disabled={paying}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                  {paying ? "بنجهز لينك الدفع..." : `افتح المحاضرة — ${lecture.priceEgp} ج.م`}
                </button>
                <Link href="/lectures" className="block text-xs text-indigo-500 font-bold">
                  أو وفر مع باقة المادة كاملة (خصم 20%) ←
                </Link>
                <p className="text-[11px] text-gray-400">دفع آمن عبر فواترك — فيزا/فوري/محافظ 💳</p>
              </div>
            )}

            {!!lecture.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800 rounded-2xl p-4 border dark:border-gray-700">
                {lecture.description}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={load} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
                <RefreshCw size={12} /> تحديث
              </button>
              <span className="text-[11px] text-gray-300 dark:text-gray-600 flex items-center gap-1"><Clapperboard size={11} /> محتوى محمي — يظهر فقط لمن اشتراه</span>
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
