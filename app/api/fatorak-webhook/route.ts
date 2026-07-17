// POST /api/fatorak-webhook
// Fawaterak "paid transactions webhook" — fires when an invoice becomes paid.
// Docs: https://fawaterak-api.readme.io/reference/web-hook
//
// IMPORTANT: Fawaterak sends the body as JSON if the configured webhook URL
// contains "_json" — that's why next.config.js rewrites
// /api/fatorak-webhook_json -> /api/fatorak-webhook (see checkout route,
// which passes webhookUrl with the _json suffix).
//
// Plan handling: the checkout route stamps payLoad = { uid, plan } when it
// creates the invoice; Fawaterak echoes it back here as pay_load. The plan id
// ("monthly" → +30 days, "yearly" → +365 days) decides how far the
// subscriptionEndDate is extended (lib/plans.ts is the single source of truth).
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { verifyInvoiceWebhookHashKey, verifyExpiryWebhookHashKey } from "@/lib/server/fatorak";
import {
  PLANS,
  computeNewSubscriptionEnd,
  planFromPayLoad,
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

  // Expiry/cancel webhook (fawry/aman/masary): different body shape + its own
  // hash formula (referenceId & PaymentMethod, per docs). We take NO state
  // change for these — verify the signature when present, then ack & ignore.
  if (data.referenceId && !data.invoice_id) {
    if (data.hashKey && !verifyExpiryWebhookHashKey(data)) {
      console.warn("Fatorak webhook: invalid expiry hashKey");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, ignored: "expiry webhook" });
  }

  // We only mutate state on successful payments. Everything else (e.g. the
  // documented "failed payment" webhook — whose example body has NO hashKey)
  // is acknowledged & ignored WITHOUT signature verification, because
  // spoofing it changes nothing on our side.
  if (data.invoice_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: data.invoice_status || "not paid" });
  }

  // Authenticity check — MANDATORY on the state-changing (paid) path:
  // hashKey = HMAC-SHA256("InvoiceId=..&InvoiceKey=..&PaymentMethod=..")
  //             with FATORAK_SECRET_KEY (docs' "vendor key"), verified live
  //             against the published Web Hook page.
  if (!verifyInvoiceWebhookHashKey(data)) {
    console.warn("Fatorak webhook: invalid hashKey", { invoice_id: data?.invoice_id });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Which payment is this? pay_load = the payLoad we sent at checkout time:
  // { uid, plan } — plan decides the extension length (+30d / +365d).
  const rawPayLoad = data.pay_load ?? data.payLoad;
  const uid = uidFromPayLoad(rawPayLoad);
  const planId = planFromPayLoad(rawPayLoad);
  const plan = PLANS[planId];
  if (!uid) {
    console.error("Fatorak webhook: paid invoice without uid", { invoice_id: data.invoice_id });
    return NextResponse.json({ error: "missing uid" }, { status: 400 });
  }

  // Activate/extend the subscription — idempotent: a retried webhook for the
  // same invoiceId must NOT extend the duration a second time.
  const userRef = adminDb.doc(`users/${uid}`);
  const paymentRef = userRef.collection("payments").doc(String(data.invoice_id));
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

      tx.set(
        userRef,
        {
          subscribed: true,
          subscriptionStartDate: stacked
            ? userData.subscriptionStartDate || new Date(now).toISOString()
            : new Date(now).toISOString(),
          subscriptionEndDate: newEnd.toISOString(),
          // Which plan the current active period came from (latest payment wins)
          subscriptionPlan: planId,
          lastPayment: {
            invoiceId: data.invoice_id ?? null,
            invoiceKey: data.invoice_key ?? null,
            method: data.payment_method ?? null,
            referenceNumber: data.referenceNumber || null,
            plan: planId,
            amountEgp: plan.priceEgp,
            paidAt: new Date(now).toISOString()
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
        invoiceId: data.invoice_id ?? null,
        invoiceKey: data.invoice_key ?? null,
        method: data.payment_method ?? null,
        referenceNumber: data.referenceNumber || null,
        paidAt: new Date(now).toISOString(),
        createdAt: FieldValue.serverTimestamp()
      });
      return { duplicate: false as const, newEnd: newEnd.toISOString(), plan: planId, stacked };
    });

    if (result.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
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
