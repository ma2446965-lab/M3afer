import PaymentResultShell from "@/components/PaymentResultShell";

export const metadata = {
  title: "الدفع لم يكتمل | مِعافر",
  description: "لم يتم خصم أي مبلغ — يمكنك إعادة المحاولة بأي وسيلة دفع."
};

export default function PaymentFailedPage() {
  return <PaymentResultShell kind="failed" />;
}
