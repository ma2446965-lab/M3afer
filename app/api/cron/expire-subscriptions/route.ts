// GET /api/cron/expire-subscriptions
// Scheduled job (Vercel Cron — see vercel.json): flips subscribed=false for
// every user whose subscriptionEndDate has passed.
// Protected by CRON_SECRET: Vercel sends "Authorization: Bearer <CRON_SECRET>".
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer $CRON_SECRET
  const authHeader = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();
    const snap = await adminDb.collection("users").where("subscribed", "==", true).get();

    const expired: string[] = [];
    let batch = adminDb.batch();
    let ops = 0;
    const commits: Promise<FirebaseFirestore.WriteResult[]>[] = [];

    for (const docSnap of snap.docs) {
      const end = docSnap.data().subscriptionEndDate;
      if (typeof end === "string" && end && end < nowIso) {
        batch.set(docSnap.ref, { subscribed: false }, { merge: true });
        expired.push(docSnap.id);
        ops++;
        if (ops >= 450) {
          commits.push(batch.commit());
          batch = adminDb.batch();
          ops = 0;
        }
      }
    }
    if (ops > 0) commits.push(batch.commit());
    await Promise.all(commits);

    console.log(`expire-subscriptions: expired ${expired.length} user(s)`);
    return NextResponse.json({ ok: true, expired: expired.length });
  } catch (e: any) {
    console.error("expire-subscriptions failed", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
