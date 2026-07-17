// POST /api/fatorak-webhook
// Fawaterak "paid transactions webhook" — fires when an invoice becomes paid.
// Docs: https://fawaterak-api.readme.io/reference/web-hook
//
// IMPORTANT: Fawaterak sends the body as JSON if the configured webhook URL
// contains "_json" — that's why next.config.js rewrites
// /api/fatorak-webhook_json -> /api/fatorak-webhook (see checkout route,
// which passes webhookUrl with the _json suffix).
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { verifyWebhookHashKey } from "@/lib/server/fatorak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function parseBody(req: NextRequest): Promise<any | null> {
  const raw = await req.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      const params = new URLSearchParams(raw);
      const obj: Record<string, any> = {};
      params.forEach((v, k) => (obj[k] = v));
      return obj;
    } catch {
      return null;
    }
  }
}

export async function POST(req: NextRequest) {
  const data = await parseBody(req);
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Expiry/cancel webhook (fawry/aman/masary): different body shape, no state
  // change needed on our side — acknowledge and ignore.
  if (data.referenceId && !data.invoice_id) {
    return NextResponse.json({ ok: true, ignored: "expiry webhook" });
  }

  // 1) Authenticity check (hashKey = HMAC-SHA256, see lib/server/fatorak.ts)
  if (!verifyWebhookHashKey(data)) {
    console.warn("Fatorak webhook: invalid hashKey", { invoice_id: data?.invoice_id });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 2) We only act on successful payments (docs: invoice_status === "paid")
  if (data.invoice_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: data.invoice_status || "not paid" });
  }

  // 3) The uid travels in pay_load (we set it as payLoad when creating the invoice)
  const uid: string | undefined = data.pay_load?.uid || data.payLoad?.uid;
  if (!uid) {
    console.error("Fatorak webhook: paid invoice without uid", { invoice_id: data.invoice_id });
    return NextResponse.json({ error: "missing uid" }, { status: 400 });
  }

  // 4) Activate/extend the subscription — idempotent: a retried webhook for
  //    the same invoiceId must NOT extend the duration a second time.
  const userRef = adminDb.doc(`users/${uid}`);
  const paymentRef = userRef.collection("payments").doc(String(data.invoice_id));
  const now = Date.now();

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const [userSnap, paymentSnap] = await Promise.all([tx.get(userRef), tx.get(paymentRef)]);
      if (paymentSnap.exists) {
        return { duplicate: true };
      }
      if (!userSnap.exists) {
        throw new Error(`user ${uid} not found`);
      }
      const userData = userSnap.data() || {};
      const currentEndMs = userData.subscriptionEndDate
        ? new Date(userData.subscriptionEndDate).getTime()
        : 0;
      const currentlyActive = userData.subscribed === true && currentEndMs > now;
      // Extend from the current end date if still active (stacked renewal),
      // otherwise start a fresh 30-day period from now.
      const baseMs = currentlyActive ? currentEndMs : now;
      const newEnd = new Date(baseMs + THIRTY_DAYS_MS);

      tx.set(
        userRef,
        {
          subscribed: true,
          subscriptionStartDate: currentlyActive
            ? userData.subscriptionStartDate || new Date(now).toISOString()
            : new Date(now).toISOString(),
          subscriptionEndDate: newEnd.toISOString(),
          lastPayment: {
            invoiceId: data.invoice_id ?? null,
            invoiceKey: data.invoice_key ?? null,
            method: data.payment_method ?? null,
            referenceNumber: data.referenceNumber || null,
            paidAt: new Date(now).toISOString()
          }
        },
        { merge: true }
      );
      tx.set(paymentRef, {
        uid,
        plan: data.pay_load?.plan || data.payLoad?.plan || "monthly-150",
        invoiceId: data.invoice_id ?? null,
        invoiceKey: data.invoice_key ?? null,
        method: data.payment_method ?? null,
        referenceNumber: data.referenceNumber || null,
        paidAt: new Date(now).toISOString(),
        createdAt: FieldValue.serverTimestamp()
      });
      return { duplicate: false, newEnd: newEnd.toISOString() };
    });

    if (result.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ ok: true, subscriptionEndDate: result.newEnd });
  } catch (e: any) {
    console.error("Fatorak webhook: Firestore update failed", e);
    // 500 so Fawaterak retries instead of losing the payment event
    return NextResponse.json({ error: "failed to activate subscription" }, { status: 500 });
  }
}

// Fawaterak may probe the URL — answer simply.
export async function GET() {
  return NextResponse.json({ ok: true, service: "fatorak-webhook" });
}
