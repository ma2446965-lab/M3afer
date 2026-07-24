"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, BrainCircuit, User, CalendarPlus } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, labelAr: "الرئيسية" },
  { href: "/library", icon: Library, labelAr: "المكتبة" },
  { href: "/booking", icon: CalendarPlus, labelAr: "احجز" },
  { href: "/quizzes", icon: BrainCircuit, labelAr: "الكويزات" },
  { href: "/profile", icon: User, labelAr: "حسابي" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on auth pages
  if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom,0px))] bg-white/90 dark:bg-navy-800/90 glass rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/20 dark:border-navy-700/50 px-2 py-2 flex justify-between items-center backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-brand-gradient text-white shadow-lg shadow-brand-700/25"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <item.icon size={20} className={`${isActive ? "mb-0.5" : "mb-1"}`} />
              <span className={`text-[11px] font-semibold whitespace-nowrap ${isActive ? "block" : "hidden sm:block"}`}>
                {item.labelAr}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
