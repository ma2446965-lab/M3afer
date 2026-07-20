"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import { sanitizeNextPath } from "@/lib/nav";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  Home,
  RotateCcw,
  MessagesSquare,
  Loader2,
  type LucideIcon
} from "lucide-react";

export type PaymentResultKind = "success" | "failed" | "pending";

const CONFIG: Record<
  PaymentResultKind,
  {
    icon: LucideIcon;
    gradient: string;
    ring: string;
    iconWrap: string;
    title: string;
    body: string;
    hint: string;
    /** the ?payment= state the product pages already understand */
    productState: string;
    /** seconds until auto-return (0 = no auto-return) */
    autoReturnSec: number;
    ctaLabel: string;
    showSupport: boolean;
  }
> = {
  success: {
    icon: CheckCircle2,
    gradient: "from-emerald-500 via-green-600 to-teal-600",
    ring: "shadow-[0_0_0_6px_rgba(16,185,129,0.15)]",
    iconWrap: "bg-emerald-100 text-emerald-600",
    title: "الدفع تم بنجاح ✅",
    body: "بنفعّل طلبك تلقائيًا خلال ثوانٍ — مفيش أي خطوة مطلوبة منك. أول ما التفعيل يتم هتفتحلك المزايا على طول.",
    hint: "هنرجعك لمكانك تلقائيًا...",
    productState: "success",
    autoReturnSec: 5,
    ctaLabel: "ارجع لطلبك دلوقتي ⤺",
    showSupport: false
  },
  failed: {
    icon: XCircle,
    gradient: "from-rose-500 via-red-600 to-orange-600",
    ring: "shadow-[0_0_0_6px_rgba(244,63,94,0.15)]",
    iconWrap: "bg-rose-100 text-rose-600",
    title: "الدفع ما تمش ❌",
    body: "متقلقش — مفيش أي فلوس اتخصمت. غالبًا السبب رصيد غير كافي، بيانات كارت غلط، أو المحاولة اتلغت.",
    hint: "جرب تاني بنفس الوسيلة أو وسيلة مختلفة (فيزا/فوري/محافظ).",
    productState: "failed",
    autoReturnSec: 0,
    ctaLabel: "حاول الدفع تاني ⤺",
    showSupport: true
  },
  pending: {
    icon: Clock3,
    gradient: "from-amber-500 via-orange-500 to-yellow-500",
    ring: "shadow-[0_0_0_6px_rgba(245,158,11,0.15)]",
    iconWrap: "bg-amber-100 text-amber-600",
    title: "طلبك قيد المراجعة ⏳",
    body: "استلمنا طلبك. لو هتكمل الدفع بفوري/محفظة، التفعيل بيحصل تلقائيًا أول ما فاتورتي تأكد التحصيل — وهتلاقي طلبك اتفتح من نفسه.",
    hint: "عمرك ما هتحتاج تبعت إيصال — التأكيد أوتوماتيك بالكامل.",
    productState: "pending",
    autoReturnSec: 0,
    ctaLabel: "ارجع لمتابعة طلبك ⤺",
    showSupport: true
  }
};

function ShellInner({ kind }: { kind: PaymentResultKind }) {
  const c = CONFIG[kind];
  const params = useSearchParams();
  const router = useRouter();
  // Where the purchase started (course/lecture/subscription page...) — the
  // product page's own ?payment= banner + auto-confirm polling take over there.
  const next = sanitizeNextPath(params.get("next"));
  const backHref = `${next}${next.includes("?") ? "&" : "?"}payment=${c.productState}`;
  const [left, setLeft] = useState(c.autoReturnSec);

  useEffect(() => {
    if (!c.autoReturnSec) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (c.autoReturnSec && left <= 0) router.replace(backHref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const Icon = c.icon;
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      <div className={`bg-gradient-to-br ${c.gradient} text-white px-6 pt-14 pb-20 rounded-b-[40px] relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-lg mx-auto text-center">
          <h1 className="text-xl font-bold">مِعافر 🤖 — الدفع الإلكتروني</h1>
          <p className="text-white/80 text-sm mt-1">فواترك • بوابة دفع آمنة 🔒</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12 pb-10">
        <div className={`bg-white dark:bg-gray-800 rounded-[28px] p-8 text-center border dark:border-gray-700 ${c.ring} space-y-5`}>
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${c.iconWrap}`}>
            <Icon size={44} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-2xl font-black">{c.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mt-3">{c.body}</p>
            <p className="text-xs text-gray-400 mt-2">{c.hint}</p>
          </div>

          <div className="space-y-2.5 pt-1">
            <Link
              href={backHref}
              className={`w-full bg-gradient-to-r ${c.gradient} hover:opacity-95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2`}
            >
              {c.autoReturnSec > 0 && left > 0 ? `(${left}) ` : ""}
              {c.ctaLabel}
            </Link>
            {c.showSupport && (
              <Link
                href="/messages"
                className="w-full bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 transition"
              >
                <MessagesSquare size={16} /> الدعم معاك — اسألنا 💬
              </Link>
            )}
            <Link
              href="/"
              className="w-full text-gray-500 dark:text-gray-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition text-sm"
            >
              <Home size={15} /> الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultShell({ kind }: { kind: PaymentResultKind }) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
            <Loader2 className="animate-spin text-sky-500" size={30} />
          </div>
        }
      >
        <ShellInner kind={kind} />
      </Suspense>
    </ErrorBoundary>
  );
}
