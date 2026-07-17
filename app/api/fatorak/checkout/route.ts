// POST /api/fatorak/checkout
// Verifies the student's Firebase ID token, then creates a Fawaterak e-invoice
// link (SendPayment/createInvoiceLink) for the selected plan and returns its
// URL so the client can redirect the student to the hosted payment page.
//
// Plans/prices/durations live in lib/plans.ts (single source of truth).
// Auth to Fatorak: OAuth 2.0 client_credentials access token (cached +
// auto-refreshed in lib/server/fatorak.ts) sent as Bearer.
//
// Error responses carry a machine-readable `reason` plus an excerpt of the
// upstream Fatorak response so integration failures can be diagnosed from the
// outside (the same info is also logged server-side for Vercel Runtime Logs).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/server/firebase-admin";
import { CREATE_INVOICE_PATH, fatorakPost } from "@/lib/server/fatorak";
import { DEFAULT_PLAN, isPlanId, PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cap long upstream bodies so the JSON response stays readable. */
function excerpt(v: unknown, max = 800): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function POST(req: NextRequest) {
  // 1) Verify the Firebase ID token (same pattern as /api/gemini)
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json(
      { error: "مطلوب تسجيل الدخول", reason: "no_auth" },
      { status: 401 }
    );
  }
  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email || "";
  } catch {
    return NextResponse.json(
      { error: "الجلسة غير صالحة — سجل دخول تاني", reason: "bad_token" },
      { status: 401 }
    );
  }

  // 2) Which plan? (body optional — empty body = monthly, same as before)
  let planId: PlanId = DEFAULT_PLAN;
  const rawBody = (await req.text().catch(() => "")) || "";
  if (rawBody.trim()) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "طلب غير صالح", reason: "bad_json" },
        { status: 400 }
      );
    }
    if (parsed?.plan != null) {
      if (!isPlanId(parsed.plan)) {
        return NextResponse.json(
          { error: "خطة غير معروفة", reason: "unknown_plan" },
          { status: 400 }
        );
      }
      planId = parsed.plan;
    }
  }
  const plan = PLANS[planId];
  const origin = req.headers.get("origin") || new URL(req.url).origin;

  // 3) Build the invoice request — field types mirror the official SendPayment
  //    docs sample (amounts as strings; customer first/last name mandatory).
  const invoiceReq = {
    cartTotal: String(plan.priceEgp),
    currency: "EGP",
    customer: {
      first_name: "Meafer",
      last_name: "Student",
      email: email || "student@meafer.app",
      customer_unique_id: uid
    },
    cartItems: [
      {
        name: `${plan.nameAr} — ${plan.durationDays} يوم`,
        price: String(plan.priceEgp),
        quantity: "1"
      }
    ],
    // payLoad comes back as pay_load in the paid webhook → tells the webhook
    // WHICH plan was paid (monthly +30d vs yearly +365d) and for WHICH uid.
    payLoad: { uid, plan: plan.id },
    redirectionUrls: {
      successUrl: `${origin}/subscription?payment=success`,
      failUrl: `${origin}/subscription?payment=failed`,
      pendingUrl: `${origin}/subscription?payment=pending`,
      webhookUrl: `${origin}/api/fatorak-webhook_json`
    },
    sendEmail: false,
    sendSMS: false
  };

  try {
    const res = await fatorakPost(CREATE_INVOICE_PATH, invoiceReq);
    const data = await res.json().catch(() => null);
    // Defensive: prefer the documented shape, tolerate lookalikes.
    const url: string | undefined =
      data?.data?.url || data?.data?.payment_url || data?.url || undefined;
    if (!res.ok || !url) {
      console.error("Fatorak createInvoiceLink failed", {
        status: res.status,
        plan: plan.id,
        response: data
      });
      return NextResponse.json(
        {
          error: "تعذر إنشاء رابط الدفع — حاول كمان شوية",
          reason: "create_invoice_failed",
          upstream: { status: res.status, body: excerpt(data) }
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      url,
      invoiceId: data?.data?.invoiceId ?? data?.invoiceId ?? null,
      invoiceKey: data?.data?.invoiceKey ?? data?.invoiceKey ?? null,
      plan: plan.id,
      amountEgp: plan.priceEgp
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    console.error("Fatorak checkout error:", msg);

    if (msg.includes("Missing env var")) {
      return NextResponse.json(
        {
          error: "خدمة الدفع غير مفعلة حاليًا (ناقص إعدادات)",
          reason: "missing_env",
          upstream: { body: excerpt(msg, 200) }
        },
        { status: 500 }
      );
    }
    if (msg.includes("token request failed")) {
      // e.g. OAuth answered invalid_client — message embeds status + body
      return NextResponse.json(
        {
          error: "تعذر الاتصال ببوابة الدفع — حاول كمان شوية",
          reason: "oauth_token_failed",
          upstream: { body: excerpt(msg, 500) }
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "خطأ غير متوقع", reason: "unexpected", upstream: { body: excerpt(msg, 300) } },
      { status: 500 }
    );
  }
}
