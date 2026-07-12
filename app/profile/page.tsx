"use client";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import BottomNav from "@/components/BottomNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import FloatingChat from "@/components/FloatingChat";
import { getSubjectsForGradeTrack } from "@/lib/subjects";
import { Copy, Flame, BookOpen, Brain, Crown, Settings, Edit } from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const { language } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!profile) return null;

  const subjects = getSubjectsForGradeTrack(profile.grade as any, profile.track as any);

  const handleCopyUUID = () => {
    navigator.clipboard.writeText(profile.uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24">
      <HamburgerMenu />
      <FloatingChat />
      <BottomNav />

      <div className="max-w-2xl mx-auto p-4 pt-16">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-sky-500 to-indigo-600 rounded-[24px] p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-bold">
              {profile.email[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-lg">{profile.email.split('@')[0]}</h1>
              <p className="text-white/80 text-sm">{profile.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="bg-white/20 px-2.5 py-1 rounded-full text-xs">{profile.grade}</span>
                {profile.track && <span className="bg-white/20 px-2.5 py-1 rounded-full text-xs">{profile.track}</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Flame className="mx-auto text-orange-200" size={20} />
              <p className="font-bold mt-1">{profile.streak}</p>
              <p className="text-[10px] text-white/70">يوم streak</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <BookOpen className="mx-auto text-white/80" size={20} />
              <p className="font-bold mt-1">12</p>
              <p className="text-[10px] text-white/70">ملف</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <Brain className="mx-auto text-white/80" size={20} />
              <p className="font-bold mt-1">48</p>
              <p className="text-[10px] text-white/70">كويز</p>
            </div>
          </div>
        </div>

        {/* UUID */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Settings size={12} /> Global UUID الخاص بيك</p>
              <p className="font-mono text-sm mt-1 font-bold">{profile.uuid}</p>
              <p className="text-[11px] text-gray-400 mt-1">ده ID الوحيد ليك - استخدمه عند التواصل للدعم أو الاشتراك</p>
            </div>
            <button onClick={handleCopyUUID} className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl hover:scale-105 transition">
              <Copy size={18} />
            </button>
          </div>
          {copied && <p className="text-xs text-green-600 mt-2">✅ تم النسخ!</p>}
        </div>

        {/* Subscription */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.subscription === "free" ? "bg-gray-100 dark:bg-gray-700" : "bg-amber-100 dark:bg-amber-900/30"}`}>
              <Crown size={18} className={profile.subscription === "free" ? "text-gray-500" : "text-amber-600"} />
            </div>
            <div>
              <p className="font-bold text-sm capitalize">{profile.subscription} Plan</p>
              <p className="text-xs text-gray-500">{profile.subscriptionActive ? "مفعل • Active" : "غير مفعل - Free Tier"}</p>
            </div>
          </div>
          <a href="/subscription" className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full font-medium">ترقية</a>
        </div>

        {/* Grade/Track Edit */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">معلومات الدراسة</h3>
            <button className="text-xs text-indigo-600 flex items-center gap-1"><Edit size={12} /> تعديل</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <span className="text-gray-500">السنة الدراسية</span>
              <span className="font-medium">{profile.grade}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <span className="text-gray-500">الشعبة</span>
              <span className="font-medium">{profile.track || "عام - أولى ثانوي"}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <span className="text-gray-500">عدد المواد</span>
              <span className="font-medium">{subjects.length} مواد</span>
            </div>
          </div>
        </div>

        {/* AI Persona */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-sm mb-3">مساعدي المفضل 🤖</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-3 rounded-xl border-2 ${profile.preferredPersona === "ing.Mohamed" ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-100 dark:border-gray-700"}`}>
              <p className="font-bold text-sm">👨‍💻 ing.Mohamed</p>
              <p className="text-xs text-gray-500 mt-1">مهندس روش، تشبيهات تكنولوجية، منطقي</p>
            </div>
            <div className={`p-3 rounded-xl border-2 ${profile.preferredPersona === "Dr.Basmala" ? "border-violet-600 bg-violet-50 dark:bg-violet-900/20" : "border-gray-100 dark:border-gray-700"}`}>
              <p className="font-bold text-sm">👩‍⚕️ Dr.Basmala</p>
              <p className="text-xs text-gray-500 mt-1">دكتورة حنينة، تشجيع، تشبيهات طبية</p>
            </div>
          </div>
        </div>

        {/* Firestore Security Note */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            🔒 <b>الأمان:</b> كل ملفاتك ومذكراتك محمية بقواعد Firebase Storage & Firestore - محدش يقدر يشوفها غيرك حسب الـ UID. كل user يقدر يقرأ/يكتب ملفاته بس.
          </p>
        </div>
      </div>
    </div>
  );
}
