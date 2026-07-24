"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Clapperboard,
  Package,
  MessagesSquare,
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
  courses: Package,
  messages: MessagesSquare,
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
          ? "bg-brand-gradient text-white shadow-md shadow-brand-700/20"
          : isAdmin
          ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
      }`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && !active && (
        <span className="text-[10px] bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function SideNav() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = profile?.role === "admin";
  const homeHref = homeHrefForRole(profile?.role);

  const orderedItems = isAdmin ? [ADMIN_NAV_ITEM, ...MAIN_NAV_ITEMS] : MAIN_NAV_ITEMS;

  return (
    <aside className="hidden md:flex fixed inset-y-0 start-0 w-64 z-40 flex-col bg-white dark:bg-navy-900 border-e border-slate-100 dark:border-navy-800">
      {/* Logo */}
      <Link
        href={homeHref}
        title="الرجوع للرئيسية"
        className="flex items-center gap-3 px-5 pt-6 pb-4 group"
      >
        <div className="w-10 h-10 rounded-2xl bg-brand-gradient text-white flex items-center justify-center font-black text-lg shadow-lg shadow-brand-700/25 group-hover:scale-105 transition-transform">
          م
        </div>
        <div>
          <p className="font-black text-lg leading-none text-brand-600 dark:text-white">
            مِعافر
          </p>
          <p className="text-[11px] text-slate-400 mt-1" dir="ltr">M3afer • المنصة الذكية</p>
        </div>
      </Link>

      {/* Signed-in chip */}
      {profile && (
        <div className="mx-4 mb-3 rounded-2xl bg-slate-50 dark:bg-navy-800/60 border border-slate-100 dark:border-navy-700 p-3">
          <p className="text-[10px] text-slate-400 mb-0.5">داخل بحساب</p>
          <p className="text-sm font-semibold truncate" dir="ltr">{profile.email}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {isAdmin
              ? "Admin"
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

      {/* Controls — no language toggle (Arabic only) */}
      <div className="border-t border-slate-100 dark:border-navy-800 p-3 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title={theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
          className="p-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
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
