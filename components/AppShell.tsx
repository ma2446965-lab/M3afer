"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { shouldHideChrome, homeHrefForRole } from "@/lib/nav";
import SideNav from "@/components/SideNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import BottomNav from "@/components/BottomNav";
import FloatingChat from "@/components/FloatingChat";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();

  if (shouldHideChrome(pathname)) return <>{children}</>;

  const homeHref = homeHrefForRole(profile?.role);
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900">
      <SideNav />

      <div className="md:ps-64 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 h-14 px-4 flex items-center justify-between bg-white/85 dark:bg-navy-900/85 backdrop-blur-lg border-b border-slate-100 dark:border-navy-800">
          <Link
            href={homeHref}
            title="الرجوع للرئيسية"
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-black text-sm shadow-md shadow-brand-700/25 group-hover:scale-105 transition-transform">
              م
            </div>
            <span className="font-black text-base bg-brand-gradient bg-clip-text text-transparent">
              مِعافر
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
