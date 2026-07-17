"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSubjectsForGradeTrack } from "@/lib/subjects";
import BottomNav from "@/components/BottomNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import FloatingChat from "@/components/FloatingChat";
import OnboardingFlow from "@/components/OnboardingFlow";
import { Flame, BookOpen, Brain, Target, Clock, Upload, Sparkles, TrendingUp, CalendarPlus } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/auth/login");
      } else if (profile && !profile.grade) {
        setShowOnboarding(true);
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-gray-900 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 font-semibold text-gray-600 dark:text-gray-400">بيحمل... ثانية واحدة يا بطل ثانوية عامة ⚡</p>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

  if (!user || !profile) return null;

  const subjects = getSubjectsForGradeTrack(profile.grade as any, profile.track as any);
  const today = new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">
      <HamburgerMenu />
      <FloatingChat />
      <BottomNav />

      {/* Header */}
      <div className="bg-gradient-to-br from-sky-500 via-indigo-600 to-violet-600 text-white p-6 pt-16 pb-8 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-y-20 -translate-x-20" />
        
        <div className="relative max-w-5xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-white/70 text-sm">{today}</p>
              <h1 className="text-2xl font-bold mt-1">أهلاً يا بطل! 👋</h1>
              <p className="text-white/90 text-sm mt-1">{profile.grade} • {profile.track || "عام"} • streak {profile.streak} يوم</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
              <Flame className="text-orange-300" size={20} />
              <div>
                <p className="font-bold text-lg leading-none">{profile.streak}</p>
                <p className="text-[10px] text-white/80">يوم متتالي</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-3">
              <BookOpen size={18} className="text-white/80 mb-1" />
              <p className="font-bold text-xl">12</p>
              <p className="text-xs text-white/70">ملف مرفوع</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-3">
              <Brain size={18} className="text-white/80 mb-1" />
              <p className="font-bold text-xl">48</p>
              <p className="text-xs text-white/70">كويز محلول</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-3">
              <Target size={18} className="text-white/80 mb-1" />
              <p className="font-bold text-xl">85%</p>
              <p className="text-xs text-white/70">متوسط الدرجات</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6 -mt-2">
        {/* Weekly Plan */}
        <div className="bg-white dark:bg-gray-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              خطة الأسبوع ده
            </h2>
            <button className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">تعديل</button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {subjects.slice(0, 5).map((subj) => (
              <div key={subj.id} className="min-w-[110px] bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700">
                <div className="text-xl mb-1">{subj.icon}</div>
                <p className="font-medium text-sm truncate">{subj.nameAr}</p>
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.floor(Math.random()*60)+20}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">3/5 دروس</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upload CTA */}
        <Link href="/library" className="block bg-gradient-to-br from-violet-600 to-indigo-600 rounded-[24px] p-5 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Upload size={20} />
                ارفع ملزمة جديدة
              </h3>
              <p className="text-white/80 text-sm mt-1">هحولها لملخص + كويز + فلاش كاردز بأسلوب الوزارة</p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="bg-white/20 px-2.5 py-1 rounded-full">PDF</span>
                <span className="bg-white/20 px-2.5 py-1 rounded-full">مراجعة نهائية</span>
                <span className="bg-white/20 px-2.5 py-1 rounded-full">بنك أسئلة</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Sparkles size={20} />
            </div>
          </div>
        </Link>

        {/* Booking CTA */}
        <Link href="/booking" className="block bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[24px] p-5 text-white relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl translate-y-10 -translate-x-10 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CalendarPlus size={20} />
                احجز حصة لايف
              </h3>
              <p className="text-white/80 text-sm mt-1">اختار المادة والميعاد اللي يناسبك — والتأكيد فوري</p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="bg-white/20 px-2.5 py-1 rounded-full">مواعيد مرنة</span>
                <span className="bg-white/20 px-2.5 py-1 rounded-full">تأكيد فوري</span>
                <span className="bg-white/20 px-2.5 py-1 rounded-full">جدولك كله في مكان واحد</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Sparkles size={20} />
            </div>
          </div>
        </Link>

        {/* Subjects Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">موادك • {profile.track}</h2>
            <Link href="/library" className="text-xs text-gray-500">عرض الكل</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subjects.map((subj) => (
              <div key={subj.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center text-xl">{subj.icon}</div>
                  <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">نشط</span>
                </div>
                <h3 className="font-bold text-sm">{subj.nameAr}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{subj.nameEn}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <TrendingUp size={12} />
                  <span>{Math.floor(Math.random()*20)+5} ملفات</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Motivational */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-4 flex gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <p className="font-bold text-sm text-amber-900 dark:text-amber-200">نصيحة اليوم من دكتورة بسملة</p>
            <p className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1 leading-relaxed">
              الثانوية العامة مش سباق سرعة، ده ماراثون! ذاكر 25 دقيقة وركز، وبعدين خد بريك 5 دقايق. مخك زي العضلة، محتاج راحة عشان يثبت المعلومة. أنت قدها! 💙
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar nav */}
      <div className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 p-6 flex-col">
        <h1 className="font-black text-2xl bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">Meafer.ai</h1>
        <p className="text-xs text-gray-500 mt-1">Thanaweya Amma Platform</p>
        <nav className="mt-8 space-y-1">
          {[
            { href: "/", label: "الرئيسية", icon: "🏠" },
            { href: "/library", label: "المكتبة", icon: "📚" },
            { href: "/quizzes", label: "الكويزات", icon: "🧠" },
            { href: "/booking", label: "احجز حصة", icon: "📅" },
            { href: "/schedule", label: "جدولي", icon: "🗓️" },
            { href: "/profile", label: "حسابي", icon: "👤" },
            { href: "/subscription", label: "الاشتراك", icon: "💎" },
          ].map(item => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium">
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
