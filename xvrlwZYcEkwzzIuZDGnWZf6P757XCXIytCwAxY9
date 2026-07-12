"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, BrainCircuit, User } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const navItems = [
  { href: "/", icon: Home, labelAr: "الرئيسية", labelEn: "Home" },
  { href: "/library", icon: Library, labelAr: "المكتبة", labelEn: "Library" },
  { href: "/quizzes", icon: BrainCircuit, labelAr: "الكويزات", labelEn: "Quizzes" },
  { href: "/profile", icon: User, labelAr: "حسابي", labelEn: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { language } = useTheme();

  // Hide on auth pages
  if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="mx-3 mb-3 bg-white/90 dark:bg-gray-800/90 glass rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/20 dark:border-gray-700/50 px-2 py-2 flex justify-around items-center backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center px-5 py-2.5 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25 scale-105"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <item.icon size={20} className={`${isActive ? "mb-0.5" : "mb-1"}`} />
              <span className={`text-[11px] font-semibold ${isActive ? "block" : "hidden sm:block"}`}>
                {language === "ar" ? item.labelAr : item.labelEn}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
