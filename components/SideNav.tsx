"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Clapperboard,
  NotebookPen,
  BookOpen,
  BrainCircuit,
  CalendarPlus,
  CalendarCheck,
  CreditCard,
  User,
  Shield,
  Moon,
  Sun,
  Languages,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  MAIN_NAV_ITEMS,
  ADMIN_NAV_ITEM,
  IconKey,
  homeHrefForRole,
  isNavActive,
} from "@/lib/nav";

const ICONS: Record<IconKey, any> = {
  home: Home,
  lectures: Clapperboard,
  planner: NotebookPen,
  library: BookOpen,
  quizzes: BrainCircuit,
  booking: CalendarPlus,
  schedule: CalendarCheck,
  subscription: CreditCard,
  profile: User,
  admin: Shield,
};

function NavRow({
  href,
  iconKey,
  label,
  badge,
  active,
  variant,
}: {
  href: string;
  iconKey: IconKey;
  label: string;
  badge?: string;
  active: boolean;
  variant?: "admin";
}) {
  const Icon = ICONS[iconKey];
  const isAdmin = variant === "admin";
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
        active
          ? "bg-gradient-to-l from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20"
          : isAdmin
          ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && !active && (
        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
    </Link>
  );
}

/**
 * Persistent sidebar for tablet & desktop (md+). The main content area is
 * pushed by `md:ps-64` in AppShell, so pages reflow around this sidebar
 * instead of being covered by it. On phones it stays hidden — the hamburger
 * drawer + bottom nav take over.
 */
export default function SideNav() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const { theme, language, toggleTheme, setLanguage } = useTheme();
  const isAdmin = profile?.role === "admin";
  const homeHref = homeHrefForRole(profile?.role);

  const orderedItems = isAdmin ? [ADMIN_NAV_ITEM, ...MAIN_NAV_ITEMS] : MAIN_NAV_ITEMS;

  return (
    <aside className="hidden md:flex fixed inset-y-0 start-0 w-64 z-40 flex-col bg-white dark:bg-gray-900 border-e border-gray-100 dark:border-gray-800">
      {/* Logo → home (admin: /admin, student: /) */}
      <Link
        href={homeHref}
        title="الرجوع للرئيسية"
        className="flex items-center gap-3 px-5 pt-6 pb-4 group"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform">
          م
        </div>
        <div>
          <p className="font-black text-lg leading-none bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
            مِعافر 🤖
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Meafer.ai • المنصة الذكية</p>
        </div>
      </Link>

      {/* Signed-in chip */}
      {profile && (
        <div className="mx-4 mb-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 p-3">
          <p className="text-[10px] text-gray-400 mb-0.5">داخل بحساب</p>
          <p className="text-sm font-semibold truncate" dir="ltr">{profile.email}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {isAdmin
              ? "Admin 🛡️"
              : `${profile.grade ?? ""}${profile.track ? ` • ${profile.track}` : ""}`}
          </p>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {orderedItems.map((item) => (
          <NavRow
            key={item.href}
            href={item.href}
            iconKey={item.iconKey}
            label={item.labelAr}
            badge={item.badgeAr}
            active={isNavActive(pathname, item.href)}
            variant={item.iconKey === "admin" ? "admin" : undefined}
          />
        ))}
      </nav>

      {/* Controls */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title={theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
          className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          title="اللغة / Language"
          className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <Languages size={16} />
        </button>
        {profile && (
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm font-medium"
          >
            <LogOut size={15} />
            خروج
          </button>
        )}
      </div>
    </aside>
  );
}
