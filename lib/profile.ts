// Pure profile helpers — shared by AuthContext (client) and unit tests.
// Firestore docs are data, not a guaranteed shape: admin/support accounts are
// typically created BY HAND in the Firebase console, so their users/{uid} doc
// may contain only { role: "admin" } and lack every student field (email,
// uuid, grade, streak...). Pages used to trust the cast shape and crashed at
// render — e.g. /profile did `profile.email[0].toUpperCase()` → TypeError
// "Cannot read properties of undefined (reading '0')" — the "Application
// error: a client-side exception has occurred" admins saw.
//
// normalizeProfile() makes ANY users/{uid} doc safe to render everywhere.

export interface UserProfile {
  uid: string;
  email: string;
  uuid: string;
  grade: string | null;
  track: string | null;
  role: "user" | "admin";
  subscription: "free" | "basic" | "pro" | "premium";
  subscriptionActive: boolean;
  /** New canonical paid flag — set automatically by the Fatorak webhook */
  subscribed?: boolean;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  /** Which plan the current active period came from (webhook-stamped) */
  subscriptionPlan?: string | null;
  streak: number;
  lastActiveDate: string | null;
  weeklySubjects: string[];
  preferredPersona: "ing.Mohamed" | "Dr.Basmala";
  createdAt: string;
}

const SUBSCRIPTIONS: UserProfile["subscription"][] = ["free", "basic", "pro", "premium"];

const asStr = (v: unknown, fb = ""): string => (typeof v === "string" && v.length > 0 ? v : fb);
const asStrOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/**
 * In-memory normalization ONLY (no Firestore writes): fills every field with
 * a safe default when missing/wrong-typed, preferring the auth-session email
 * for docs that don't store it (typical for hand-made admin docs).
 */
export function normalizeProfile(
  data: Record<string, any> | null | undefined,
  uid: string,
  emailFallback?: string | null
): UserProfile {
  const d = data || {};
  return {
    uid: asStr(d.uid, uid),
    email: asStr(d.email, emailFallback || ""),
    uuid: asStr(d.uuid, "—"),
    grade: asStrOrNull(d.grade),
    track: asStrOrNull(d.track),
    role: d.role === "admin" ? "admin" : "user",
    subscription: SUBSCRIPTIONS.includes(d.subscription) ? d.subscription : "free",
    subscriptionActive: d.subscriptionActive === true,
    subscribed: d.subscribed === true,
    subscriptionStartDate: asStrOrNull(d.subscriptionStartDate),
    subscriptionEndDate: asStrOrNull(d.subscriptionEndDate),
    subscriptionPlan: asStrOrNull(d.subscriptionPlan),
    streak: typeof d.streak === "number" && Number.isFinite(d.streak) ? d.streak : 0,
    lastActiveDate: asStrOrNull(d.lastActiveDate),
    weeklySubjects: Array.isArray(d.weeklySubjects)
      ? d.weeklySubjects.filter((x: unknown) => typeof x === "string")
      : [],
    preferredPersona: d.preferredPersona === "Dr.Basmala" ? "Dr.Basmala" : "ing.Mohamed",
    createdAt: asStr(d.createdAt, new Date(0).toISOString())
  };
}
