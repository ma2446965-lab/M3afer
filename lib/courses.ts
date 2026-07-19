// Pure courses helpers — shared by the admin «الكورسات 📦» tab, the future
// /courses storefront, and the checkout/webhook course flow. No Firebase or
// React imports → unit-testable.
//
// Confirmed product decisions (2026-07-19):
//  • Ownership model = FAN-OUT: buying a course makes the Fatorak webhook
//    grant each of its lectures in lecturePurchases/{lectureId}_{uid}
//    (exactly the existing bundle pattern) + a coursePurchases audit doc.
//    Media rules stay untouched; one ownership source everywhere.
//  • A course's price is COMPUTED from its member lectures × discountPct —
//    the same single pricing engine as subject bundles, never a client-
//    supplied field.
import { isFreeLecture, type LectureLike } from "./lectures";

export interface CourseLike {
  id?: string;
  title?: string;
  subjectId?: string;
  subjectName?: string;
  teacherName?: string;
  description?: string;
  thumbnailPath?: string;
  discountPct?: number;
  published?: boolean;
  order?: number;
  lectureCount?: number;
  createdAt?: string;
}

export const COURSES_COL = "courses";
export const COURSE_PURCHASES_COL = "coursePurchases";
export const PROGRESS_COL = "lectureProgress";

export const DEFAULT_COURSE_DISCOUNT_PCT = 0.2;
/** Admin slider ceiling — never let a course discount eat more than half. */
export const COURSE_DISCOUNT_CAP = 0.5;

/** Deterministic audit/receipt doc id (\"<courseId>_<uid>\") — retry-safe. */
export const coursePurchaseId = (courseId: string, uid: string): string =>
  `${courseId}_${uid}`;

/** Clamp/normalize any admin-supplied discount into [0, 0.5]; junk → default. */
export function sanitizeDiscountPct(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || isNaN(n) || !isFinite(n)) return DEFAULT_COURSE_DISCOUNT_PCT;
  if (n < 0) return 0;
  if (n > COURSE_DISCOUNT_CAP) return COURSE_DISCOUNT_CAP;
  return n;
}

/** Admin draft validation for course create/edit forms (rules mirror it). */
export function validateCourseDraft(d: {
  title?: string;
  subjectName?: string;
  teacherName?: string;
  description?: string;
}): { ok: boolean; reason: string } {
  const title = (d.title || "").trim();
  if (title.length < 3) return { ok: false, reason: "اسم الكورس قصير — 3 أحرف على الأقل" };
  if (title.length > 90) return { ok: false, reason: "اسم الكورس طويل — 90 حرف كحد أقصى" };
  if ((d.teacherName || "").length > 60) return { ok: false, reason: "اسم المدرس طويل — 60 حرف كحد أقصى" };
  if ((d.description || "").length > 600) return { ok: false, reason: "الوصف طويل — 600 حرف كحد أقصى" };
  return { ok: true, reason: "" };
}

export interface CourseQuote {
  courseId: string;
  lectureIds: string[];
  count: number;
  grossEgp: number;
  discountPct: number;
  totalEgp: number;
  savedEgp: number;
}

/**
 * Course-bundle quote: every PUBLISHED, PAID lecture OF THE COURSE the
 * student does NOT already own, discounted by the course's discountPct
 * (nearest pound, min 1). Same math as computeBundleQuote, scoped by
 * courseId. Returns null when nothing is purchasable (all owned / all
 * free / none published) → checkout answers 409 nothing_to_buy.
 */
export function computeCourseQuote(
  lectures: (LectureLike & { courseId?: string })[],
  courseId: string,
  ownedLectureIds: Set<string>,
  discountPct: number
): CourseQuote | null {
  const eligible = lectures.filter(
    (l) =>
      !!l &&
      !!l.id &&
      (l.courseId || "") === courseId &&
      l.published !== false &&
      !isFreeLecture(l) &&
      !ownedLectureIds.has(l.id)
  );
  if (eligible.length === 0) return null;
  const gross = eligible.reduce((sum, l) => sum + Math.max(0, Number((l as any).priceEgp) || 0), 0);
  const total = Math.max(1, Math.round(gross * (1 - discountPct)));
  return {
    courseId,
    lectureIds: eligible.map((l) => l.id as string),
    count: eligible.length,
    grossEgp: gross,
    discountPct,
    totalEgp: total,
    savedEgp: gross - total
  };
}

/** Lecture order inside a course: `order` asc (unset last), then createdAt.
 *  Client-side on purpose — avoids a courseId+order composite index. */
export function sortCourseLectures<T extends { order?: number; createdAt?: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      (a.order ?? 999) - (b.order ?? 999) ||
      String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
}

/** Catalog ordering for course cards (same discipline as lectures). */
export function sortCourses<T extends { order?: number; createdAt?: string }>(list: T[]): T[] {
  return sortCourseLectures(list);
}

/** "3 of 8 watched" → 38 (%). Total 0 → 0 (never NaN). */
export function progressPercent(watchedCount: number, totalCount: number): number {
  if (!totalCount || totalCount <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, watchedCount) / totalCount) * 100));
}

/** Swap-target for ↑/↓ reordering: returns [movedId, neighborId] or null. */
export function reorderNeighbor(
  sortedIds: string[],
  id: string,
  dir: "up" | "down"
): [string, string] | null {
  const i = sortedIds.indexOf(id);
  if (i < 0) return null;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sortedIds.length) return null;
  return [sortedIds[i], sortedIds[j]];
}
