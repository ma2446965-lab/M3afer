// Pure lecture-marketplace helpers — shared by checkout/webhook (server) and
// the /lectures pages + admin panel (client). No secrets; unit-tested.

export interface LectureLike {
  id?: string;
  subjectId?: string;
  priceEgp?: number;
  isFreePreview?: boolean;
  published?: boolean;
}

export const LECTURES_COL = "lectures";
export const PURCHASES_COL = "lecturePurchases";

/** Deterministic, rule-friendly purchase document id ("<lectureId>_<uid>"). */
export const purchaseId = (lectureId: string, uid: string): string =>
  `${lectureId}_${uid}`;

/** Free = price 0/missing (open to everyone) OR flagged as free preview. */
export const isFreeLecture = (l: LectureLike | null | undefined): boolean =>
  !l || typeof l.priceEgp !== "number" || !(l.priceEgp > 0) || l.isFreePreview === true;

/** Accepts watch?v=, youtu.be/, /embed/, /shorts/, /live/ URLs or a bare id. */
export function parseYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const s = url.trim();
  const m =
    s.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/) ||
    s.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

export interface BundleQuote {
  subjectId: string;
  lectureIds: string[];
  count: number;
  grossEgp: number;
  discountPct: number;
  totalEgp: number;
  savedEgp: number;
}

/**
 * Whole-subject bundle quote: every PUBLISHED, PAID lecture of the subject
 * that the student does NOT already own, discounted by `discountPct`
 * (rounded to the nearest pound, min 1). Returns null when nothing is
 * purchasable (all owned / all free / none published).
 */
export function computeBundleQuote(
  lectures: LectureLike[],
  subjectId: string,
  ownedLectureIds: Set<string>,
  discountPct: number
): BundleQuote | null {
  const eligible = lectures.filter(
    (l) =>
      !!l &&
      !!l.id &&
      (l.subjectId || "") === subjectId &&
      l.published !== false &&
      !isFreeLecture(l) &&
      !ownedLectureIds.has(l.id)
  );
  if (eligible.length === 0) return null;
  const gross = eligible.reduce((sum, l) => sum + Math.max(0, Number((l as any).priceEgp) || 0), 0);
  const total = Math.max(1, Math.round(gross * (1 - discountPct)));
  return {
    subjectId,
    lectureIds: eligible.map((l) => l.id as string),
    count: eligible.length,
    grossEgp: gross,
    discountPct,
    totalEgp: total,
    savedEgp: gross - total
  };
}
