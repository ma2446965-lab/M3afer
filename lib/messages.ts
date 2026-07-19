// ─── Messaging model («رسائل 💬») ──────────────────────────────────────
// Pure helpers shared by the messages page, the admin support composer and
// the /api/users/lookup route — no React/Firebase imports → unit-testable.
//
// Data model (firestore.rules enforces it):
//   conversations/{convId}
//     members: [uidA, uidB]          — always exactly 2
//     type: "dm" | "support"         — dm = subscriber↔subscriber,
//                                      support = admin↔any user (paid or not)
//     memberLabels: { [uid]: label } — privacy-safe display (NO emails)
//     lastMessageText, lastMessageAt, createdAt
//   conversations/{convId}/messages/{msgId}  — create-only
//     senderId, text (≤2000 chars), fromPlatform, createdAt

export const MAX_MESSAGE_LEN = 2000;
export const PLATFORM_NAME = "مِعافر 🤖";
export const SUPPORT_LABEL = "دعم مِعافر 🛡️";

export type ConversationType = "dm" | "support";

export interface ConversationDoc {
  members: string[];
  type: ConversationType;
  memberLabels: Record<string, string>;
  lastMessageText: string;
  lastMessageAt: string;
  createdAt: string;
}

/** Deterministic dm id — same pair of users always maps to one thread. */
export function dmConvId(uidA: string, uidB: string): string {
  return `dm_${[uidA, uidB].sort().join("_")}`;
}

/** One support thread per student — the admin always lands in the same room. */
export function supportConvId(studentUid: string): string {
  return `support_${studentUid}`;
}

/** The other participant in a 2-member conversation ("" if not found). */
export function peerUidOf(conv: { members: string[] }, myUid: string): string {
  return conv.members.find((m) => m !== myUid) || "";
}

/** Client-side mirror of the rules' text constraint. */
export function validateMessageText(text: string): { ok: boolean; reason: string } {
  const t = (text || "").trim();
  if (t.length === 0) return { ok: false, reason: "اكتب رسالة الأول ✍️" };
  if (t.length > MAX_MESSAGE_LEN)
    return { ok: false, reason: `الرسالة أطول من ${MAX_MESSAGE_LEN} حرف — قصّرها شوية` };
  return { ok: true, reason: "" };
}

/**
 * Privacy-safe display label for a conversation peer. Built ONLY from
 * non-identifying profile fields — never the email (the uuid tail is the
 * discriminator students share with friends anyway).
 */
export function peerLabel(p: {
  role?: string | null;
  grade?: string | null;
  track?: string | null;
  uuid?: string | null;
}): string {
  if (p.role === "admin") return SUPPORT_LABEL;
  const tail = (p.uuid || "").replace(/-/g, "").slice(-4);
  const tag = tail ? ` #${tail}` : "";
  if (p.grade) {
    return `طالب • ${p.grade}${p.track ? ` • ${p.track}` : ""}${tag}`;
  }
  return `طالب مِعافر${tag}`;
}

/** Short preview for the conversation list (single line, capped). */
export function previewText(text: string, max = 60): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** Who's allowed to START a conversation of each type (rules mirror this). */
export function canStartConversation(opts: {
  type: ConversationType;
  isAdmin: boolean;
  isSubscriber: boolean;
  peerIsAdmin: boolean;
  peerIsSubscriber: boolean;
}): { ok: boolean; reason: string } {
  const { type, isAdmin, isSubscriber, peerIsAdmin, peerIsSubscriber } = opts;
  if (type === "support") {
    // Support rooms are opened BY the admin, with anyone.
    return isAdmin
      ? { ok: true, reason: "" }
      : { ok: false, reason: "محادثات الدعم بيفتحها الأدمن بس" };
  }
  // dm: BOTH sides must be subscribers — the rules verify both users docs;
  // there is no admin bypass (an admin reaches students via support rooms).
  if (!isSubscriber) return { ok: false, reason: "المراسلة بين الطلاب للمشتركين بس ✨" };
  if (peerIsAdmin && !peerIsSubscriber) return { ok: false, reason: "ده حساب إدارة — الإدارة بتكلمك من دعم مِعافر 🛡️" };
  if (!peerIsSubscriber) return { ok: false, reason: "الطالب ده مش مشترك — مش هينفع تراسله دلوقتي" };
  return { ok: true, reason: "" };
}

/** Sort conversations newest-first (client-side — avoids a composite index). */
export function sortConversations<T extends { lastMessageAt?: string; createdAt?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    String(b.lastMessageAt || b.createdAt || "").localeCompare(String(a.lastMessageAt || a.createdAt || ""))
  );
}

/** Normalize a uuid for lookup (strip spaces/dashes, lowercase). */
export function normalizeUuid(input: string): string {
  return (input || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}
