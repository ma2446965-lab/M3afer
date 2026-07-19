"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import { db, storage } from "@/lib/firebase";
import { LECTURES_COL, PURCHASES_COL } from "@/lib/lectures";
import {
  computeCourseQuote,
  courseOwnership,
  sanitizeDiscountPct,
  sortCourses,
  COURSES_COL,
  DEFAULT_COURSE_DISCOUNT_PCT
} from "@/lib/courses";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import {
  Package,
  Loader2,
  Search,
  CheckCircle2,
  Gift,
  LogIn,
  GraduationCap,
  AlertTriangle
} from "lucide-react";

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (state === "success") {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-2xl text-sm font-bold">
        ✅ الدفع تم بنجاح! بنأكد العملية وبنفتح لك الكورس خلال ثواني — افتح صفحة الكورس من تحت.
      </div>
    );
  }
  if (state === "fail") {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3.5 rounded-2xl text-sm font-bold">
        ⚠️ الدفع ما تمش — مفيش فلوس اتخصمت. جرب تاني براحتك.
      </div>
    );
  }
  if (state === "pending") {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 p-3.5 rounded-2xl text-sm font-bold">
        ⏳ الدفع قيد المراجعة — هيتفعّل لوحده أول ما يتأكد.
      </div>
    );
  }
  return null;
}

function CourseThumb({ path, title }: { path?: string | null; title: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let on = true;
    if (path) getDownloadURL(ref(storage, path)).then((u) => on && setUrl(u)).catch(() => {});
    return () => { on = false; };
  }, [path]);
  if (!url) {
    return (
      <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white/90">
        <GraduationCap size={44} className="opacity-80" />
      </div>
    );
  }
  return <img src={url} alt={title} className="w-full h-36 object-cover rounded-2xl" />;
}

function CoursesPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState("");
  const [subject, setSubject] = useState("الكل");
  const [search, setSearch] = useState("");

  // Public catalog: guests browse courses (rules: courses & lectures read
  // = public). Only purchases listener needs a signed-in user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cSnap, lSnap] = await Promise.all([
          getDocs(collection(db, COURSES_COL)),
          getDocs(collection(db, LECTURES_COL))
        ]);
        if (cancelled) return;
        setCourses(sortCourses(cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((c) => c.published !== false)));
        setLectures(lSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setErr("");
      } catch {
        setErr("تعذر تحميل الكورسات — جرب تحديث الصفحة");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    if (!user) return () => { cancelled = true; };
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
    const names = courses.map((c) => c.subjectName).filter((n): n is string => !!n);
    return ["الكل", ...Array.from(new Set(names))];
  }, [courses]);

  const visible = useMemo(() => {
    const q = search.trim();
    return courses.filter((c) => {
      if (subject !== "الكل" && c.subjectName !== subject) return false;
      if (q && !`${c.title} ${c.teacherName || ""}`.includes(q)) return false;
      return true;
    });
  }, [courses, subject, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-8">
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white p-6 pt-6 pb-8 md:pt-10 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package /> الكورسات
          </h1>
          <p className="text-white/85 text-sm mt-1">مسارات كاملة محاضرة ورا محاضرة — وخدها كلها بخصم بدل ما تشتري واحدة واحدة 📦</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-5 -mt-2">
        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>

        {!user && (
          <div className="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
            <div className="p-2.5 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl text-white shrink-0">
              <LogIn size={20} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-bold text-sm">بتتفرج كضيف 👋 — اتفرج براحتك على الكورسات والأسعار</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">سجّل دخولك بس عشان تشتري كورس وتتابع تقدّمك فيه</p>
            </div>
            <Link
              href={`/auth/login?next=${encodeURIComponent("/courses")}`}
              className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:opacity-95 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
            >
              <LogIn size={16} /> دخول / حساب جديد
            </Link>
          </div>
        )}

        {/* filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap transition ${
                subject === s ? "bg-violet-600 text-white" : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-500"
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
            placeholder="دوّر على كورس أو مدرّس..."
            className="w-full p-3 pr-9 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-violet-400"
          />
        </div>

        {err && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl flex items-center gap-1.5">
            <AlertTriangle size={13} /> {err}
          </p>
        )}

        {/* cards */}
        {fetching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-[24px] p-4 space-y-3 border dark:border-gray-700 animate-pulse">
                <div className="w-full h-36 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-400 text-center p-10 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700">
            <Package className="mx-auto mb-2 opacity-50" />
            {courses.length === 0 ? "لسه مفيش كورسات منشورة — قريب جدًا 🔥" : "مفيش نتايج للبحث ده"}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((c) => {
              const own = courseOwnership(lectures, c.id, ownedIds);
              const pct = sanitizeDiscountPct(c.discountPct ?? DEFAULT_COURSE_DISCOUNT_PCT);
              const quote = computeCourseQuote(lectures, c.id, ownedIds, pct);
              return (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="bg-white dark:bg-gray-800 rounded-[24px] p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:-translate-y-0.5 transition-all space-y-3 group"
                >
                  <CourseThumb path={c.thumbnailPath} title={c.title} />
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm leading-snug group-hover:text-violet-600 transition-colors">{c.title}</h3>
                      {own.allOwned && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={10} /> عندك كامل
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                      {c.subjectName && <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-2 py-0.5 rounded-full">{c.subjectName}</span>}
                      {c.teacherName && <span>👨‍🏫 {c.teacherName}</span>}
                    </p>
                  </div>

                  {/* owned strip */}
                  {own.ownedCount > 0 && (
                    <p className="text-[11px] text-green-600 font-bold">
                      عندك {own.ownedCount} من {own.totalLectures} محاضرة ✅
                    </p>
                  )}

                  {/* price */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-700/60">
                    {own.allOwned ? (
                      <span className="text-xs font-bold text-green-600">الكورس ده بتاعك 🎉</span>
                    ) : quote ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-lg text-violet-600">{quote.totalEgp} ج.م</span>
                        {quote.savedEgp > 0 && (
                          <>
                            <span className="text-[11px] text-gray-400 line-through">{quote.grossEgp}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">وفّر {quote.savedEgp}ج</span>
                          </>
                        )}
                      </div>
                    ) : own.paidCount === 0 ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Gift size={12} /> كورس مجاني</span>
                    ) : (
                      <span className="text-xs font-bold text-gray-400">—</span>
                    )}
                    <span className="text-[11px] text-gray-400">{own.totalLectures} محاضرة</span>
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

export default function CoursesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
          <Loader2 className="animate-spin text-violet-500" size={32} />
        </div>
      }>
        <CoursesPageInner />
      </Suspense>
    </ErrorBoundary>
  );
}
