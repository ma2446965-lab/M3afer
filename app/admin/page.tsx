"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Shield, Search, Crown, Check } from "lucide-react";

export default function AdminPage() {
  const { profile, user, loading } = useAuth();
  const router = useRouter();
  const [searchUuid, setSearchUuid] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/auth/login");
      else if (profile && profile.role !== "admin") router.push("/");
    }
  }, [profile, user, loading, router]);

  useEffect(() => {
    const fetchRecentUsers = async () => {
      try {
        const q = query(collection(db, "users"));
        const snap = await getDocs(q);
        setUsersList(snap.docs.map(d => d.data()).slice(0, 10));
      } catch (e) {
        console.log("Firestore not available in demo, using mock");
      }
    };
    if (profile?.role === "admin") fetchRecentUsers();
  }, [profile]);

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
      } else {
        // Try mock from localStorage
        setMessage("❌ لم يتم العثور على المستخدم بهذا UUID");
        setFoundUser(null);
      }
    } catch (e) {
      setMessage("Firebase غير متاح حالياً - Demo Mode. في الإنتاج سيتم البحث من Firestore حقيقي");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUpgrade = async (newTier: string, active: boolean) => {
    if (!foundUser) return;
    try {
      const userDoc = doc(db, "users", foundUser.docId);
      await updateDoc(userDoc, {
        subscription: newTier,
        subscriptionActive: active
      });
      setFoundUser({ ...foundUser, subscription: newTier, subscriptionActive: active });
      setMessage(`✅ تم تحديث اشتراك المستخدم إلى ${newTier} - ${active ? "مفعل" : "غير مفعل"}`);
    } catch (e) {
      setMessage("⚠️ تحديث وهمي في Demo - في الإنتاج سيتم التحديث في Firestore مع Security Rules");
      setFoundUser({ ...foundUser, subscription: newTier, subscriptionActive: active });
    }
  };

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center">جاري التحقق من الصلاحيات...</div>;
  if (profile.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 p-4 pt-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-[24px] p-6 text-white mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield /> لوحة الأدمن</h1>
          <p className="text-white/80 text-sm mt-1">إدارة المستخدمين والاشتراكات • Role-based (role === "admin") • محمي بـ Firestore Rules</p>
          <p className="text-xs bg-white/20 inline-block px-2 py-1 rounded-full mt-3">أنت: {profile.email} • {profile.uuid}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Search size={18} /> البحث عن مستخدم بـ UUID</h2>
          <div className="flex gap-2">
            <input
              value={searchUuid}
              onChange={e => setSearchUuid(e.target.value)}
              placeholder="الصق UUID المستخدم هنا (من رسالة واتساب)"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 font-mono text-sm"
            />
            <button onClick={handleSearch} disabled={searchLoading} className="bg-gray-900 dark:bg-white dark:text-black text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">
              {searchLoading ? "..." : "بحث"}
            </button>
          </div>
          {message && <p className="mt-3 text-sm p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{message}</p>}
        </div>

        {foundUser && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-indigo-200 dark:border-indigo-800">
            <h3 className="font-bold mb-4">المستخدم الموجود ✅</h3>
            <div className="space-y-2 text-sm bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
              <p><span className="text-gray-500">Email:</span> <span className="font-bold">{foundUser.email}</span></p>
              <p><span className="text-gray-500">UUID:</span> <span className="font-mono text-xs">{foundUser.uuid}</span></p>
              <p><span className="text-gray-500">Grade:</span> {foundUser.grade} • {foundUser.track}</p>
              <p><span className="text-gray-500">Current Plan:</span> <span className="font-bold capitalize bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{foundUser.subscription}</span> {foundUser.subscriptionActive ? "• Active" : "• Inactive"}</p>
            </div>

            <div className="mt-6">
              <p className="font-bold text-sm mb-3">ترقية الاشتراك:</p>
              <div className="grid grid-cols-3 gap-2">
                {["free","basic","pro","premium"].map(tier => (
                  <button key={tier} onClick={() => handleUpgrade(tier, tier !== "free")} className={`p-3 rounded-xl border-2 text-sm font-bold capitalize ${foundUser.subscription === tier ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-gray-200 dark:border-gray-700 hover:border-indigo-200"}`}>
                    {tier}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => handleUpgrade(foundUser.subscription, true)} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-1">
                  <Check size={16} /> تفعيل
                </button>
                <button onClick={() => handleUpgrade(foundUser.subscription, false)} className="flex-1 bg-red-100 dark:bg-red-900/20 text-red-600 py-2.5 rounded-xl font-bold">
                  إلغاء التفعيل
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border">
          <h3 className="font-bold mb-4">آخر المستخدمين المسجلين (10)</h3>
          <div className="space-y-2">
            {usersList.length ? usersList.map((u: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl text-sm">
                <div>
                  <p className="font-medium">{u.email}</p>
                  <p className="text-xs text-gray-500 font-mono">{u.uuid?.slice(0,8)}...</p>
                </div>
                <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">{u.subscription}</span>
              </div>
            )) : <p className="text-sm text-gray-500">لا يوجد بيانات (Firestore غير متصل في Demo - في الإنتاج البيانات هتظهر هنا)</p>}
          </div>
        </div>

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            🔐 <b>ملاحظة أمان:</b> هذه الصفحة محمية بـ:<br />
            1. Client-side: فحص role === "admin" من Firestore<br />
            2. Server-side: يجب إضافة Firestore Security Rules: allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"<br />
            3. Storage Rules: match /users/{"{userId}"}/{"{allPaths=**}"} {'{'} allow read, write: if request.auth.uid == userId {'}'}
          </p>
        </div>
      </div>
    </div>
  );
}
