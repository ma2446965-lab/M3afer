"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Moon, Sun, CreditCard, MessageCircle, LogOut, Shield, BookOpen, CalendarPlus, CalendarCheck, CalendarDays, Clapperboard, Home, MessagesSquare, Package } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { homeHrefForRole } from "@/lib/nav";

/**
 * Mobile-only drawer (md+ uses the persistent SideNav instead).
 * The trigger renders in normal flow — AppShell mounts it inside the mobile
 * top bar — so it no longer floats over page content.
 * Language toggle removed — platform is Arabic-only.
 */
export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme, setFabVisible, isFabVisible } = useTheme();
  const { profile, logout } = useAuth();
  const isAdmin = profile?.role === "admin";
  const homeHref = homeHrefForRole(profile?.role);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="فتح القائمة"
        className="md:hidden p-2.5 bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-slate-100 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700 transition"
      >
        <Menu size={20} />
      </button>

      {open &&
        createPortal(
        <div className="md:hidden fixed inset-0 z-[100] flex">
          {/* backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* drawer */}
          <div className="w-[85%] max-w-[360px] bg-white dark:bg-navy-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
            {/* header */}
            <div className="p-6 bg-brand-gradient text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10" />
              <button onClick={() => setOpen(false)} className="absolute top-4 left-4 p-2 bg-white/20 rounded-full hover:bg-white/30">
                <X size={18} />
              </button>
              <div className="relative mt-6">
                <h2 className="text-2xl font-bold">Meafer.ai</h2>
                <p className="text-white/80 text-sm mt-1">منصة الثانوية العامة الذكية</p>
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
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition"
              >
                <div className="p-2 bg-slate-100 dark:bg-navy-800 rounded-lg text-brand-600">
                  {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">{theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}</p>
                  <p className="text-xs text-slate-500">{theme === "light" ? "فعل الوضع الداكن" : "فعل الوضع الفاتح"}</p>
                </div>
              </button>

              {/* FAB Toggle */}
              <button
                onClick={() => setFabVisible(!isFabVisible)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition"
              >
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                  <MessageCircle size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">{isFabVisible ? "إخفاء المساعد الذكي" : "إظهار المساعد الذكي"}</p>
                  <p className="text-xs text-slate-500">{isFabVisible ? "المساعد ظاهر حالياً" : "المساعد مخفي"}</p>
                </div>
              </button>

              <div className="border-t border-slate-100 dark:border-navy-800 my-3" />

              <Link href={homeHref} onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                  <Home size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">{isAdmin ? "لوحة الأدمن" : "الرئيسية"}</p>
                  <p className="text-xs text-slate-500">{isAdmin ? "الرجوع للوحة التحكم" : "الرجوع للصفحة الرئيسية"}</p>
                </div>
              </Link>

              <Link href="/subscription" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-accent-50 dark:bg-accent-900/30 rounded-lg text-accent-600">
                  <CreditCard size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">الاشتراك</p>
                  <p className="text-xs text-slate-500">من 99 ج.م — فتح كل المميزات</p>
                </div>
              </Link>

              <Link href="/lectures" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600">
                  <Clapperboard size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm flex items-center gap-2">المحاضرات <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-bold">جديد</span></p>
                  <p className="text-xs text-slate-500">محاضرات مسجلة — معاينات مجانية</p>
                </div>
              </Link>

              <Link href="/courses" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                  <Package size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm flex items-center gap-2">الكورسات <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-bold">جديد</span></p>
                  <p className="text-xs text-slate-500">مسارات كاملة محاضرة ورا محاضرة — بخصم</p>
                </div>
              </Link>

              <Link href="/messages" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                  <MessagesSquare size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm flex items-center gap-2">الرسائل <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-bold">جديد</span></p>
                  <p className="text-xs text-slate-500">كلم صحابك المشتركين + دعم مِعافر</p>
                </div>
              </Link>

              <Link href="/planner" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm flex items-center gap-2">جدولي <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-bold">جديد</span></p>
                  <p className="text-xs text-slate-500">جدول مذاكرة مخصوص — 50 ج.م</p>
                </div>
              </Link>

              <Link href="/library" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600">
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">المكتبة والملفات</p>
                  <p className="text-xs text-slate-500">كل الـ PDFs والملخصات</p>
                </div>
              </Link>

              <Link href="/booking" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                  <CalendarPlus size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">احجز حصتك</p>
                  <p className="text-xs text-slate-500">مواعيد الحصص المتاحة</p>
                </div>
              </Link>

              <Link href="/schedule" onClick={() => setOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                  <CalendarCheck size={18} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-sm">حصصي</p>
                  <p className="text-xs text-slate-500">حصصك المحجوزة بالتاريخ</p>
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

              <div className="border-t border-slate-100 dark:border-navy-800 my-3" />

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
              <p className="text-[11px] text-slate-400">Meafer.ai v1.0 • صنع بكل حب لطلاب الثانوية العامة</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
