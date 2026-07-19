// ─── App navigation model ─────────────────────────────────────────────
// Pure data + helpers shared by SideNav (desktop/tablet), the mobile top
// bar, and the hamburger drawer. No React imports → unit-testable.

export type IconKey =
  | "home"
  | "lectures"
  | "messages"
  | "planner"
  | "library"
  | "quizzes"
  | "booking"
  | "schedule"
  | "subscription"
  | "profile"
  | "admin";

export interface AppNavItem {
  href: string;
  iconKey: IconKey;
  labelAr: string;
  labelEn: string;
  descAr?: string;
  badgeAr?: string;
}

/** Primary student-facing destinations (order = display order). */
export const MAIN_NAV_ITEMS: AppNavItem[] = [
  { href: "/", iconKey: "home", labelAr: "الرئيسية", labelEn: "Home", descAr: "نظرة سريعة على يومك" },
  { href: "/lectures", iconKey: "lectures", labelAr: "المحاضرات", labelEn: "Lectures", descAr: "محاضرات مسجلة تفضل معاك", badgeAr: "جديد ✨" },
  { href: "/messages", iconKey: "messages", labelAr: "الرسائل", labelEn: "Messages", descAr: "كلم صحابك المشتركين + دعم مِعافر", badgeAr: "جديد ✨" },
  { href: "/planner", iconKey: "planner", labelAr: "جدولي 📅", labelEn: "Planner", descAr: "جدول مذاكرة مخصوص ليك", badgeAr: "جديد ✨" },
  { href: "/library", iconKey: "library", labelAr: "المكتبة والملفات", labelEn: "Library", descAr: "كل الـ PDFs والملخصات" },
  { href: "/quizzes", iconKey: "quizzes", labelAr: "الكويزات", labelEn: "Quizzes", descAr: "اختبر نفسك بأسلوب الوزارة" },
  { href: "/booking", iconKey: "booking", labelAr: "احجز حصتك", labelEn: "Book", descAr: "مواعيد الحصص المتاحة" },
  { href: "/schedule", iconKey: "schedule", labelAr: "حصصي", labelEn: "My classes", descAr: "حصصك المحجوزة بالتاريخ" },
  { href: "/subscription", iconKey: "subscription", labelAr: "الاشتراك", labelEn: "Subscription", descAr: "من 150 ج.م/شهر — فتح كل المميزات" },
  { href: "/profile", iconKey: "profile", labelAr: "حسابي", labelEn: "Profile", descAr: "بياناتك وإعدادات حسابك" },
];

/** Admin-only destination — prepended for admins. */
export const ADMIN_NAV_ITEM: AppNavItem = {
  href: "/admin",
  iconKey: "admin",
  labelAr: "لوحة الأدمن",
  labelEn: "Admin dashboard",
  descAr: "إدارة المنصة بالكامل",
};

/**
 * Where "home" points for a given role. Admins get their own dashboard so
 * tapping home/logo never kicks them out of the admin context.
 */
export function homeHrefForRole(role?: string | null): string {
  return role === "admin" ? "/admin" : "/";
}

/** Active-state matcher: exact for "/", prefix-aware for nested routes. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Routes where the app chrome (sidebar/top bar/bottom nav) must not render. */
const CHROME_FREE_PREFIXES = ["/auth", "/onboarding"];

export function shouldHideChrome(pathname: string): boolean {
  return CHROME_FREE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Sanitize a `?next=` post-auth redirect target. Only same-origin absolute
 * paths survive ("/lectures/abc"); anything else — including protocol-relative
 * "//evil.com" open-redirects — falls back to "/".
 */
export function sanitizeNextPath(path?: string | null): string {
  if (!path) return "/";
  const p = String(path).trim();
  if (p.startsWith("/") && !p.startsWith("//")) return p;
  return "/";
}
