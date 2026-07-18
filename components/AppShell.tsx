"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { shouldHideChrome, homeHrefForRole } from "@/lib/nav";
import SideNav from "@/components/SideNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import BottomNav from "@/components/BottomNav";
import FloatingChat from "@/components/FloatingChat";

/**
 * Global app chrome, mounted once from the root layout:
 *  - md+   : persistent SideNav on the inline-start side; the content column
 *            gets `md:ps-64` so every page reflows around it (never covered).
 *  - phones: sticky top bar (logo → home + hamburger) and the floating
 *            BottomNav, both hidden on md+.
 * Auth/onboarding routes render bare (no chrome).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();

  if (shouldHideChrome(pathname)) return <>{children}</>;

  const homeHref = homeHrefForRole(profile?.role);
  // Admin area keeps its own focused UI — skip the student AI-tutor FAB there.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      <SideNav />

      <div className="md:ps-64 min-h-screen flex flex-col">
        {/* Mobile top bar — logo is the universal "back to home" control */}
        <header className="md:hidden sticky top-0 z-40 h-14 px-4 flex items-center justify-between bg-white/85 dark:bg-gray-900/85 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
          <Link
            href={homeHref}
            title="الرجوع للرئيسية"
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-sky-500/25 group-hover:scale-105 transition-transform">
              م
            </div>
            <span className="font-black text-base bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
              مِعافر 🤖
            </span>
          </Link>
          <HamburgerMenu />
        </header>

        <main className="flex-1">{children}</main>
      </div>

      <BottomNav />
      {!isAdminArea && <FloatingChat />}
    </div>
  );
}
