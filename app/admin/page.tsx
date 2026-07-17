"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Shield, BookOpen, CalendarDays, GraduationCap } from "lucide-react";
import SubjectsManager from "@/components/admin/SubjectsManager";
import SlotsManager from "@/components/admin/SlotsManager";
import StudentsManager from "@/components/admin/StudentsManager";

type Tab = "subjects" | "slots" | "students";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "subjects", label: "المواد", icon: BookOpen },
  { id: "slots", label: "المواعيد المتاحة", icon: CalendarDays },
  { id: "students", label: "الطلاب", icon: GraduationCap }
];

export default function AdminPage() {
  const { profile, user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("subjects");

  // Route protection:
  //  - not signed in          → /auth/login
  //  - signed in but not admin → home (/)
  // The real enforcement happens in firestore.rules (role == "admin" required
  // for writes on subjects/slots and for reading other users' docs).
  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/auth/login");
      else if (!profile || profile.role !== "admin") router.push("/");
    }
  }, [profile, user, loading, router]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
        جاري التحقق من الصلاحيات...
      </div>
    );
  }
  if (profile.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 p-4 pt-8 pb-16">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-[24px] p-6 text-white mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield /> لوحة الأدمن
          </h1>
          <p className="text-white/80 text-sm mt-1">
            إدارة المواد والمواعيد والطلاب • محمية بـ role === &quot;admin&quot; في Firestore + Security Rules
          </p>
          <p className="text-xs bg-white/20 inline-block px-2 py-1 rounded-full mt-3">
            أنت: {profile.email} • {profile.uuid}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${
                tab === id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                  : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {tab === "subjects" && <SubjectsManager />}
        {tab === "slots" && <SlotsManager />}
        {tab === "students" && <StudentsManager />}

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            🔐 <b>ملاحظة أمان:</b> هذه الصفحة محمية على مستويين:
            <br />
            1. Client-side: تحويل تلقائي لأي مستخدم role بتاعه مش &quot;admin&quot;.
            <br />
            2. Server-side: ملف <code>firestore.rules</code> بيسمح بقراءة subjects/slots لأي مستخدم
            مسجل، والكتابة فيهم للأدمن فقط (role == &quot;admin&quot;). ارفع القواعد من Firebase Console →
            Firestore → Rules.
            <br />
            ⚠️ لما تبني فلو الحجز للطلاب، <code>bookedCount</code> هيتعدل بواسطة الطلاب — اعملها عن
            طريق Cloud Function (Admin SDK) أو Rule مخصصة بس تسمح بزيادة العدد بـ 1 فقط.
          </p>
        </div>
      </div>
    </div>
  );
}
