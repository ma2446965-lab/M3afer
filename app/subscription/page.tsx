"use client";
import { useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import { Check, Crown, Zap, Star, MessageCircle } from "lucide-react";

const plans = [
  {
    id: "basic",
    name: "Basic Plan",
    nameAr: "الباقة الأساسية",
    price: 99,
    originalPrice: 200,
    features: [
      "5 ملفات PDF شهرياً",
      "ملخصات أساسية بأسلوب المراجعة النهائية",
      "دعم عبر واتساب",
      "وصول للمكتبة",
    ],
    icon: "📚",
    color: "from-gray-600 to-gray-800",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro Plan",
    nameAr: "الباقة الاحترافية",
    price: 299,
    originalPrice: 600,
    features: [
      "20 ملف PDF شهرياً",
      "كل مميزات الأساسية",
      "فلاش كاردز ذكية",
      "كويزات غير محدودة بنظام الوزارة",
      "محادثة متقدمة مع AI (ing.Mohamed & Dr.Basmala)",
      "تتبع streak يومي",
    ],
    icon: "🚀",
    color: "from-violet-600 to-indigo-600",
    popular: true,
  },
  {
    id: "premium",
    name: "Premium Plan",
    nameAr: "الباقة المميزة VIP",
    price: 499,
    originalPrice: 1000,
    features: [
      "ملفات غير محدودة ♾️",
      "كل مميزات Pro",
      "ميزة NotebookLM الصوتية 🔊 (سكريبت بودكاست + TTS قريباً)",
      "دعم VIP فوري",
      "أولوية في توليد المحتوى",
      "مراجعة نهائية AI مخصصة لكل مادة",
    ],
    icon: "👑",
    color: "from-amber-500 to-orange-600",
    popular: false,
  },
];

export default function SubscriptionPage() {
  const { profile } = useAuth();

  const handleSubscribe = (planName: string) => {
    const uuid = profile?.uuid || "UNKNOWN_UUID";
    const message = `Hello, I am user ${uuid} and I want to subscribe to the ${planName} plan.`;
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/201128182537?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24">
      <HamburgerMenu />
      <BottomNav />

      <div className="max-w-5xl mx-auto p-4 pt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black">خطط الاشتراك 💎</h1>
          <p className="text-gray-500 text-sm mt-2">اختار الباقة اللي تناسبك - الدفع عبر واتساب بسهولة</p>
          {profile && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white dark:bg-gray-800 border px-3 py-1.5 rounded-full text-xs">
              <span className="text-gray-500">UUID:</span>
              <span className="font-mono font-bold">{profile.uuid.slice(0, 8)}...</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${profile.subscriptionActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {profile.subscription} {profile.subscriptionActive ? "• Active" : ""}
              </span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div key={plan.id} className={`relative bg-white dark:bg-gray-800 rounded-[24px] p-6 border-2 flex flex-col ${plan.popular ? "border-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.1)] scale-[1.02]" : "border-gray-100 dark:border-gray-700"}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] px-3 py-1 rounded-full font-bold flex items-center gap-1">
                  <Star size={12} /> الأكثر شعبية
                </div>
              )}

              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-xl mb-4`}>
                {plan.icon}
              </div>

              <h3 className="font-bold text-lg">{plan.nameAr}</h3>
              <p className="text-xs text-gray-500">{plan.name}</p>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black">{plan.price}</span>
                <span className="text-sm">EGP</span>
                <span className="text-sm text-gray-400 line-through">{plan.originalPrice} EGP</span>
              </div>
              <p className="text-[11px] text-green-600 font-medium mt-1">وفر {plan.originalPrice - plan.price} جنيه! 🔥 خصم {Math.round(((plan.originalPrice - plan.price)/plan.originalPrice)*100)}%</p>

              <div className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} className="text-green-600" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 text-[13px]">{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSubscribe(plan.name)}
                className={`mt-6 w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition hover:scale-[1.02] ${
                  plan.popular
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                    : plan.id === "premium"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
                    : "bg-gray-900 dark:bg-white dark:text-gray-900 text-white"
                }`}
              >
                <MessageCircle size={18} />
                اشترك عبر واتساب
              </button>

              <p className="text-[10px] text-center text-gray-400 mt-3">سيتم تحويلك لواتساب مع رقمك المميز تلقائياً</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold flex items-center gap-2"><Zap size={18} className="text-amber-500" /> إزاي الاشتراك بيشتغل؟</h3>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center font-bold text-indigo-600 shrink-0">1</div>
              <p className="text-gray-600 dark:text-gray-400">بتدوس "اشترك عبر واتساب" وهيتم تحويلك مباشرة لرقم الدعم مع رسالة فيها UUID واسم الباقة تلقائياً</p>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center font-bold text-violet-600 shrink-0">2</div>
              <p className="text-gray-600 dark:text-gray-400">فريقنا بيرد عليك في دقايق، بتدفع فودافون كاش / انستا باي، وبيفعلولك الباقة يدوياً</p>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center font-bold text-amber-600 shrink-0">3</div>
              <p className="text-gray-600 dark:text-gray-400">الأدمن بيبحث بـ UUID بتاعك في لوحة التحكم وبيفعل الاشتراك فوراً • role-based admin system</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
