"use client";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  CreditCard,
  Check,
  Loader2,
  Crown,
  ShieldCheck,
  CalendarPlus,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  BadgePercent,
  Gem
} from "lucide-react";

const BASE_FEATURES = [
  "حجز حصص لايف بمواعيد مرنة 📅",
  "كل أدوات المذاكرة والملخصات والكويزات",
  "مساعدا الذكاء الاصطناعي (بشمهندس محمد ود. بسملة) 🤖",
  "فتح كل مميزات المنصة طول فترة الاشتراك"
];

// 150 ج.م × 12 شهر = 1800 → الخطة السنوية بـ 1500 توفّر 300 ج.م
const YEARLY_FEATURES = [
  ...BASE_FEATURES,
  "وفّر 300 ج.م مقارنة بالتجديد الشهري (1800 ← 1500) 💰",
  "متفكرش في التجديد طول السنة ✅"
];

const fmtEndDate = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(+d)) return "—";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
};

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (!state) return null;
  const map: Record<string, { text: string; cls: string }> = {
    success: {
      text: "✅ الدفع تم بنجاح! اشتراكك مفعّل — يلا نحجز أول حصة 🎉",
      cls: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30"
    },
    pending: {
      text: "⏳ استلمنا طلبك — أكمل الدفع بالطريقة اللي اخترتها (فوري/محفظة) وهيتفعل الاشتراك تلقائيًا أول ما الدفع يتأكد.",
      cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30"
    },
    failed: {
      text: "❌ الدفع ما تمش. جرب تاني أو استخدم وسيلة دفع مختلفة.",
      cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900/30"
    }
  };
  const item = map[state];
  if (!item) return null;
  return <p className={`text-sm p-3 rounded-xl border leading-relaxed ${item.cls}`}>{item.text}</p>;
}

function SubscriptionPageInner() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [payingPlan, setPayingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  const subscribed = profile?.subscribed === true;
  const endMs = profile?.subscriptionEndDate ? new Date(profile.subscriptionEndDate).getTime() : 0;
  const stillActive = subscribed && endMs > Date.now();

  const handleSubscribe = async (planId: PlanId) => {
    if (!user || payingPlan) return;
    setPayingPlan(planId);
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/fatorak/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "تعذر إنشاء رابط الدفع");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "حصل خطأ — جرب تاني");
      setPayingPlan(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  const monthly = PLANS.monthly;
  const yearly = PLANS.yearly;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white p-6 pt-6 pb-8 md:pt-10 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown /> الاشتراك
          </h1>
          <p className="text-white/85 text-sm mt-1">اختار اللي يناسبك — شهري أو سنوي • دفع آمن عبر فواترك</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-5 -mt-2">
        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>

        {/* Current status */}
        <div
          className={`rounded-2xl p-5 border-2 flex items-center gap-4 ${
            stillActive
              ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              stillActive ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-gray-100 dark:bg-gray-700 text-gray-400"
            }`}
          >
            {stillActive ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div className="flex-1">
            <p className="font-bold">
              {stillActive ? "اشتراكك فعّال ✅" : "أنت غير مشترك حاليًا"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {stillActive
                ? `ينتهي في ${fmtEndDate(profile?.subscriptionEndDate)} — لو جددت بأي خطة، مدتها بتتضاف على نفس تاريخ الانتهاء`
                : "اشترك عشان تفتح حجز الحصص وكل مميزات المنصة"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/70 dark:bg-gray-700 border dark:border-gray-600 text-gray-500 disabled:opacity-50"
            title="تحديث الحالة"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>
        )}

        {/* Plans grid */}
        <div className="grid md:grid-cols-2 gap-5 items-stretch">
          {/* Monthly — 150 EGP / 30 days */}
          <div className="relative bg-white dark:bg-gray-800 rounded-[24px] p-6 border-2 border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="absolute -top-3 right-4 bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">
              الأساسية
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl mb-4">
              💎
            </div>
            <h3 className="font-bold text-lg">{monthly.nameAr}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                {monthly.priceEgp}
              </span>
              <span className="text-gray-500 font-bold">ج.م / {monthly.periodAr}</span>
            </div>

            <ul className="space-y-2.5 my-5 flex-1">
              {BASE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-green-500 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe("monthly")}
              disabled={payingPlan !== null}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              {payingPlan === "monthly" ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              {payingPlan === "monthly"
                ? "بنجهز لينك الدفع..."
                : stillActive
                ? `جدد (+30 يوم) — ${monthly.priceEgp} ج.م`
                : `اشترك دلوقتي — ${monthly.priceEgp} ج.م`}
            </button>
          </div>

          {/* Yearly — 1500 EGP / 12 months */}
          <div className="relative bg-white dark:bg-gray-800 rounded-[24px] p-6 border-2 border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.15)] flex flex-col">
            <div className="absolute -top-3 right-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <BadgePercent size={12} /> أوفر قيمة — وفّر 300 ج.م
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl mb-4">
              <Gem size={22} className="text-white" />
            </div>
            <h3 className="font-bold text-lg">{yearly.nameAr}</h3>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-4xl font-black bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                {yearly.priceEgp}
              </span>
              <span className="text-gray-500 font-bold">ج.م / {yearly.periodAr}</span>
              <span className="text-xs text-gray-400 line-through">1800 ج.م</span>
            </div>

            <ul className="space-y-2.5 my-5 flex-1">
              {YEARLY_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-green-500 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe("yearly")}
              disabled={payingPlan !== null}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              {payingPlan === "yearly" ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              {payingPlan === "yearly"
                ? "بنجهز لينك الدفع..."
                : stillActive
                ? `جدد (+365 يوم) — ${yearly.priceEgp} ج.م`
                : `اشترك دلوقتي — ${yearly.priceEgp} ج.م`}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-center text-gray-400 leading-relaxed">
          هتتحول لصفحة دفع آمنة من فواترك — فيزا/ماستركارد، فوري، ميزة، والمحافظ 💳
          <br />
          الاشتراك بيتفعل تلقائيًا فور تأكيد الدفع (مش محتاج تكلم حد 😉)
        </p>

        {/* Booking nudge for subscribers */}
        {stillActive && (
          <button
            onClick={() => router.push("/booking")}
            className="w-full bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white flex items-center justify-center gap-2 font-bold"
          >
            احجز حصتك الجاية <CalendarPlus size={18} />
          </button>
        )}

        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <Sparkles size={14} /> أي مشكلة في الدفع؟ تواصل مع الدعم الفني من القائمة الجانبية
        </p>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <ErrorBoundary label="صفحة الاشتراك">
      <SubscriptionPageInner />
    </ErrorBoundary>
  );
}
