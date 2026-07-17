"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { GraduationCap, Search, Check, Loader2, Copy, Crown } from "lucide-react";

const fmtDate = (v: any): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(+d)) return "—";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
};

// Effective status: "subscribed" flag + subscriptionEndDate combined
const statusOf = (u: any) => {
  if (!u.subscriptionActive)
    return { label: "غير مشترك", cls: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300" };
  if (u.subscriptionEndDate) {
    const end = new Date(u.subscriptionEndDate);
    if (!isNaN(+end) && end.getTime() < Date.now())
      return { label: "منتهي الصلاحية", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
  }
  return { label: "نشط ✅", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" };
};

export default function StudentsManager() {
  const [students, setStudents] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [filter, setFilter] = useState("");

  // --- Subscription management by UUID (existing admin feature, kept) ---
  const [searchUuid, setSearchUuid] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [endDate, setEndDate] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const rows = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
        rows.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        setStudents(rows);
        setListLoading(false);
      },
      (err) => {
        console.error(err);
        setListError("مش قادر أقرا المستخدمين — اتأكد من الصلاحيات");
        setListLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = filter.trim()
    ? students.filter(
        (u) =>
          u.email?.toLowerCase().includes(filter.trim().toLowerCase()) ||
          u.uuid?.includes(filter.trim())
      )
    : students;

  const activeCount = students.filter((u) => statusOf(u).label === "نشط ✅").length;
  const expiredCount = students.filter((u) => statusOf(u).label === "منتهي الصلاحية").length;

  const handleSearch = async () => {
    if (!searchUuid.trim()) return;
    setSearchLoading(true);
    setMessage("");
    try {
      const q = query(collection(db, "users"), where("uuid", "==", searchUuid.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setFoundUser({ ...data, docId: snap.docs[0].id });
        setEndDate(data.subscriptionEndDate ? String(data.subscriptionEndDate).slice(0, 10) : "");
      } else {
        setMessage("❌ لم يتم العثور على مستخدم بهذا UUID");
        setFoundUser(null);
      }
    } catch (e: any) {
      setMessage("حدث خطأ أثناء البحث: " + (e?.message || ""));
    } finally {
      setSearchLoading(false);
    }
  };

  const saveSubscription = async (tier: string, active: boolean) => {
    if (!foundUser) return;
    const payload: Record<string, any> = { subscription: tier, subscriptionActive: active };
    if (active) {
      // If no date picked, default to 30 days from now
      payload.subscriptionEndDate = endDate
        ? new Date(`${endDate}T23:59:59`).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (tier === "free") {
      payload.subscriptionEndDate = null;
    }
    try {
      await updateDoc(doc(db, "users", foundUser.docId), payload);
      setFoundUser({ ...foundUser, ...payload });
      setMessage(`✅ تم تحديث الاشتراك → ${tier} (${active ? "مفعل" : "غير مفعل"})`);
    } catch (e: any) {
      setMessage("⚠️ فشل التحديث: " + (e?.message || ""));
    }
  };

  return (
    <div className="space-y-6">
      {/* ===== Read-only students table ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b dark:border-gray-700">
          <h2 className="font-bold flex items-center gap-2">
            <GraduationCap size={18} /> الطلاب
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {students.length}
            </span>
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-bold">
              نشط: {activeCount}
            </span>
            <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full font-bold">
              منتهي: {expiredCount}
            </span>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="بحث بالإيميل أو UUID..."
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm w-full sm:w-64"
          />
        </div>

        {listLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : listError ? (
          <p className="p-6 text-sm text-red-500">{listError}</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">
            {students.length === 0 ? "مفيش طلاب مسجلين لسه" : "مفيش نتايج للبحث ده"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-xs text-gray-400 border-b dark:border-gray-700 text-right">
                  <th className="p-3 font-medium">الطالب</th>
                  <th className="p-3 font-medium">UUID</th>
                  <th className="p-3 font-medium">الصف / الشعبة</th>
                  <th className="p-3 font-medium">الباقة</th>
                  <th className="p-3 font-medium">الحالة</th>
                  <th className="p-3 font-medium">نهاية الاشتراك</th>
                  <th className="p-3 font-medium">تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {filtered.map((u) => {
                  const status = statusOf(u);
                  return (
                    <tr key={u.docId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="p-3">
                        <div className="font-bold">{u.email}</div>
                        {u.role === "admin" && (
                          <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded-full font-bold">
                            admin
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => navigator.clipboard?.writeText(u.uuid).catch(() => {})}
                          title="نسخ UUID كامل"
                          className="flex items-center gap-1 font-mono text-[11px] text-gray-400 hover:text-indigo-500"
                        >
                          {u.uuid?.slice(0, 8)}… <Copy size={11} />
                        </button>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">
                        {u.grade || "—"}
                        {u.track ? ` • ${u.track}` : ""}
                      </td>
                      <td className="p-3">
                        <span className="capitalize text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-full">
                          {u.subscription || "free"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(u.subscriptionEndDate)}
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(u.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Subscription management by UUID (kept from previous admin page) ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border dark:border-gray-700">
        <h2 className="font-bold mb-4 flex items-center gap-2">
          <Search size={18} /> إدارة اشتراك طالب (بالبحث بـ UUID)
        </h2>
        <div className="flex gap-2">
          <input
            value={searchUuid}
            onChange={(e) => setSearchUuid(e.target.value)}
            placeholder="الصق UUID المستخدم هنا (من رسالة واتساب)"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 font-mono text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="bg-gray-900 dark:bg-white dark:text-black text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {searchLoading ? "..." : "بحث"}
          </button>
        </div>
        {message && (
          <p className="mt-3 text-sm p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {message}
          </p>
        )}

        {foundUser && (
          <div className="mt-6 bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-5 border-2 border-indigo-200 dark:border-indigo-800">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Crown size={16} className="text-amber-500" /> المستخدم الموجود
            </h3>
            <div className="space-y-2 text-sm bg-white dark:bg-gray-800 p-4 rounded-xl">
              <p>
                <span className="text-gray-500">Email:</span> <span className="font-bold">{foundUser.email}</span>
              </p>
              <p>
                <span className="text-gray-500">صف:</span> {foundUser.grade} {foundUser.track && `• ${foundUser.track}`}
              </p>
              <p>
                <span className="text-gray-500">الباقة الحالية:</span>{" "}
                <span className="font-bold capitalize bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  {foundUser.subscription}
                </span>{" "}
                {foundUser.subscriptionActive ? "• مفعل" : "• غير مفعل"}
              </p>
              <p>
                <span className="text-gray-500">نهاية الاشتراك:</span> {fmtDate(foundUser.subscriptionEndDate)}
              </p>
            </div>

            <div className="mt-4">
              <p className="font-bold text-sm mb-2">تغيير الباقة:</p>
              <div className="grid grid-cols-4 gap-2">
                {["free", "basic", "pro", "premium"].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => saveSubscription(tier, tier !== "free")}
                    className={`p-3 rounded-xl border-2 text-sm font-bold capitalize ${
                      foundUser.subscription === tier
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-200"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">
                  تاريخ انتهاء الاشتراك (فارغ = 30 يوم من دلوقتي عند التفعيل)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => saveSubscription(foundUser.subscription, true)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-1"
                >
                  <Check size={16} /> تفعيل
                </button>
                <button
                  onClick={() => saveSubscription(foundUser.subscription, false)}
                  className="flex-1 bg-red-100 dark:bg-red-900/20 text-red-600 py-2.5 rounded-xl font-bold"
                >
                  إلغاء التفعيل
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
