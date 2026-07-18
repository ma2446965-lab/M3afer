// Central subscription plan catalog — shared by the subscription page
// (client), the checkout API (server), and the webhook (server).
// IMPORTANT: NO secrets in this file — it is imported by client components.

export type PlanId = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  nameAr: string; // shown on the card + sent to Fatorak as the cart item name
  priceEgp: number; // cartTotal sent to Fatorak
  durationDays: number; // subscription extension applied by the webhook
  periodAr: string; // copy shown next to the price ("30 يوم" / "12 شهر")
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    nameAr: "اشتراك مِعافر الشهري",
    priceEgp: 150,
    durationDays: 30,
    periodAr: "30 يوم"
  },
  yearly: {
    id: "yearly",
    nameAr: "اشتراك مِعافر السنوي",
    priceEgp: 1500,
    durationDays: 365,
    periodAr: "12 شهر"
  }
};

/** Render/order helper for the pricing page (monthly first). */
export const PLAN_LIST: Plan[] = [PLANS.monthly, PLANS.yearly];

/** Back-compat default: anything unresolvable maps to the shortest plan. */
export const DEFAULT_PLAN: PlanId = "monthly";

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

/**
 * Resolve which plan a payment refers to. Accepts:
 *  - "monthly" | "yearly"                       (current payLoad format)
 *  - legacy ids written by the old checkout     ("monthly-150", "yearly-1500")
 *  - the webhook's pay_load as object OR as a JSON-encoded string
 * Anything unrecognized falls back to `monthly` (the safest, shortest
 * extension) which matches the old webhook behavior for old invoices.
 */
export function planFromPayLoad(raw: unknown): PlanId {
  if (raw && typeof raw === "object") {
    return planFromPayLoad((raw as any).plan ?? (raw as any).planId);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (isPlanId(s)) return s;
    if (s.startsWith("{")) {
      try {
        return planFromPayLoad(JSON.parse(s));
      } catch {
        return legacyMap(s);
      }
    }
    return legacyMap(s);
  }
  return DEFAULT_PLAN;
}

function legacyMap(s: string): PlanId {
  const t = s.toLowerCase();
  // Only an explicit yearly marker upgrades to yearly; anything uncertain
  // stays monthly (shortest extension — the safe side to err on).
  if (t.includes("yearly") || t.includes("1500") || t.includes("سنوي")) return "yearly";
  return DEFAULT_PLAN; // "monthly", "monthly-150", "", junk → monthly
}

/** The Firebase uid travels inside payLoad too — extract it defensively. */
export function uidFromPayLoad(raw: unknown): string | undefined {
  if (raw && typeof raw === "object") {
    const u = (raw as any).uid;
    if (typeof u === "string" && u) return u;
    return undefined;
  }
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      return uidFromPayLoad(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Subscription end-date math used by the webhook:
 *  - subscriber still active → extend FROM the current end date (stacked)
 *  - expired / never subscribed → fresh period starting now
 * Returns the new end timestamp (ms) and whether this was a stacked renewal.
 */
export function computeNewSubscriptionEnd(
  currentEndIso: string | null | undefined,
  currentlySubscribed: boolean,
  nowMs: number,
  planId: PlanId
): { newEndMs: number; stacked: boolean } {
  const currentEndMs = currentEndIso ? new Date(currentEndIso).getTime() : NaN;
  const stillActive =
    currentlySubscribed && Number.isFinite(currentEndMs) && currentEndMs > nowMs;
  const baseMs = stillActive ? currentEndMs : nowMs;
  return {
    newEndMs: baseMs + PLANS[planId].durationDays * DAY_MS,
    stacked: stillActive
  };
}

// ---------------------------------------------------------------------------
// One-time products (flat fee, NOT subscriptions — no subscriptionEndDate is
// touched when these are paid). First product: "جدولي" hand-built study
// planner: student submits an intake form, pays 50 EGP once, admin uploads a
// personalized schedule image back within 24h.
// ---------------------------------------------------------------------------
export const PLANNER_PRODUCT = {
  kind: "planner50",
  nameAr: "جدول مذاكرة مخصوص — خدمة «جدولي 📅»",
  priceEgp: 50
} as const;

// Recorded-video lectures marketplace — per-lecture purchases plus a
// whole-subject bundle at a discount. Prices come from each lecture doc
// (server-read at checkout; nothing client-side is ever trusted).
export const LECTURE_PRODUCT = { kind: "lecture" } as const;
export const LECTURE_BUNDLE = {
  kind: "lecture-bundle",
  /** 20% off the sum of the subject's paid lectures */
  discountPct: 0.2
} as const;

/** pay_load discrimination: legacy subscription invoices carry NO `kind`. */
export type PayLoadKind =
  | "plan"
  | typeof PLANNER_PRODUCT.kind
  | typeof LECTURE_PRODUCT.kind
  | typeof LECTURE_BUNDLE.kind;

function fieldOf(raw: unknown, key: string): unknown {
  if (raw && typeof raw === "object") return (raw as any)[key];
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      return fieldOf(JSON.parse(raw), key);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Generic, shape-tolerant pay_load field reader (object or JSON string). */
export function payLoadField(raw: unknown, key: string): unknown {
  return fieldOf(raw, key);
}

function strField(raw: unknown, key: string): string | undefined {
  const v = fieldOf(raw, key);
  return typeof v === "string" && v ? v : undefined;
}

/** What does this pay_load pay FOR? ("plan" = subscription, else a product) */
export function payLoadKind(raw: unknown): PayLoadKind {
  const k = fieldOf(raw, "kind");
  if (k === PLANNER_PRODUCT.kind) return PLANNER_PRODUCT.kind;
  if (k === LECTURE_PRODUCT.kind) return LECTURE_PRODUCT.kind;
  if (k === LECTURE_BUNDLE.kind) return LECTURE_BUNDLE.kind;
  return "plan";
}

/** scheduleRequests doc id travels in payLoad for the planner product. */
export function requestIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "requestId");
}

/** lecture id travels in payLoad for single-lecture purchases. */
export function lectureIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "lectureId");
}

/** subject id travels in payLoad for whole-subject bundle purchases. */
export function subjectIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "subjectId");
}
