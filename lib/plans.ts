// Central subscription plan catalog — shared by the subscription page
// (client), the checkout API (server), and the webhook (server).
// IMPORTANT: NO secrets in this file — it is imported by client components.

export type PlanId = "starter" | "commitment" | "vip";

export interface Plan {
  id: PlanId;
  nameAr: string;
  nameShort: string;
  priceEgp: number;
  durationDays: number;
  periodAr: string;
  features: string[];
  popular?: boolean;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    nameAr: "انطلاقة",
    nameShort: "انطلاقة",
    priceEgp: 99,
    durationDays: 30,
    periodAr: "30 يوم",
    features: [
      "كل أدوات المذاكرة والملخصات والكويزات",
      "مساعدا الذكاء الاصطناعي (بشمهندس محمد ود. بسملة)",
      "فتح كل مميزات المنصة طول فترة الاشتراك",
    ],
  },
  commitment: {
    id: "commitment",
    nameAr: "التزام",
    nameShort: "التزام",
    priceEgp: 150,
    durationDays: 30,
    periodAr: "30 يوم",
    popular: true,
    features: [
      "كل مميزات خطة انطلاقة",
      "حجز حصص لايف بمواعيد مرنة",
      "أولوية في الرد على الأسئلة",
      "تقارير تقدم أسبوعية",
    ],
  },
  vip: {
    id: "vip",
    nameAr: "VIP",
    nameShort: "VIP",
    priceEgp: 250,
    durationDays: 30,
    periodAr: "30 يوم",
    features: [
      "كل مميزات خطة التزام",
      "جدول مذاكرة مخصوص (خدمة جدولي)",
      "متابعة شخصية من المدرسين",
      "دعم فني على مدار الساعة",
      "خصم 20% على كل الكورسات والمحاضرات",
    ],
  },
};

/** Render/order helper for the pricing page. */
export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.commitment, PLANS.vip];

/** Back-compat default: anything unresolvable maps to starter. */
export const DEFAULT_PLAN: PlanId = "starter";

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

/**
 * Resolve which plan a payment refers to.
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
  if (t.includes("vip") || t.includes("250")) return "vip";
  if (t.includes("commitment") || t.includes("التزام") || t.includes("150")) return "commitment";
  if (t.includes("yearly") || t.includes("1500") || t.includes("سنوي")) return "commitment";
  return DEFAULT_PLAN;
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
 * Subscription end-date math used by the webhook.
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
// One-time products
// ---------------------------------------------------------------------------
export const PLANNER_PRODUCT = {
  kind: "planner50",
  nameAr: "جدول مذاكرة مخصوص — خدمة «جدولي»",
  priceEgp: 50
} as const;

export const LECTURE_PRODUCT = { kind: "lecture" } as const;
export const LECTURE_BUNDLE = {
  kind: "lecture-bundle",
  discountPct: 0.2
} as const;
export const COURSE_PRODUCT = { kind: "course" } as const;

export type PayLoadKind =
  | "plan"
  | typeof PLANNER_PRODUCT.kind
  | typeof LECTURE_PRODUCT.kind
  | typeof LECTURE_BUNDLE.kind
  | typeof COURSE_PRODUCT.kind;

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

export function payLoadField(raw: unknown, key: string): unknown {
  return fieldOf(raw, key);
}

function strField(raw: unknown, key: string): string | undefined {
  const v = fieldOf(raw, key);
  return typeof v === "string" && v ? v : undefined;
}

export function payLoadKind(raw: unknown): PayLoadKind {
  const k = fieldOf(raw, "kind");
  if (k === PLANNER_PRODUCT.kind) return PLANNER_PRODUCT.kind;
  if (k === LECTURE_PRODUCT.kind) return LECTURE_PRODUCT.kind;
  if (k === LECTURE_BUNDLE.kind) return LECTURE_BUNDLE.kind;
  if (k === COURSE_PRODUCT.kind) return COURSE_PRODUCT.kind;
  return "plan";
}

export function requestIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "requestId");
}

export function lectureIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "lectureId");
}

export function subjectIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "subjectId");
}

export function courseIdFromPayLoad(raw: unknown): string | undefined {
  return strField(raw, "courseId");
}
