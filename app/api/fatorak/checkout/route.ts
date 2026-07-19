// POST /api/fatorak/checkout
// Verifies the student's Firebase ID token, then creates a Fawaterak e-invoice
// link (SendPayment/createInvoiceLink) and returns its hosted-payment URL.
//
// Purchase modes (same Fatorak flow, server-trusted pricing ONLY):
//   { plan: "monthly" | "yearly" }                              → subscription
//   { product: "planner50", requestId }                         → 50 EGP planner
//   { product: "lecture", lectureId }                           → one lecture
//   { product: "lecture-bundle", subjectId }                    → whole subject
//      (published+paid lectures not already owned, bundled at a discount —
//      both the item list and the price are recomputed HERE from Firestore,
//      so nothing the client sends can influence the amount)
//
// Plans/prices/kinds live in lib/plans.ts; bundle math in lib/lectures.ts.
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
  LECTURE_PRODUCT,
  LECTURE_BUNDLE,
  COURSE_PRODUCT,
  type PlanId
} from "@/lib/plans";
import {
  computeBundleQuote,
  isFreeLecture,
  purchaseId,
  LECTURES_COL,
  PURCHASES_COL
} from "@/lib/lectures";
import {
  computeCourseQuote,
  sanitizeDiscountPct,
  COURSES_COL
} from "@/lib/courses";

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
  let mode: string;

  const product = parsed?.product;

  if (product === PLANNER_PRODUCT.kind) {
    // ---- One-time: the 50 EGP "جدولي" planner service ----
    mode = PLANNER_PRODUCT.kind;
    const requestId = typeof parsed.requestId === "string" ? parsed.requestId : "";
    if (!requestId) return err(400, "رقم الطلب ناقص", "missing_request_id");

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
  } else if (product === LECTURE_PRODUCT.kind) {
    // ---- One-time: a single recorded lecture ----
    mode = LECTURE_PRODUCT.kind;
    const lectureId = typeof parsed.lectureId === "string" ? parsed.lectureId : "";
    if (!lectureId) return err(400, "رقم المحاضرة ناقص", "missing_lecture_id");

    let lecture: any;
    let owned: boolean;
    try {
      const [lecSnap, ownSnap] = await Promise.all([
        adminDb.collection(LECTURES_COL).doc(lectureId).get(),
        adminDb.collection(PURCHASES_COL).doc(purchaseId(lectureId, uid)).get()
      ]);
      lecture = lecSnap.exists ? lecSnap.data() : null;
      owned = ownSnap.exists;
    } catch (e: any) {
      console.error("checkout: lecture lookup failed", e);
      return err(500, "تعذر التحقق من المحاضرة", "lecture_lookup_failed");
    }
    if (!lecture) return err(404, "المحاضرة غير موجودة", "lecture_not_found");
    if (lecture.published === false) return err(404, "المحاضرة غير متاحة", "lecture_unpublished");
    if (owned) return err(409, "المحاضرة دي عندك بالفعل ✅", "already_owned");
    if (isFreeLecture(lecture)) return err(400, "المحاضرة دي مجانية أصلاً 🎁", "lecture_is_free");

    amountEgp = Math.round(Number(lecture.priceEgp));
    itemName = `محاضرة مسجلة: ${String(lecture.title || "محاضرة").slice(0, 80)}`;
    payLoad = { uid, kind: LECTURE_PRODUCT.kind, lectureId };
    redirectBase = `${origin}/lectures/${lectureId}`;
  } else if (product === LECTURE_BUNDLE.kind) {
    // ---- One-time: whole-subject bundle at a discount ----
    mode = LECTURE_BUNDLE.kind;
    const subjectId = typeof parsed.subjectId === "string" ? parsed.subjectId : "";
    if (!subjectId) return err(400, "رقم المادة ناقص", "missing_subject_id");

    let quote;
    try {
      const [lecSnap, ownSnap] = await Promise.all([
        adminDb.collection(LECTURES_COL).where("subjectId", "==", subjectId).get(),
        adminDb.collection(PURCHASES_COL).where("studentId", "==", uid).get()
      ]);
      const ownedIds = new Set(ownSnap.docs.map((d) => (d.data() as any).lectureId));
      const lectures = lecSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      quote = computeBundleQuote(lectures, subjectId, ownedIds, LECTURE_BUNDLE.discountPct);
    } catch (e: any) {
      console.error("checkout: bundle lookup failed", e);
      return err(500, "تعذر حساب الباقة", "bundle_lookup_failed");
    }
    if (!quote) {
      return err(409, "مفيش محاضرات مدفوعة متبقية في المادة دي — عندك كل حاجة بالفعل ✅", "nothing_to_buy");
    }

    amountEgp = quote.totalEgp;
    itemName = `باقة محاضرات كاملة (${quote.count} محاضرة — خصم ${Math.round(
      LECTURE_BUNDLE.discountPct * 100
    )}%)`;
    payLoad = { uid, kind: LECTURE_BUNDLE.kind, subjectId };
    redirectBase = `${origin}/lectures`;
  } else if (product === COURSE_PRODUCT.kind) {
    // ---- One-time: whole course — price server-recomputed from its
    //      member lectures × the course's discountPct (computeCourseQuote),
    //      so nothing the client sends can influence the amount. ----
    mode = COURSE_PRODUCT.kind;
    const courseId = typeof parsed.courseId === "string" ? parsed.courseId : "";
    if (!courseId) return err(400, "رقم الكورس ناقص", "missing_course_id");

    let course: any;
    let quote;
    try {
      const [cSnap, lecSnap, ownSnap] = await Promise.all([
        adminDb.collection(COURSES_COL).doc(courseId).get(),
        adminDb.collection(LECTURES_COL).where("courseId", "==", courseId).get(),
        adminDb.collection(PURCHASES_COL).where("studentId", "==", uid).get()
      ]);
      course = cSnap.exists ? cSnap.data() : null;
      const ownedIds = new Set(ownSnap.docs.map((d) => (d.data() as any).lectureId));
      const lectures = lecSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      quote = course
        ? computeCourseQuote(lectures, courseId, ownedIds, sanitizeDiscountPct(course.discountPct))
        : null;
    } catch (e: any) {
      console.error("checkout: course lookup failed", e);
      return err(500, "تعذر التحقق من الكورس", "course_lookup_failed");
    }
    if (!course) return err(404, "الكورس غير موجود", "course_not_found");
    if (course.published === false) return err(404, "الكورس غير متاح", "course_unpublished");
    if (!quote) {
      return err(409, "عندك كل محاضرات الكورس ده بالفعل ✅ — مفيش حاجة متبقية للشراء", "nothing_to_buy");
    }

    amountEgp = quote.totalEgp;
    itemName = `كورس: ${String(course.title || "كورس").slice(0, 60)} (${quote.count} محاضرة — خصم ${Math.round(
      quote.discountPct * 100
    )}%)`;
    payLoad = { uid, kind: COURSE_PRODUCT.kind, courseId };
    redirectBase = `${origin}/courses/${courseId}`;
  } else if (product != null) {
    return err(400, "منتج غير معروف", "unknown_product");
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
    // Echoed back as pay_load in the paid webhook (WHAT was paid + for WHOM).
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
