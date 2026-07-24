"use client";
import { Suspense, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { sanitizeNextPath } from "@/lib/nav";

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Post-login destination (e.g. back to the lecture a guest tried to buy).
  const next = sanitizeNextPath(searchParams.get("next"));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push(next);
    } catch (err: any) {
      setError(err.message.includes("invalid-credential") ? "الإيميل أو الباسورد غلط" : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-navy-900">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">Meafer.ai</h1>
            <p className="text-gray-500 text-sm mt-2">منصة الثانوية العامة الذكية • سجل دخولك يا بطل</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">{error}</div>}
            
            <div>
              <label className="text-sm font-medium">الإيميل</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">الباسورد</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <button disabled={loading} className="w-full bg-gradient-to-r from-brand-700 to-brand-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-brand-700/25 hover:scale-[1.02] transition-all disabled:opacity-50">
              {loading ? "جاري الدخول..." : "دخول 🚀"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            لسه معندكش حساب؟ <Link href={`/auth/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-brand-600 font-bold hover:underline">سجل دلوقتي</Link>
          </p>

          <div className="mt-8 p-3 bg-accent-50 dark:bg-accent-900/10 rounded-xl border border-accent-100 dark:border-accent-900/20">
            <p className="text-xs text-accent-800 dark:text-accent-200">
              💡 <b>للأدمن:</b> بعد أول تسجيل، ادخل Firebase Console وغيّر role لـ admin يدوياً كما هو مطلوب في المواصفات.
            </p>
          </div>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-700 via-brand-500 to-navy-700 p-12 text-white flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div>
          <h2 className="text-4xl font-bold leading-tight">مذاكرة الثانوية<br />بقت أسهل بـ AI 🤖</h2>
          <p className="mt-4 text-white/80">ملخصات بأسلوب المراجعة النهائية • كويزات بنظام الوزارة • مساعد ذكي 24 ساعة</p>
        </div>
        <div className="relative">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
            <p className="text-sm">🚀 "المنصة دي خلتني ألم المنهج في أسبوعين! الملخصات بأسلوب المراجعة النهائية بالظبط"</p>
            <p className="text-xs text-white/60 mt-2">— أحمد، تالتة ثانوي علمي علوم، 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
