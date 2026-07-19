// POST /api/fatorak-webhook
// Fawaterak "paid transactions webhook" — fires when an invoice becomes paid.
// Docs: https://fawaterak-api.readme.io/reference/web-hook
//
// The `_json` URL suffix makes Fawaterak send JSON (next.config.js rewrites
// /api/fatorak-webhook_json -> /api/fatorak-webhook).
//
// pay_load (echoed from checkout's payLoad) tells us WHAT was paid:
//   { uid, plan }                             → subscription: extend +30d/+365d
//   { uid, kind:"planner50", requestId }      → flip scheduleRequests doc
//   { uid, kind:"lecture", lectureId }        → create lecturePurchases doc
//   { uid, kind:"lecture-bundle", subjectId } → create lecturePurchases for
//        every eligible (published+paid) lecture of that subject
// All writes are idempotent & transaction-safe; nothing here relies on the
// client having done anything correctly.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { verifyInvoiceWebhookHashKey, verifyExpiryWebhookHashKey } from "@/lib/server/fatorak";
import {
  PLANS,
  PLANNER_PRODUCT,
  LECTURE_PRODUCT,
  LECTURE_BUNDLE,
  COURSE_PRODUCT,
  computeNewSubscriptionEnd,
  courseIdFromPayLoad,
  lectureIdFromPayLoad,
  payLoadKind,
  planFromPayLoad,
  requestIdFromPayLoad,
  subjectIdFromPayLoad,
  uidFromPayLoad
} from "@/lib/plans";
import { isFreeLecture, purchaseId, LECTURES_COL, PURCHASES_COL } from "@/lib/lectures";
import { COURSES_COL, COURSE_PURCHASES_COL, coursePurchaseId } from "@/lib/courses";

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
  if (data.referenceId && !data.invoice_id) {
    if (data.hashKey && !verifyExpiryWebhookHashKey(data)) {
      console.warn("Fatorak webhook: invalid expiry hashKey");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, ignored: "expiry webhook" });
  }

  // Only successful payments mutate state; everything else is acked-ignored.
  if (data.invoice_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: data.invoice_status || "not paid" });
  }

  // MANDATORY authenticity check on the state-changing (paid) path:
  // hashKey = HMAC-SHA256("InvoiceId=..&InvoiceKey=..&PaymentMethod=..")
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
  const kind = payLoadKind(rawPayLoad);

  if (kind === PLANNER_PRODUCT.kind) return handlePlannerPaid({ uid, rawPayLoad, paymentRecord });
  if (kind === LECTURE_PRODUCT.kind) return handleLecturePaid({ uid, rawPayLoad, paymentRecord });
  if (kind === LECTURE_BUNDLE.kind) return handleBundlePaid({ uid, rawPayLoad, paymentRecord });
  if (kind === COURSE_PRODUCT.kind) return handleCoursePaid({ uid, rawPayLoad, paymentRecord });
  return handleSubscriptionPaid({ uid, rawPayLoad, paymentRecord });
}

// -------------------------------------------------------------- planner 50
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
      if (doc?.payment?.invoiceId === paymentRecord.invoiceId || doc.paid === true) {
        return { duplicate: true as const };
      }
      tx.update(reqRef, {
        paid: true,
        status: "pending",
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

// --------------------------------------------------- single lecture purchase
async function grantLecture(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  lectureId: string,
  paymentRecord: any,
  lectureCache?: Map<string, any>
): Promise<"created" | "exists" | "skipped"> {
  const pRef = adminDb.collection(PURCHASES_COL).doc(purchaseId(lectureId, uid));
  const pSnap = await tx.get(pRef);
  if (pSnap.exists) return "exists";
  // Lecture snapshot for denormalized title/price (helps admin views).
  let lec = lectureCache?.get(lectureId);
  if (lec === undefined) {
    const lSnap = await tx.get(adminDb.collection(LECTURES_COL).doc(lectureId));
    lec = lSnap.exists ? lSnap.data() : null;
    lectureCache?.set(lectureId, lec);
  }
  tx.set(pRef, {
    studentId: uid,
    lectureId,
    subjectId: lec?.subjectId ?? null,
    courseId: lec?.courseId ?? null,
    lectureTitle: lec?.title ?? null,
    priceEgp: typeof lec?.priceEgp === "number" ? lec.priceEgp : null,
    grantedBy: "fatorak-webhook",
    payment: { ...paymentRecord, paidAt: new Date().toISOString() },
    createdAt: FieldValue.serverTimestamp()
  });
  return "created";
}

async function handleLecturePaid(args: {
  uid: string;
  rawPayLoad: unknown;
  paymentRecord: any;
}): Promise<NextResponse> {
  const { uid, rawPayLoad, paymentRecord } = args;
  const lectureId = lectureIdFromPayLoad(rawPayLoad);
  if (!lectureId) {
    console.error("Fatorak webhook: lecture payment without lectureId");
    return NextResponse.json({ error: "missing lectureId" }, { status: 400 });
  }
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const r = await grantLecture(tx, uid, lectureId, paymentRecord, new Map());
      return { result: r };
    });
    if (result.result === "exists") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ ok: true, kind: LECTURE_PRODUCT.kind, lectureId, granted: true });
  } catch (e: any) {
    console.error("Fatorak webhook: failed to grant lecture", e);
    return NextResponse.json({ error: "failed to grant lecture" }, { status: 500 });
  }
}

