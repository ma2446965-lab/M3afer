"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Shield, BookOpen, CalendarDays, GraduationCap, Loader2, AlertTriangle, RefreshCw, NotebookPen, Clapperboard } from "lucide-react";
import SubjectsManager from "@/components/admin/SubjectsManager";
import SlotsManager from "@/components/admin/SlotsManager";
import StudentsManager from "@/components/admin/StudentsManager";
import PlannerRequestsManager from "@/components/admin/PlannerRequestsManager";
import LecturesManager from "@/components/admin/LecturesManager";
import ErrorBoundary from "@/components/ErrorBoundary";

type Tab = "subjects" | "slots" | "students" | "planner" | "lectures";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "subjects", label: "المواد", icon: BookOpen },
  { id: "slots", label: "المواعيد المتاحة", icon: CalendarDays },
  { id: "students", label: "الطلاب", icon: GraduationCap },
  { id: "planner", label: "طلبات جدولي 📅", icon: NotebookPen },
  { id: "lectures", label: "المحاضرات 🎬", icon: Clapperboard }
];

function FullScreenState({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center bg-[#f8fafc] dark:bg-gray-900">
      {children}
    </div>
  );
}

function AdminPageInner() {
  const { profile, user, loading, profileError, refreshProfile } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("subjects");
  const [retrying, setRetrying] = useState(false);

  // Route protection:
  //  - not signed in                 → /auth/login
  //  - signed in, KNOWN non-admin    → home (/)
  //  - signed in, profile FAILED to load → do NOT redirect; show the error
  //    state below (old behavior silently treated a failed profile read as
  //    "not admin" and bounced real admins to home — or spun forever).
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (profile && profile.role !== "admin") router.replace("/");
  }, [loading, user, profile, router]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  // ------- Explicit UI for every state: no blank page, no silent spin -------
  if (loading) {
    return (
      <FullScreenState>
        <div>
          <Loader2 className="animate-spin mx-auto text-indigo-500" size={32} />
          <p className="mt-3 text-gray-500 dark:text-gray-400">جاري التحقق من تسجيل الدخول...</p>
        </div>
      </FullScreenState>
    );
  }

  if (!user) {
    // Redirect to /auth/login is in flight (see effect above)
    return (
      <FullScreenState>
        <p className="text-gray-500 dark:text-gray-400">مش مسجل دخول — جاري تحويلك لصفحة تسجيل الدخول...</p>
      </FullScreenState>
    );
  }

  if (profileError) {
    return (
      <FullScreenState>
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-6 text-right">
          <AlertTriangle className="mx-auto text-amber-500" size={36} />
          <h1 className="font-bold text-lg mt-3 text-center">مش قادرين نتحقق من صلاحياتك ⚠️</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            صفحة الأدمن بتحتاج تقرا مستندك <code className="font-mono" dir="ltr">users/{user.uid}</code> من
            Firestore — والقراءة فشلت بدل ما ترميك للرئيسية فجأة زي زمان 🙂
          </p>
          <p className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl p-3 mt-4 font-mono text-left" dir="ltr">
            {profileError}
          </p>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 space-y-1.5 leading-relaxed">
            <p className="font-bold text-gray-600 dark:text-gray-300">راجع النقاط دي بالترتيب:</p>
            <p>١. قواعد <code>firestore.rules</code> مرفوعة على نفس المشروع (Firebase Console → Firestore → Rules → Publish)</p>
            <p>٢. المستند <code className="font-mono" dir="ltr">users/{user.uid}</code> موجود وفيه <code className="font-mono" dir="ltr">role: &quot;admin&quot;</code></p>
            <p>٣. متغيرات <code className="font-mono" dir="ltr">NEXT_PUBLIC_FIREBASE_*</code> متظبطة على الاستضافة (مش بس محليًا)</p>
          </div>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {retrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            إعادة المحاولة
          </button>
        </div>
      </FullScreenState>
    );
  }

  if (!profile) {
    // Logged in, no error recorded, but profile not set yet — rare in-between
    // state (e.g. profile creation in progress). Offer a manual escape hatch
    // instead of the old infinite spinner.
    return (
      <FullScreenState>
        <div>
          <Loader2 className="animate-spin mx-auto text-indigo-500" size={32} />
          <p className="mt-3 text-gray-500 dark:text-gray-400">جاري تحميل ملفك الشخصي...</p>
          <button onClick={handleRetry} disabled={retrying} className="mt-3 text-sm text-indigo-600 underline disabled:opacity-50">
            {retrying ? "بنحاول..." : "لو اتعلقت هنا — دوس لإعادة المحاولة"}
          </button>
        </div>
      </FullScreenState>
    );
  }

  if (profile.role !== "admin") {
    // Redirect to / is in flight (see effect above) — explain instead of the
    // old `return null` blank flash.
    return (
      <FullScreenState>
        <p className="text-gray-500 dark:text-gray-400">الصفحة دي للأدمن بس 🔒 — جاري تحويلك للرئيسية...</p>
      </FullScreenState>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 p-4 pt-8 pb-16">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-[24px] p-6 text-white mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield /> لوحة الأدمن
          </h1>
          <p className="text-white/80 text-sm mt-1">
            إدارة المواد والمواعيد والطلاب • محمية بـ role === &quot;admin&quot; في Firestore + Security Rules
          </p>
          <p className="text-xs bg-white/20 inline-block px-2 py-1 rounded-full mt-3">
            أنت: {profile.email} • {profile.uuid ? profile.uuid.slice(0, 8) + "…" : "—"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${
                tab === id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                  : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {tab === "subjects" && <SubjectsManager />}
        {tab === "slots" && <SlotsManager />}
        {tab === "students" && <StudentsManager />}
        {tab === "planner" && <PlannerRequestsManager />}
        {tab === "lectures" && <LecturesManager />}

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            🔐 <b>ملاحظة أمان:</b> هذه الصفحة محمية على مستويين:
            <br />
            1. Client-side: تحويل تلقائي لأي مستخدم role بتاعه مش &quot;admin&quot; (مع رسائل واضحة بدل
            الصفحة الفاضية).
            <br />
            2. Server-side: ملف <code>firestore.rules</code> — subjects/slots متاحة للقراءة لأي مستخدم
            مسجل، والكتابة للأدمن فقط عدا <code>bookedCount</code> اللي بيتعدل +1/-1 جوه معاملة حجز
            مربوطة بمستند في <code>bookings</code>. ارفع القواعد من Firebase Console → Firestore →
            Rules.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ErrorBoundary label="لوحة الأدمن">
      <AdminPageInner />
    </ErrorBoundary>
  );
}
