"use client";
import { Suspense, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { sanitizeNextPath } from "@/lib/nav";

function SignupPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // After signup a user with no grade goes through onboarding first (the home
  // page shows it full-screen), then lands on `next` naturally — still, push
  // them back toward what they wanted (e.g. the lecture they tried to buy).
  const next = sanitizeNextPath(searchParams.get("next"));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uuid = uuidv4();
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: email,
        uuid: uuid,
        grade: null,
        track: null,
        role: "user",
        subscription: "free",
        subscriptionActive: false,
        subscribed: false,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        streak: 0,
        lastActiveDate: null,
        weeklySubjects: [],
        preferredPersona: "ing.Mohamed",
        createdAt: new Date().toISOString()
      });
      // New accounts are already signed in; home shows the mandatory
      // onboarding overlay first, then the catalog is one tap away.
      router.push("/");
    } catch (err: any) {
      setError(err.message.includes("email-already") ? "الإيميل ده متسجل قبل كده" : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-[32px] shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">Meafer.ai</h1>
          <h2 className="text-xl font-bold mt-4">اعمل حساب جديد 🎓</h2>
          <p className="text-gray-500 text-sm mt-1">ابدأ رحلة الثانوية العامة مع AI</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          
          <div>
            <label className="text-sm font-medium">الإيميل</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@example.com" className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div>
            <label className="text-sm font-medium">الباسورد (6 حروف على الأقل)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>

          <button disabled={loading} className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all disabled:opacity-50">
            {loading ? "جاري التسجيل..." : "سجل وابدأ مجاناً ✨"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          عندك حساب؟ <Link href={`/auth/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-indigo-600 font-bold hover:underline">سجل دخول</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}
