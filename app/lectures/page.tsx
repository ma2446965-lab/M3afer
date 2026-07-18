"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db, storage } from "@/lib/firebase";
import { LECTURE_BUNDLE } from "@/lib/plans";
import {
  computeBundleQuote,
  isFreeLecture,
  LECTURES_COL,
  PURCHASES_COL
} from "@/lib/lectures";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import {
  Clapperboard,
  Loader2,
  Lock,
  Clock3,
  Search,
  BadgeCheck,
  Gift,
  Package,
  PlayCircle,
  AlertTriangle
} from "lucide-react";

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (!state) return null;
  const map: Record<string, { text: string; cls: string }> = {
    success: {
      text: "✅ الدفع تم! جاري تفعيل المحاضرات تلقائيًا — هتفتح خلال ثوانٍ 🎉",
      cls: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100"
    },
    pending: {
      text: "⏳ استلمنا طلبك — أكمل الدفع بالطريقة اللي اخترتها وهيتفعل تلقائيًا فور التأكيد.",
      cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100"
    },
    failed: {
      text: "❌ الدفع ما تمش — جرب تاني من صفحة المحاضرة.",
      cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100"
    }
  };
  const item = map[state];
  if (!item) return null;
  return <p className={`text-sm p-3 rounded-xl border leading-relaxed ${item.cls}`}>{item.text}</p>;
}

function Thumb({ path, title }: { path?: string | null; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) return;
    getDownloadURL(ref(storage, path))
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);
  if (url) {
    return <img src={url} alt={title} className="w-full h-36 object-cover" loading="lazy" />;
  }
  return (
    <div className="w-full h-36 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white/90">
      <PlayCircle size={44} className="opacity-80" />
    </div>
  );
}

function LecturesPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lectures, setLectures] = useState<any[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState("");
  const [subject, setSubject] = useState<string>("الكل");
  const [search, setSearch] = useState("");
  const [payingBundle, setPayingBundle] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, LECTURES_COL));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((l) => l.published !== false);
        list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
        setLectures(list);
        setErr("");
      } catch (e: any) {
        setErr("تعذر تحميل المحاضرات — تأكد إن firestore.rules الجديدة اتنشرت");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    const q = query(collection(db, PURCHASES_COL), where("studentId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => setOwnedIds(new Set(snap.docs.map((d) => (d.data() as any).lectureId))),
      () => {}
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const subjects = useMemo(() => {
    const names = lectures.map((l) => l.subjectName).filter((n): n is string => !!n);
    return ["الكل", ...Array.from(new Set(names))];
  }, [lectures]);

  const visible = useMemo(() => {
    const q = search.trim();
    return lectures.filter((l) => {
      if (subject !== "الكل" && l.subjectName !== subject) return false;
      if (q && !`${l.title} ${l.teacherName || ""}`.includes(q)) return false;
      return true;
    });
  }, [lectures, subject, search]);

  const selectedSubjectId = useMemo(
    () => (subject === "الكل" ? null : lectures.find((l) => l.subjectName === subject)?.subjectId || null),
    [subject, lectures]
  );
  const bundleQuote = useMemo(() => {
    if (!selectedSubjectId) return null;
    return computeBundleQuote(lectures, selectedSubjectId, ownedIds, LECTURE_BUNDLE.discountPct);
  }, [lectures, selectedSubjectId, ownedIds]);

  const buyBundle = async (subjectId: string) => {
    if (payingBundle) return;
    setPayingBundle(subjectId);
    try {
      const token = await user!.getIdToken();
      const res = await fetch("/api/fatorak/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ product: LECTURE_BUNDLE.kind, subjectId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error || "تعذر إنشاء رابط الدفع");
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e?.message || "حصل خطأ — جرب تاني");
      setPayingBundle(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">

      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-6 pt-6 pb-8 md:pt-10 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clapperboard /> المحاضرات
          </h1>
          <p className="text-white/85 text-sm mt-1">محاضرات مسجلة بجودة عالية — شوف مثال مجاني، واشتري اللي تحتاجه بس 🎬</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-5 -mt-2">
        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>

        {/* filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap transition ${
                subject === s ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="دوّر على محاضرة أو مدرّس..."
            className="w-full p-3 pr-9 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        {/* bundle CTA */}
        {bundleQuote && bundleQuote.count >= 2 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
            <div className="p-2.5 bg-amber-500 rounded-xl text-white shrink-0">
              <Package size={20} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="font-bold text-sm">باقة {subject} كاملة — {bundleQuote.count} محاضرة</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                بـ <b className="text-amber-600">{bundleQuote.totalEgp} ج.م</b> بدل {bundleQuote.grossEgp} ج.م — وفّر {bundleQuote.savedEgp} ج.م (خصم {Math.round(LECTURE_BUNDLE.discountPct * 100)}%)
              </p>
            </div>
            <button
              onClick={() => buyBundle(bundleQuote.subjectId)}
              disabled={payingBundle !== null}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
            >
              {payingBundle ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
              اشتري الباقة
            </button>
          </div>
        )}

        {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}

        {/* catalog */}
        {fetching ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border dark:border-gray-700 animate-pulse">
                <div className="h-36 bg-gray-200 dark:bg-gray-700" />
                <div className="p-4 space-y-2"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" /><div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 text-gray-400">
            <Clapperboard size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold">مفيش محاضرات هنا لسه</p>
            <p className="text-xs mt-1">جرب مادة تانية أو استنى جديدنا قريب 🎬</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((l) => {
              const owned = ownedIds.has(l.id);
              const free = isFreeLecture(l);
              return (
                <Link
                  key={l.id}
                  href={`/lectures/${l.id}`}
                  className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border-2 border-transparent hover:border-indigo-400 dark:hover:border-indigo-500 transition group"
                >
                  <div className="relative">
                    <Thumb path={l.thumbnailPath} title={l.title} />
                    {!owned && !free && (
                      <span className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Lock size={11} /> {l.priceEgp} ج.م
                      </span>
                    )}
                    {owned && (
                      <span className="absolute top-2 left-2 bg-green-600 text-white text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <BadgeCheck size={11} /> عندك ✅
                      </span>
                    )}
                    {free && l.isFreePreview && (
                      <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Gift size={11} /> معاينة مجانية
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2">{l.title}</p>
                    <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-2">
                      {l.teacherName && <span>👨‍🏫 {l.teacherName}</span>}
                      {!!l.durationMin && (
                        <span className="flex items-center gap-1"><Clock3 size={11} /> {l.durationMin} د</span>
                      )}
                    </p>
                    {!!l.subjectName && (
                      <span className="inline-block mt-2 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                        {l.subjectName}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LecturesPage() {
  return (
    <ErrorBoundary label="صفحة المحاضرات">
      <LecturesPageInner />
    </ErrorBoundary>
  );
}
