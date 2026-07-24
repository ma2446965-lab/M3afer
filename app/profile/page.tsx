"use client";
import { useAuth } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getSubjectsForGradeTrack } from "@/lib/subjects";
import { Copy, Flame, BookOpen, Brain, Crown, Settings, Edit } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

function ProfilePageInner() {
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!profile) return null;

  const email = profile.email || user?.email || "student@meafer.app";
  const avatarLetter = (email[0] || "م").toUpperCase();
  const handle = email.split("@")[0] || "طالب مِعافر";
  const uuid = profile.uuid || "—";
  const subscription = profile.subscription || "free";
  const subjects = getSubjectsForGradeTrack(profile.grade as any, profile.track as any);

  const handleCopyUUID = async () => {
    if (!uuid || uuid === "—") return;
    try {
      await navigator.clipboard.writeText(uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can throw
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 pb-24">
      <div className="max-w-2xl mx-auto p-3 pt-5 md:pt-8">
        {/* Profile Header */}
        <div className="bg-brand-gradient rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10" />
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-xl font-bold">
              {avatarLetter}
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-base">{handle}</h1>
              <p className="text-white/80 text-xs">{email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {profile.grade && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">{profile.grade}</span>}
                {profile.track && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">{profile.track}</span>}
                {profile.role === "admin" && <span className="bg-red-500/80 px-2 py-0.5 rounded-full text-[11px] font-bold">Admin</span>}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-white/15 backdrop-blur rounded-lg p-2 text-center">
              <Flame className="mx-auto text-accent-300" size={16} />
              <p className="font-bold text-sm mt-0.5">{profile.streak ?? 0}</p>
              <p className="text-[9px] text-white/70">يوم streak</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-lg p-2 text-center">
              <BookOpen className="mx-auto text-white/80" size={16} />
              <p className="font-bold text-sm mt-0.5">12</p>
              <p className="text-[9px] text-white/70">ملف</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-lg p-2 text-center">
              <Brain className="mx-auto text-white/80" size={16} />
              <p className="font-bold text-sm mt-0.5">48</p>
              <p className="text-[9px] text-white/70">كويز</p>
            </div>
          </div>
        </div>

        {/* UUID */}
        <div className="mt-3 bg-white dark:bg-navy-800 rounded-xl p-3.5 border border-slate-100 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1"><Settings size={11} /> Global UUID</p>
              <p className="font-mono text-xs mt-1 font-bold">{uuid}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">استخدمه عند التواصل للدعم أو الاشتراك</p>
            </div>
            <button onClick={handleCopyUUID} className="p-2 bg-slate-100 dark:bg-navy-700 rounded-lg hover:scale-105 transition">
              <Copy size={16} />
            </button>
          </div>
          {copied && <p className="text-[11px] text-green-600 mt-1.5">تم النسخ!</p>}
        </div>

        {/* Subscription */}
        <div className="mt-3 bg-white dark:bg-navy-800 rounded-xl p-3.5 border border-slate-100 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${subscription === "free" ? "bg-slate-100 dark:bg-navy-700" : "bg-accent-100 dark:bg-accent-900/30"}`}>
              <Crown size={16} className={subscription === "free" ? "text-slate-500" : "text-accent-600"} />
            </div>
            <div>
              <p className="font-bold text-xs capitalize">{subscription} Plan</p>
              <p className="text-[11px] text-slate-500">{profile.subscriptionActive ? "مفعل" : "غير مفعل — Free Tier"}</p>
            </div>
          </div>
          <a href="/subscription" className="text-[11px] bg-brand-gradient text-white px-2.5 py-1 rounded-lg font-medium">ترقية</a>
        </div>

        {/* Grade/Track */}
        <div className="mt-3 bg-white dark:bg-navy-800 rounded-xl p-3.5 border border-slate-100 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-xs">معلومات الدراسة</h3>
            <button className="text-[11px] text-brand-600 flex items-center gap-0.5"><Edit size={11} /> تعديل</button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between p-2 bg-slate-50 dark:bg-navy-700/50 rounded-lg">
              <span className="text-slate-500">السنة الدراسية</span>
              <span className="font-medium">{profile.grade}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 dark:bg-navy-700/50 rounded-lg">
              <span className="text-slate-500">الشعبة</span>
              <span className="font-medium">{profile.track || "عام — أولى ثانوي"}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 dark:bg-navy-700/50 rounded-lg">
              <span className="text-slate-500">عدد المواد</span>
              <span className="font-medium">{subjects.length} مواد</span>
            </div>
          </div>
        </div>

        {/* AI Persona */}
        <div className="mt-3 bg-white dark:bg-navy-800 rounded-xl p-3.5 border border-slate-100 dark:border-navy-700">
          <h3 className="font-bold text-xs mb-2">مساعدي المفضل</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2.5 rounded-xl border-2 flex items-center gap-2 ${profile.preferredPersona === "ing.Mohamed" ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20" : "border-slate-100 dark:border-navy-700"}`}>
              <Image src="/avatars/mohamed.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
              <div>
                <p className="font-bold text-[11px]">بشمهندس محمد</p>
                <p className="text-[10px] text-slate-500">منطقي، تشبيهات تكنولوجية</p>
              </div>
            </div>
            <div className={`p-2.5 rounded-xl border-2 flex items-center gap-2 ${profile.preferredPersona === "Dr.Basmala" ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20" : "border-slate-100 dark:border-navy-700"}`}>
              <Image src="/avatars/basmala.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
              <div>
                <p className="font-bold text-[11px]">دكتورة بسملة</p>
                <p className="text-[10px] text-slate-500">حنينة، تشجيع مستمر</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-4 p-3 bg-brand-50 dark:bg-brand-900/10 rounded-xl border border-brand-100 dark:border-brand-800/30">
          <p className="text-[11px] text-brand-800 dark:text-brand-200">
            كل ملفاتك ومذكراتك محمية بقواعد Firebase — محدش يقدر يشوفها غيرك.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ErrorBoundary label="صفحة الحساب">
      <ProfilePageInner />
    </ErrorBoundary>
  );
}
