// POST /api/fatorak-webhook
// Fawaterak "paid transactions webhook" — fires when an invoice becomes paid.
// Docs: https://fawaterak-api.readme.io/reference/web-hook
//
// The `_json` URL suffix makes Fawaterak send JSON (next.config.js rewrites
// /api/fatorak-webhook_json -> /api/fatorak-webhook).
//
// pay_load (echoed from checkout's payLoad) tells us WHAT was paid:
//   { uid, plan }                      → subscription: extend +30d/+365d
//   { uid, kind: "planner50", requestId } → one-time: flip that
//       scheduleRequests doc to paid+pending (NO subscription change)
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { verifyInvoiceWebhookHashKey, verifyExpiryWebhookHashKey } from "@/lib/server/fatorak";
import {
  PLANS,
  PLANNER_PRODUCT,
  computeNewSubscriptionEnd,
  payLoadKind,
  planFromPayLoad,
  requestIdFromPayLoad,
  uidFromPayLoad
} from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Expiry/cancel webhook (fawry/aman/masary): separate body + hash formula.
  // Ack & ignore — no state change (but verify when a hashKey IS present).
  if (data.referenceId && !data.invoice_id) {
    if (data.hashKey && !verifyExpiryWebhookHashKey(data)) {
      console.warn("Fatorak webhook: invalid expiry hashKey");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, ignored: "expiry webhook" });
  }

  // Only successful payments mutate state; everything else is acked-ignored
  // (the documented "failed" webhook carries no hashKey; spoofing it changes
  // nothing on our side).
  if (data.invoice_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: data.invoice_status || "not paid" });
  }

  // MANDATORY authenticity check on the state-changing (paid) path:
  // hashKey = HMAC-SHA256("InvoiceId=..&InvoiceKey=..&PaymentMethod=..")
  //             with the vendor key (FATORAK_SECRET_KEY / FATORAK_WEBHOOK_SECRET).
  if (!verifyInvoiceWebhookHashKey(data)) {
    console.warn("Fatorak webhook: invalid hashKey", { invoice_id: data?.invoice_id });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const rawPayLoad = data.pay_load ?? data.payLoad;
  const uid = uidFromPayLoad(rawPayLoad);
  if (!uid) {
    console.error("Fatorak webhook: paid invoice without uid", { invoice_id: data.invoice_id });
    return NextResponse.json({ error: "missing uid" }, { status: 400 });
  }

  const paymentRecord = {
    invoiceId: data.invoice_id ?? null,
    invoiceKey: data.invoice_key ?? null,
    method: data.payment_method ?? null,
    referenceNumber: data.referenceNumber || null
  };

  return payLoadKind(rawPayLoad) === PLANNER_PRODUCT.kind
    ? handlePlannerPaid({ uid, rawPayLoad, paymentRecord })
    : handleSubscriptionPaid({ uid, rawPayLoad, paymentRecord });
}

// ---------------------------------------------------------------- planner 50
async function handlePlannerPaid(args: {
  uid: string;
  rawPayLoad: unknown;
  paymentRecord: any;
}): Promise<NextResponse> {
  const { uid, rawPayLoad, paymentRecord } = args;
  const requestId = requestIdFromPayLoad(rawPayLoad);
  if (!requestId) {
    console.error("Fatorak webhook: planner payment without requestId");
    return NextResponse.json({ error: "missing requestId" }, { status: 400 });
  }
  const reqRef = adminDb.doc(`scheduleRequests/${requestId}`);
  const nowIso = new Date().toISOString();
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef);
      if (!snap.exists) throw new Error(`scheduleRequest ${requestId} not found`);
      const doc = snap.data() || {};
      if (doc.studentId !== uid) throw new Error(`scheduleRequest ${requestId} uid mismatch`);
      // Idempotent: a retried webhook for the same invoice must not re-apply.
      if (doc?.payment?.invoiceId === paymentRecord.invoiceId || doc.paid === true) {
        return { duplicate: true as const };
      }
      tx.update(reqRef, {
        paid: true,
        status: "pending", // paid → now awaiting admin fulfillment
        payment: { ...paymentRecord, amountEgp: PLANNER_PRODUCT.priceEgp, paidAt: nowIso },
        updatedAt: nowIso
      });
      return { duplicate: false as const };
    });
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ ok: true, kind: PLANNER_PRODUCT.kind, requestId, status: "pending" });
  } catch (e: any) {
    console.error("Fatorak webhook: failed to mark request paid", e);
    return NextResponse.json({ error: "failed to mark request paid" }, { status: 500 });
  }
}

// -------------------------------------------------------------- subscription
async function handleSubscriptionPaid(args: {
  uid: string;
  rawPayLoad: unknown;
  paymentRecord: any;
}): Promise<NextResponse> {
  const { uid, rawPayLoad, paymentRecord } = args;
  const planId = planFromPayLoad(rawPayLoad);
  const plan = PLANS[planId];

  const userRef = adminDb.doc(`users/${uid}`);
  const paymentRef = userRef.collection("payments").doc(String(paymentRecord.invoiceId));
  const now = Date.now();

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const [userSnap, paymentSnap] = await Promise.all([tx.get(userRef), tx.get(paymentRef)]);
      if (paymentSnap.exists) {
        return { duplicate: true as const };
      }
      if (!userSnap.exists) {
        throw new Error(`user ${uid} not found`);
      }
      const userData = userSnap.data() || {};
      const { newEndMs, stacked } = computeNewSubscriptionEnd(
        userData.subscriptionEndDate ?? null,
        userData.subscribed === true,
        now,
        planId
      );
      const newEnd = new Date(newEndMs);
      const nowIso = new Date(now).toISOString();

      tx.set(
        userRef,
        {
          subscribed: true,
          subscriptionStartDate: stacked ? userData.subscriptionStartDate || nowIso : nowIso,
          subscriptionEndDate: newEnd.toISOString(),
          subscriptionPlan: planId,
          lastPayment: {
            ...paymentRecord,
            plan: planId,
            amountEgp: plan.priceEgp,
            paidAt: nowIso
          }
        },
        { merge: true }
      );
      tx.set(paymentRef, {
        uid,
        plan: planId,
        planName: plan.nameAr,
        amountEgp: plan.priceEgp,
        durationDays: plan.durationDays,
        stacked,
        ...paymentRecord,
        paidAt: nowIso,
        createdAt: FieldValue.serverTimestamp()
      });
      return { duplicate: false as const, newEnd: newEnd.toISOString(), plan: planId, stacked };
    });

    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({
      ok: true,
      plan: result.plan,
      stacked: result.stacked,
      subscriptionEndDate: result.newEnd
    });
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
