import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Meafer.ai - منصة الثانوية العامة الذكية",
  description: "منصة AI متكاملة لطلاب الثانوية العامة المصرية - ملخصات، كويزات، ومساعد ذكي بأسلوب الوزارة",
  keywords: "ثانوية عامة, مذاكرة, تلخيص, ثالثة ثانوي, علمي علوم, علمي رياضة, أدبي, Meafer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
