// POST /api/fatorak/checkout
// Verifies the student's Firebase ID token, then creates a Fawaterak e-invoice
// link (SendPayment/createInvoiceLink) and returns its URL so the client can
// redirect the student to the hosted payment page.
// Auth to Fatorak: OAuth 2.0 client_credentials access token (cached +
// auto-refreshed in lib/server/fatorak.ts) sent as Bearer.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/server/firebase-admin";
import { CREATE_INVOICE_PATH, fatorakPost } from "@/lib/server/fatorak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN = { name: "اشتراك مِعافر الشهري - 30 يوم", priceEgp: 150, planId: "monthly-150" };

export async function POST(req: NextRequest) {
  try {
    // 1) Verify the Firebase ID token (same pattern as /api/gemini)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "مطلوب تسجيل الدخول" }, { status: 401 });
    }
    let uid: string;
    let email: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email || "";
    } catch {
      return NextResponse.json({ error: "الجلسة غير صالحة — سجل دخول تاني" }, { status: 401 });
    }

    const origin = req.headers.get("origin") || new URL(req.url).origin;

    // 2) Create the invoice link — request shape per the official docs.
    //    fatorakPost() injects the OAuth access token (and retries with a
    //    fresh token if the Fatorak server answers 401).
    const res = await fatorakPost(CREATE_INVOICE_PATH, {
      cartTotal: PLAN.priceEgp,
      currency: "EGP",
      customer: {
        first_name: "Meafer",
        last_name: "Student",
        email: email || "student@meafer.app",
        customer_unique_id: uid
      },
      cartItems: [{ name: PLAN.name, price: String(PLAN.priceEgp), quantity: "1" }],
      payLoad: { uid, plan: PLAN.planId },
      redirectionUrls: {
        successUrl: `${origin}/subscription?payment=success`,
        failUrl: `${origin}/subscription?payment=failed`,
        pendingUrl: `${origin}/subscription?payment=pending`,
        webhookUrl: `${origin}/api/fatorak-webhook_json`
      },
      sendEmail: false,
      sendSMS: false
    });

    const data = await res.json().catch(() => null);
    const url = data?.data?.url;
    if (!res.ok || !url) {
      console.error("Fatorak createInvoiceLink failed:", res.status, JSON.stringify(data));
      return NextResponse.json({ error: "تعذر إنشاء رابط الدفع — حاول كمان شوية" }, { status: 502 });
    }

    return NextResponse.json({ url, invoiceId: data.data.invoiceId ?? null });
  } catch (e: any) {
    console.error("Fatorak checkout error:", e);
    const msg = String(e?.message || "");
    if (msg.includes("FATORAK_MERCHANT_ID") || msg.includes("FATORAK_SECRET_KEY")) {
      return NextResponse.json({ error: "خدمة الدفع غير مفعلة حاليًا (ناقص إعدادات)" }, { status: 500 });
    }
    if (msg.includes("token request failed")) {
      return NextResponse.json({ error: "تعذر الاتصال ببوابة الدفع — حاول كمان شوية" }, { status: 502 });
    }
    return NextResponse.json({ error: "خطأ غير متوقع" }, { status: 500 });
  }
}
