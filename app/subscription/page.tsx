"use client";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PLANS, PLAN_LIST, type PlanId } from "@/lib/plans";
import {
  Check,
  Loader2,
  Crown,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  BadgePercent,
  Star,
  Zap,
  MessageCircle,
} from "lucide-react";

const WHATSAPP_NUMBER = "201128182537";

function fmtEndDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(+d)) return "—";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

function PaymentBanner() {
  const params = useSearchParams();
  const state = params.get("payment");
  if (!state) return null;
  const map: Record<string, { text: string; cls: string }> = {
    success: {
      text: "تم الدفع بنجاح! اشتراكك مفعّل.",
      cls: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30"
    },
    pending: {
      text: "استلمنا طلبك — هيتفعل الاشتراك أول ما الدفع يتأكد.",
      cls: "bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 border-accent-100 dark:border-accent-900/30"
    },
    failed: {
      text: "الدفع ما تمش. جرب تاني أو تواصل معانا.",
      cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900/30"
    }
  };
  const item = map[state];
  if (!item) return null;
  return <p className={`text-sm p-3 rounded-xl border leading-relaxed ${item.cls}`}>{item.text}</p>;
}

function handleWhatsAppSubscribe(planId: PlanId) {
  const plan = PLANS[planId];
  const message = encodeURIComponent(
    `مرحباً، عايز أشترك في خطة "${plan.nameAr}" على منصة مِعافر.\nالسعر: ${plan.priceEgp} جنيه مصري.\nالمدة: ${plan.periodAr}.\nمحتاج تفاصيل طريقة الدفع. شكراً!`
  );
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  window.open(url, "_blank");
}

function SubscriptionPageInner() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  const subscribed = profile?.subscribed === true;
  const endMs = profile?.subscriptionEndDate ? new Date(profile.subscriptionEndDate).getTime() : 0;
  const stillActive = subscribed && endMs > Date.now();

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-900">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-brand-gradient text-white p-5 pt-5 pb-6 md:pt-8 rounded-b-[28px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Crown size={22} /> الاشتراك
          </h1>
          <p className="text-white/85 text-xs mt-1">اختار الخطة اللي تناسبك وابدأ رحلة التميز</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-3 space-y-4 -mt-2">
        <Suspense fallback={null}>
          <PaymentBanner />
        </Suspense>

        {/* Current status */}
        <div className={`rounded-2xl p-4 border flex items-center gap-3 ${
          stillActive
            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
            : "bg-white dark:bg-navy-800 border-slate-100 dark:border-navy-700"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            stillActive ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-slate-100 dark:bg-navy-700 text-slate-400"
          }`}>
            {stillActive ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">
              {stillActive ? "اشتراكك فعّال" : "أنت غير مشترك حالياً"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {stillActive
                ? `ينتهي في ${fmtEndDate(profile?.subscriptionEndDate)}`
                : "اشترك عشان تفتح كل مميزات المنصة"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/70 dark:bg-navy-700 border dark:border-navy-600 text-slate-500 disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {/* Plans Grid — 3 columns on md+, stack on mobile */}
        <div className="grid md:grid-cols-3 gap-3 items-stretch">
          {/* Plan: انطلاقة — 99 EGP */}
          <div className="relative bg-white dark:bg-navy-800 rounded-2xl p-4 border border-slate-200 dark:border-navy-700 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-3">
              <Zap size={20} className="text-brand-600" />
            </div>
            <h3 className="font-bold text-lg">{PLANS.starter.nameAr}</h3>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-brand-700 dark:text-brand-400">
                {PLANS.starter.priceEgp}
              </span>
              <span className="text-slate-500 font-medium text-sm">ج.م / {PLANS.starter.periodAr}</span>
            </div>

            <ul className="space-y-2 my-4 flex-1">
              {PLANS.starter.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <Check size={14} className="text-brand-600 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleWhatsAppSubscribe("starter")}
              className="w-full bg-white border-2 border-brand-600 text-brand-700 dark:text-brand-400 dark:border-brand-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition text-sm"
            >
              <MessageCircle size={16} />
              {stillActive ? `جدد — ${PLANS.starter.priceEgp} ج.م` : "اشترك دلوقتي"}
            </button>
          </div>

          {/* Plan: التزام — 150 EGP (Most Popular) */}
          <div className="relative bg-white dark:bg-navy-800 rounded-2xl p-4 border-2 border-accent-400 shadow-[0_0_0_3px_rgba(212,168,67,0.15)] flex flex-col">
            <div className="absolute -top-3 right-4 bg-accent-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Star size={10} fill="currentColor" /> الأكثر طلباً
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center mb-3">
              <BadgePercent size={20} className="text-accent-600" />
            </div>
            <h3 className="font-bold text-lg">{PLANS.commitment.nameAr}</h3>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-accent-600 dark:text-accent-400">
                {PLANS.commitment.priceEgp}
              </span>
              <span className="text-slate-500 font-medium text-sm">ج.م / {PLANS.commitment.periodAr}</span>
            </div>

            <ul className="space-y-2 my-4 flex-1">
              {PLANS.commitment.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <Check size={14} className="text-accent-600 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleWhatsAppSubscribe("commitment")}
              className="w-full bg-brand-gradient text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition text-sm shadow-md shadow-brand-700/20"
            >
              <MessageCircle size={16} />
              {stillActive ? `جدد — ${PLANS.commitment.priceEgp} ج.م` : "اشترك دلوقتي"}
            </button>
          </div>

          {/* Plan: VIP — 250 EGP */}
          <div className="relative bg-white dark:bg-navy-800 rounded-2xl p-4 border border-slate-200 dark:border-navy-700 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-navy-100 dark:bg-navy-700 flex items-center justify-center mb-3">
              <Crown size={20} className="text-navy-600 dark:text-navy-400" />
            </div>
            <h3 className="font-bold text-lg">{PLANS.vip.nameAr}</h3>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-navy-700 dark:text-navy-300">
                {PLANS.vip.priceEgp}
              </span>
              <span className="text-slate-500 font-medium text-sm">ج.م / {PLANS.vip.periodAr}</span>
            </div>

            <ul className="space-y-2 my-4 flex-1">
              {PLANS.vip.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <Check size={14} className="text-navy-600 dark:text-navy-400 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleWhatsAppSubscribe("vip")}
              className="w-full bg-white border-2 border-navy-600 text-navy-700 dark:text-navy-400 dark:border-navy-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-navy-50 dark:hover:bg-navy-900/20 transition text-sm"
            >
              <MessageCircle size={16} />
              {stillActive ? `جدد — ${PLANS.vip.priceEgp} ج.م` : "اشترك دلوقتي"}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-center text-slate-400 leading-relaxed">
          عند الضغط على &quot;اشترك دلوقتي&quot; هتتحول لواتساب مع رسالة جاهزة فيها اسم الخطة والسعر.
          <br />
          فريقنا هيرد عليك في أقل من ساعة بطريقة الدفع المناسبة.
        </p>

        {/* Booking nudge for subscribers */}
        {stillActive && (
          <button
            onClick={() => router.push("/booking")}
            className="w-full bg-gradient-to-br from-brand-600 to-navy-700 rounded-2xl p-3.5 text-white flex items-center justify-center gap-2 font-bold text-sm"
          >
            احجز حصتك الجاية
          </button>
        )}

        <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
          <Sparkles size={12} /> أي مشكلة؟ تواصل معانا من خلال الواتساب
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
