// GET /api/users/lookup?uuid=<student-uuid>
//
// Privacy-safe peer discovery for «رسائل 💬»: a student who KNOWS a friend's
// uuid (they share it manually — there is deliberately NO public directory)
// can resolve it to a minimal, non-identifying profile before starting a dm.
//
// Returns: { uid, label, isSubscriber, isAdmin }  — never the email.
// Admin SDK does the read because Firestore rules keep users/{uid} readable
// only by owner/admin; this route is a narrow, exact-match lookup window.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { normalizeUuid, peerLabel } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(status: number, error: string, reason: string) {
  return NextResponse.json({ error, reason }, { status });
}

export async function GET(req: NextRequest) {
  // 1) Any signed-in user may look up — the uuid itself is the capability.
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return err(401, "سجل دخولك الأول", "no_auth");
  let myUid = "";
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    myUid = decoded.uid;
  } catch {
    return err(401, "الجلسة غير صالحة — سجل دخول تاني", "bad_token");
  }

  // 2) Validate + normalize the uuid query param.
  const uuid = normalizeUuid(req.nextUrl.searchParams.get("uuid") || "");
  if (uuid.length < 8) return err(400, "الـ UUID غير صالح", "bad_uuid");

  // 3) Exact-match query — never a list/directory.
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await adminDb.collection("users").where("uuid", "==", uuid).limit(1).get();
  } catch (e: any) {
    console.error("uuid lookup failed", e?.message || e);
    return err(500, "تعذر البحث — جرب تاني", "lookup_failed");
  }
  if (snap.empty) return err(404, "مفيش طالب بالـ UUID ده — تأكد منه", "not_found");

  const doc = snap.docs[0];
  const d = doc.data() as any;
  if (doc.id === myUid) return err(400, "ده الـ UUID بتاعك إنت 😄", "self");

  return NextResponse.json({
    uid: doc.id,
    label: peerLabel({ role: d.role, grade: d.grade, track: d.track, uuid: d.uuid }),
    isSubscriber: d.subscribed === true,
    isAdmin: d.role === "admin"
  });
}