// ----------------------------------------------------- whole-subject bundle
async function handleBundlePaid(args: {
  uid: string;
  rawPayLoad: unknown;
  paymentRecord: any;
}): Promise<NextResponse> {
  const { uid, rawPayLoad, paymentRecord } = args;
  const subjectId = subjectIdFromPayLoad(rawPayLoad);
  if (!subjectId) {
    console.error("Fatorak webhook: bundle payment without subjectId");
    return NextResponse.json({ error: "missing subjectId" }, { status: 400 });
  }
  try {
    // Eligibility = the same rule the checkout quoted: published + paid
    // lectures of the subject (grants for already-owned ones are skipped
    // idempotently inside the transaction).
    const lecSnap = await adminDb
      .collection(LECTURES_COL)
      .where("subjectId", "==", subjectId)
      .get();
    const eligible = lecSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((l) => l.published !== false && !isFreeLecture(l));
    if (eligible.length === 0) {
      return NextResponse.json({ ok: true, granted: 0, note: "no eligible lectures" });
    }
    const result = await adminDb.runTransaction(async (tx) => {
      const cache = new Map<string, any>(eligible.map((l) => [l.id, l]));
      let granted = 0;
      for (const l of eligible) {
        const r = await grantLecture(tx, uid, l.id, paymentRecord, cache);
        if (r === "created") granted++;
      }
      return { granted, total: eligible.length };
    });
    return NextResponse.json({
      ok: true,
      kind: LECTURE_BUNDLE.kind,
      subjectId,
      granted: result.granted,
      total: result.total,
      duplicate: result.granted === 0
    });
  } catch (e: any) {
    console.error("Fatorak webhook: failed to grant bundle", e);
    return NextResponse.json({ error: "failed to grant bundle" }, { status: 500 });
  }
}

// --------------------------------------------------------- whole-course buy
// FAN-OUT (confirmed model): grant every published+paid lecture of the
// course in lecturePurchases (idempotent by deterministic doc id) so media
// access flows through the SAME single ownership collection, then write a
// coursePurchases audit receipt.
async function handleCoursePaid(args: {
  uid: string;
  rawPayLoad: unknown;
  paymentRecord: any;
}): Promise<NextResponse> {
  const { uid, rawPayLoad, paymentRecord } = args;
  const courseId = courseIdFromPayLoad(rawPayLoad);
  if (!courseId) {
    console.error("Fatorak webhook: course payment without courseId");
    return NextResponse.json({ error: "missing courseId" }, { status: 400 });
  }
  try {
    const [cSnap, lecSnap] = await Promise.all([
      adminDb.collection(COURSES_COL).doc(courseId).get(),
      adminDb.collection(LECTURES_COL).where("courseId", "==", courseId).get()
    ]);
    const course = cSnap.exists ? cSnap.data() : null;
    const eligible = lecSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((l) => l.published !== false && !isFreeLecture(l));
    if (eligible.length === 0) {
      return NextResponse.json({ ok: true, granted: 0, note: "no eligible lectures in course" });
    }
    const result = await adminDb.runTransaction(async (tx) => {
      const cache = new Map<string, any>(eligible.map((l) => [l.id, l]));
      let granted = 0;
      const grantedIds: string[] = [];
      for (const l of eligible) {
        const r = await grantLecture(tx, uid, l.id, paymentRecord, cache);
        if (r === "created") {
          granted++;
          grantedIds.push(l.id);
        }
      }
      // Audit receipt — deterministic id → webhook retries upsert the same doc.
      const aRef = adminDb.collection(COURSE_PURCHASES_COL).doc(coursePurchaseId(courseId, uid));
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) {
        tx.set(aRef, {
          studentId: uid,
          courseId,
          courseTitle: course?.title ?? null,
          grantedLectureIds: eligible.map((l) => l.id),
          grantedCount: eligible.length,
          priceEgpPaid: null, // amount lives in payment.invoiceId ↔ Fatorak dashboard
          grantedBy: "fatorak-course-webhook",
          payment: { ...paymentRecord, paidAt: new Date().toISOString() },
          createdAt: FieldValue.serverTimestamp()
        });
      }
      return { granted, grantedIds, total: eligible.length, receiptExisted: aSnap.exists };
    });
    return NextResponse.json({
      ok: true,
      kind: COURSE_PRODUCT.kind,
      courseId,
      granted: result.granted,
      grantedIds: result.grantedIds,
      total: result.total,
      duplicate: result.granted === 0 && result.receiptExisted
    });
  } catch (e: any) {
    console.error("Fatorak webhook: failed to grant course", e);
    return NextResponse.json({ error: "failed to grant course" }, { status: 500 });
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
