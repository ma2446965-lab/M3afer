import PaymentResultShell from "@/components/PaymentResultShell";

export const metadata = {
  title: "طلبك قيد المراجعة | مِعافر",
  description: "تم استلام طلبك — التفعيل يحدث تلقائيًا فور تأكيد التحصيل."
};

export default function PaymentPendingPage() {
  return <PaymentResultShell kind="pending" />;
}
