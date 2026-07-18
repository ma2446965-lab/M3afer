// POST /api/fatorak/checkout
// Verifies the student's Firebase ID token, then creates a Fawaterak e-invoice
// link (SendPayment/createInvoiceLink) and returns its hosted-payment URL.
//
// TWO purchase modes (same Fatorak flow):
//   { plan: "monthly" | "yearly" }                       → subscription
//   { product: "planner50", requestId: "<doc id>" }      → one-time 50 EGP
//      "جدولي" planner service; the scheduleRequests doc must exist, belong
//      to this uid, and be unpaid (all verified here server-side).
//
// Plans/prices live in lib/plans.ts (single source of truth).
// Error responses carry a machine-readable `reason` + upstream excerpt (the
// same info is logged server-side for Vercel Runtime Logs).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { CREATE_INVOICE_PATH, fatorakPost } from "@/lib/server/fatorak";
import {
  DEFAULT_PLAN,
  isPlanId,
  PLANS,
  PLANNER_PRODUCT,
  type PlanId
} from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cap long upstream bodies so the JSON response stays readable. */
function excerpt(v: unknown, max = 800): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

const err = (status: number, error: string, reason: string, extra: object = {}) =>
  NextResponse.json({ error, reason, ...extra }, { status });

export async function POST(req: NextRequest) {
  // 1) Verify the Firebase ID token (same pattern as /api/gemini)
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return err(401, "مطلوب تسجيل الدخول", "no_auth");
  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email || "";
  } catch {
    return err(401, "الجلسة غير صالحة — سجل دخول تاني", "bad_token");
  }

  // 2) Parse the purchase request (empty body = monthly plan, back-compat)
  const rawBody = (await req.text().catch(() => "")) || "";
  let parsed: any = {};
  if (rawBody.trim()) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return err(400, "طلب غير صالح", "bad_json");
    }
  }
  const origin = req.headers.get("origin") || new URL(req.url).origin;

  let amountEgp: number;
  let itemName: string;
  let payLoad: Record<string, string>;
  let redirectBase: string;
  let mode: "plan" | "planner50";

  if (parsed?.product != null) {
    // ---- One-time product: the 50 EGP "جدولي" planner service ----
    if (parsed.product !== PLANNER_PRODUCT.kind) {
      return err(400, "منتج غير معروف", "unknown_product");
    }
    mode = PLANNER_PRODUCT.kind;
    const requestId = typeof parsed.requestId === "string" ? parsed.requestId : "";
    if (!requestId) return err(400, "رقم الطلب ناقص", "missing_request_id");

    // Server-side ownership/state gate — a payable link is only created for a
    // real, unpaid request that belongs to this uid.
    let reqData: any;
    try {
      const snap = await adminDb.doc(`scheduleRequests/${requestId}`).get();
      reqData = snap.exists ? snap.data() : null;
    } catch (e: any) {
      console.error("checkout: failed to load scheduleRequest", e);
      return err(500, "تعذر التحقق من الطلب", "request_lookup_failed");
    }
    if (!reqData) return err(404, "الطلب غير موجود", "request_not_found");
    if (reqData.studentId !== uid) return err(403, "الطلب ده مش بتاعك", "not_owner");
    if (reqData.paid === true || reqData.status !== "awaiting_payment") {
      return err(409, "الطلب ده مدفوع بالفعل", "already_paid");
    }
    if (typeof reqData.intake?.fullName !== "string" || reqData.intake.fullName.trim().length < 2) {
      return err(400, "بيانات الفورم ناقصة — كمّلها الأول", "incomplete_intake");
    }

    amountEgp = PLANNER_PRODUCT.priceEgp;
    itemName = PLANNER_PRODUCT.nameAr;
    payLoad = { uid, kind: PLANNER_PRODUCT.kind, requestId };
    redirectBase = `${origin}/planner`;
  } else {
    // ---- Subscription plans (default) ----
    mode = "plan";
    let planId: PlanId = DEFAULT_PLAN;
    if (parsed?.plan != null) {
      if (!isPlanId(parsed.plan)) return err(400, "خطة غير معروفة", "unknown_plan");
      planId = parsed.plan;
    }
    const plan = PLANS[planId];
    amountEgp = plan.priceEgp;
    itemName = `${plan.nameAr} — ${plan.durationDays} يوم`;
    payLoad = { uid, plan: plan.id };
    redirectBase = `${origin}/subscription`;
  }

  // 3) Build the invoice request — field types mirror the official SendPayment
  //    docs sample (amounts as strings; customer first/last name mandatory).
  const invoiceReq = {
    cartTotal: String(amountEgp),
    currency: "EGP",
    customer: {
      first_name: "Meafer",
      last_name: "Student",
      email: email || "student@meafer.app",
      customer_unique_id: uid
    },
    cartItems: [{ name: itemName, price: String(amountEgp), quantity: "1" }],
    // Echoed back as pay_load in the paid webhook (tells us WHICH plan or
    // WHICH one-time product + requestId was paid, and for WHICH uid).
    payLoad,
    redirectionUrls: {
      successUrl: `${redirectBase}?payment=success`,
      failUrl: `${redirectBase}?payment=failed`,
      pendingUrl: `${redirectBase}?payment=pending`,
      webhookUrl: `${origin}/api/fatorak-webhook_json`
    },
    sendEmail: false,
    sendSMS: false
  };

  try {
    const res = await fatorakPost(CREATE_INVOICE_PATH, invoiceReq);
    const data = await res.json().catch(() => null);
    const url: string | undefined =
      data?.data?.url || data?.data?.payment_url || data?.url || undefined;
    if (!res.ok || !url) {
      console.error("Fatorak createInvoiceLink failed", { status: res.status, mode, response: data });
      return err(502, "تعذر إنشاء رابط الدفع — حاول كمان شوية", "create_invoice_failed", {
        upstream: { status: res.status, body: excerpt(data) }
      });
    }
    return NextResponse.json({
      url,
      invoiceId: data?.data?.invoiceId ?? data?.invoiceId ?? null,
      invoiceKey: data?.data?.invoiceKey ?? data?.invoiceKey ?? null,
      mode,
      amountEgp
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    console.error("Fatorak checkout error:", msg);
    if (msg.includes("Missing env var")) {
      return err(500, "خدمة الدفع غير مفعلة حاليًا (ناقص إعدادات)", "missing_env", {
        upstream: { body: excerpt(msg, 200) }
      });
    }
    if (msg.includes("token request failed")) {
      return err(502, "تعذر الاتصال ببوابة الدفع — حاول كمان شوية", "oauth_token_failed", {
        upstream: { body: excerpt(msg, 500) }
      });
    }
    return err(500, "خطأ غير متوقع", "unexpected", { upstream: { body: excerpt(msg, 300) } });
  }
}
