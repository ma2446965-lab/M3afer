import PaymentResultShell from "@/components/PaymentResultShell";

export const metadata = {
  title: "الدفع تم بنجاح | مِعافر",
  description: "تم استلام الدفع بنجاح — سيتم تفعيل طلبك تلقائيًا خلال ثوانٍ."
};

export default function PaymentSuccessPage() {
  return <PaymentResultShell kind="success" />;
}
