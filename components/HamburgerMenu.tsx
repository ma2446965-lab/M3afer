"use client";
import { useState } from "react";
import { Menu, X, Moon, Sun, Languages, CreditCard, MessageCircle, LogOut, Shield, BookOpen, CalendarPlus, CalendarCheck, CalendarDays, Clapperboard } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { theme, language, toggleTheme, setLanguage, setFabVisible, isFabVisible } = useTheme();
  const { profile, logout } = useAuth();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 hover:scale-105 transition-transform"
      >
        <Menu size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex">
          {/* backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          {/* drawer */}
          <div className="w-[85%] max-w-[360px] bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
            {/* header */}
            <div className="p-6 bg-gradient-to-br from-sky-500 to-indigo-600 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10" />
              <button onClick={() => setOpen(false)} className="absolute top-4 left-4 p-2 bg-white/20 rounded-full hover:bg-white/30">
                <X size={18} />
              </button>
              <div className="relative mt-6">
                <h2 className="text-2xl font-bold">Meafer.ai</h2>
                <p className="text-white/80 text-sm mt-1">منصة الثانوية العامة الذكية 🧠</p>
                {profile && (
                  <div className="mt-4 bg-white/15 rounded-xl p-3 backdrop-blur">
                    <p className="text-xs opacity-80">الطالب</p>
                    <p className="font-semibold truncate">{profile.email}</p>
                    <p className="text-xs mt-1 bg-white/20 inline-block px-2 py-0.5 rounded-full">
                      {profile.grade} {profile.track ? `• ${profile.track}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 p-4 space-y-2">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">{language === "ar" ? (theme === "light" ? "الوضع الليلي" : "الوضع النهاري") : (theme === "light" ? "Dark Mode" : "Light Mode")}</p>
                  <p className="text-xs text-gray-500">{theme === "light" ? "فعل الوضع الداكن" : "فعل الوضع الفاتح"}</p>
                </div>
              </button>

              {/* Language */}
              <button
                onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Languages size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">اللغة / Language</p>
                  <p className="text-xs text-gray-500">{language === "ar" ? "English" : "العربية"}</p>
                </div>
              </button>

              {/* FAB Toggle */}
              <button
                onClick={() => setFabVisible(!isFabVisible)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-lg text-sky-600 dark:text-sky-400">
                  <MessageCircle size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">{isFabVisible ? "إخفاء المساعد الذكي" : "إظهار المساعد الذكي"}</p>
                  <p className="text-xs text-gray-500">{isFabVisible ? "المساعد ظاهر حالياً" : "المساعد مخفي"}</p>
                </div>
              </button>

              <div className="border-t border-gray-100 dark:border-gray-800 my-3" />

              <Link href="/subscription" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600">
                  <CreditCard size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">الاشتراك</p>
                  <p className="text-xs text-gray-500">من 150 ج.م/شهر — فتح كل المميزات ✨</p>
                </div>
              </Link>

              <Link href="/lectures" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600">
                  <Clapperboard size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm flex items-center gap-2">المحاضرات <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">جديد ✨</span></p>
                  <p className="text-xs text-gray-500">محاضرات مسجلة تشتريها وتفضل معاك — معاينات مجانية 🎬</p>
                </div>
              </Link>

              <Link href="/planner" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-teal-600">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm flex items-center gap-2">جدولي <span className="text-[10px] bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300 px-1.5 py-0.5 rounded-full font-bold">جديد ✨</span></p>
                  <p className="text-xs text-gray-500">جدول مذاكرة مخصوص — 50 ج.م، الرد خلال 24 ساعة</p>
                </div>
              </Link>

              <Link href="/library" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">المكتبة والملفات</p>
                  <p className="text-xs text-gray-500">كل الـ PDFs والملخصات</p>
                </div>
              </Link>

              <Link href="/booking" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400">
                  <CalendarPlus size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">احجز حصتك</p>
                  <p className="text-xs text-gray-500">مواعيد الحصص المتاحة</p>
                </div>
              </Link>

              <Link href="/schedule" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
                  <CalendarCheck size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">جدولي</p>
                  <p className="text-xs text-gray-500">حصصك المحجوزة بالتاريخ</p>
                </div>
              </Link>

              {profile?.role === "admin" && (
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                  <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                    <Shield size={18} />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-medium text-sm">لوحة الأدمن</p>
                    <p className="text-xs opacity-80">إدارة المستخدمين والاشتراكات</p>
                  </div>
                </Link>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 my-3" />

              <button
                onClick={() => { logout(); setOpen(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition"
              >
                <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <LogOut size={18} />
                </div>
                <p className="font-medium text-sm">تسجيل خروج</p>
              </button>
            </div>

            <div className="p-4 text-center">
              <p className="text-[11px] text-gray-400">Meafer.ai v1.0 • صنع بكل حب لطلاب الثانوية العامة ❤️</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
