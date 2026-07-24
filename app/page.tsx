"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSubjectsForGradeTrack } from "@/lib/subjects";
import OnboardingFlow from "@/components/OnboardingFlow";
import { Flame, BookOpen, Brain, Target, Clock, Upload, Sparkles, TrendingUp, CalendarPlus, Star, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

/* ─── Student Reviews Data ─── */
const REVIEWS = [
  { name: "أحمد محمد", grade: "تالتة ثانوي علمي علوم", rating: 5, text: "المنصة دي خلتني ألم المنهج في أسبوعين! الملخصات بالظبط زي المراجعة النهائية." },
  { name: "ياسمين حسن", grade: "تالتة ثانوي أدبي", rating: 5, text: "الكويزات شبيهة الامتحان بالظبط، حسيت بفرق كبير في درجاتي بعد ما استخدمتها." },
  { name: "عمر خالد", grade: "تانية ثانوي علمي رياضة", rating: 4, text: "المساعد الذكي بيفهمني أي مسألة خطوة بخطوة، أحسن من أي درس خصوصي." },
  { name: "مريم سامي", grade: "تالتة ثانوي علمي علوم", rating: 5, text: "حصص اللايف والجدول المنظم وفروا عليا وقت كتير. أنصح أي حد يجرب." },
  { name: "كريم أشرف", grade: "أولى ثانوي", rating: 4, text: "من أول أسبوع حسيت إني فاهم أكتر. الفلاش كاردز بتاعتهما ممتازة للمراجعة." },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex shrink-0 gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className={i <= rating ? "fill-accent-400 text-accent-400" : "text-slate-300 dark:text-navy-700"} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/auth/login");
      } else if (profile && !profile.grade) {
        setShowOnboarding(true);
      }
    }
  }, [user, profile, loading, router]);

  // Auto-advance reviews carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setReviewIdx((prev) => (prev + 1) % REVIEWS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
          <p className="mt-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">بيحمل... ثانية واحدة</p>
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
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-brand-gradient text-white p-5 pt-5 pb-6 md:pt-8 rounded-b-[28px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-y-20 -translate-x-20" />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/70 text-xs">{today}</p>
              <h1 className="text-xl font-bold mt-1">أهلاً يا بطل!</h1>
              <p className="text-white/90 text-xs mt-1">{profile.grade} • {profile.track || "عام"} • streak {profile.streak} يوم</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-2">
              <Flame className="text-accent-300" size={18} />
              <div>
                <p className="font-bold text-base leading-none">{profile.streak}</p>
                <p className="text-[10px] text-white/80">يوم متتالي</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 backdrop-blur rounded-xl p-2.5">
              <BookOpen size={16} className="text-white/80 mb-1" />
              <p className="font-bold text-lg">12</p>
              <p className="text-[10px] text-white/70">ملف مرفوع</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-2.5">
              <Brain size={16} className="text-white/80 mb-1" />
              <p className="font-bold text-lg">48</p>
              <p className="text-[10px] text-white/70">كويز محلول</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-2.5">
              <Target size={16} className="text-white/80 mb-1" />
              <p className="font-bold text-lg">85%</p>
              <p className="text-[10px] text-white/70">متوسط الدرجات</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-3 space-y-4 -mt-2">
        {/* Weekly Plan */}
        <div className="bg-white dark:bg-navy-800 rounded-2xl p-4 border border-slate-100 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                <Clock size={14} className="text-brand-600 dark:text-brand-400" />
              </div>
              خطة الأسبوع ده
            </h2>
            <button className="text-xs text-brand-600 dark:text-brand-400 font-medium">تعديل</button>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {subjects.slice(0, 5).map((subj) => (
              <div key={subj.id} className="min-w-[100px] bg-slate-50 dark:bg-navy-700/50 rounded-xl p-2.5 border border-slate-100 dark:border-navy-700">
                <div className="text-lg mb-1">{subj.icon}</div>
                <p className="font-medium text-xs truncate">{subj.nameAr}</p>
                <div className="mt-1.5 h-1.5 bg-slate-200 dark:bg-navy-600 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.floor(Math.random()*60)+20}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">3/5 دروس</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upload CTA */}
        <Link href="/library" className="block bg-brand-gradient rounded-2xl p-4 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Upload size={18} />
                ارفع ملزمة جديدة
              </h3>
              <p className="text-white/80 text-xs mt-1">هحولها لملخص + كويز + فلاش كاردز بأسلوب الوزارة</p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">PDF</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full">مراجعة نهائية</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full">بنك أسئلة</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Sparkles size={18} />
            </div>
          </div>
        </Link>

        {/* Booking CTA */}
        <Link href="/booking" className="block bg-gradient-to-br from-brand-600 to-navy-700 rounded-2xl p-4 text-white relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl translate-y-10 -translate-x-10 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <CalendarPlus size={18} />
                احجز حصة لايف
              </h3>
              <p className="text-white/80 text-xs mt-1">اختار المادة والميعاد اللي يناسبك — والتأكيد فوري</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Sparkles size={18} />
            </div>
          </div>
        </Link>

        {/* Subjects Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-base">موادك • {profile.track}</h2>
            <Link href="/library" className="text-xs text-slate-500">عرض الكل</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {subjects.map((subj) => (
              <div key={subj.id} className="bg-white dark:bg-navy-800 rounded-xl p-3 border border-slate-100 dark:border-navy-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div className="w-9 h-9 bg-slate-50 dark:bg-navy-700 rounded-lg flex items-center justify-center text-lg">{subj.icon}</div>
                  <span className="text-[10px] bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full">نشط</span>
                </div>
                <h3 className="font-bold text-xs">{subj.nameAr}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{subj.nameEn}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <TrendingUp size={11} />
                  <span>{Math.floor(Math.random()*20)+5} ملفات</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Reviews Carousel */}
        <div className="bg-white dark:bg-navy-800 rounded-2xl p-4 border border-slate-100 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 bg-accent-100 dark:bg-accent-900/30 rounded-lg flex items-center justify-center">
                <Star size={14} className="text-accent-500" fill="currentColor" />
              </div>
              آراء الطلاب
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => setReviewIdx((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 transition"
              >
                <ChevronRight size={14} className="text-slate-600 dark:text-slate-300" />
              </button>
              <button
                onClick={() => setReviewIdx((prev) => (prev + 1) % REVIEWS.length)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 transition"
              >
                <ChevronLeft size={14} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden" dir="ltr">
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${reviewIdx * 100}%)` }}>
              {REVIEWS.map((review, idx) => (
                <div key={idx} className="w-full shrink-0" dir="rtl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {review.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{review.name}</p>
                        <StarRating rating={review.rating} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{review.grade}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{review.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {REVIEWS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setReviewIdx(idx)}
                className={`w-2 h-2 rounded-full transition-all ${idx === reviewIdx ? "bg-brand-600 w-5" : "bg-slate-300 dark:bg-navy-600"}`}
              />
            ))}
          </div>
        </div>

        {/* Motivational */}
        <div className="bg-accent-50 dark:bg-accent-900/10 border border-accent-200 dark:border-accent-800 rounded-xl p-3 flex gap-2.5">
          <div className="w-8 h-8 bg-accent-200 dark:bg-accent-800 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-accent-600 dark:text-accent-300" />
          </div>
          <div>
            <p className="font-bold text-xs text-accent-800 dark:text-accent-200">نصيحة اليوم من دكتورة بسملة</p>
            <p className="text-[11px] text-accent-700/80 dark:text-accent-200/70 mt-1 leading-relaxed">
              الثانوية العامة مش سباق سرعة، ده ماراثون! ذاكر 25 دقيقة وركز، وبعدين خد بريك 5 دقايق. مخك زي العضلة، محتاج راحة عشان يثبت المعلومة. أنت قدها!
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
