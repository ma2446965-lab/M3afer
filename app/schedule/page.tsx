"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Booking, cancelBooking, formatSlotDate, formatTimeAr, slotDateTime } from "@/lib/booking";
import HamburgerMenu from "@/components/HamburgerMenu";
import BottomNav from "@/components/BottomNav";
import { CalendarDays, CalendarPlus, Loader2, Clock, Trash2 } from "lucide-react";

function daysUntil(b: Booking): number {
  return Math.ceil((+slotDateTime(b) - Date.now()) / 86400000);
}

function daysLabel(b: Booking): string {
  const d = daysUntil(b);
  if (d <= 0) return "النهارده 🔥";
  if (d === 1) return "بكرة";
  if (d === 2) return "بعد بكرة";
  return `باقي ${d} يوم`;
}

export default function SchedulePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bookings"), where("userId", "==", user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, "id">) }));
        // Soonest first
        rows.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
        setBookings(rows);
        setListLoading(false);
      },
      (err) => {
        console.error(err);
        setListError("مش قادرين نقرا حجوزاتك — اتأكد إن firestore.rules مرفوعة");
        setListLoading(false);
      }
    );
  }, [user]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: Booking[] = [];
    const pa: Booking[] = [];
    for (const b of bookings) {
      const t = +slotDateTime(b);
      if (isNaN(t) || t < now) pa.push(b);
      else up.push(b);
    }
    pa.reverse(); // most recent past booking first
    return { upcoming: up, past: pa };
  }, [bookings]);

  const handleCancel = async (b: Booking) => {
    if (!window.confirm(`متأكد إنك عايز تلغي حجز ${b.subjectName} — ${formatSlotDate(b.date)}؟`)) return;
    setCancellingId(b.id);
    setNotice("");
    try {
      await cancelBooking(b);
      setNotice(`✅ اتلغى حجز ${b.subjectName} — المكان بقى متاح لحد تاني`);
    } catch (e: any) {
      setNotice(
        e?.code === "permission-denied"
          ? "⚠️ الإلغاء اترفض — firestore.rules الجديدة لازم تترفع على المشروع"
          : e?.message || "حصل خطأ أثناء الإلغاء"
      );
    } finally {
      setCancellingId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const BookingCard = ({ b, isPast }: { b: Booking; isPast?: boolean }) => (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 flex items-center gap-3 ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${
          isPast ? "bg-gray-100 dark:bg-gray-700" : "bg-indigo-50 dark:bg-indigo-900/20"
        }`}
      >
        <span
          className={`text-sm font-black leading-none ${
            isPast ? "text-gray-500" : "text-indigo-700 dark:text-indigo-300"
          }`}
        >
          {b.date.slice(8, 10) || "—"}
        </span>
        <span className={`text-[9px] ${isPast ? "text-gray-400" : "text-indigo-500/70"}`}>
          {b.date ? `${b.date.slice(5, 7)}/${b.date.slice(0, 4)}` : ""}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">
          {b.subjectName} <span className="font-normal text-gray-400">• {b.teacherName}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <Clock size={12} /> {formatSlotDate(b.date)} — {formatTimeAr(b.time)}
        </p>
      </div>
      {isPast ? (
        <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
          خلصت ✔
        </span>
      ) : (
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
            {daysLabel(b)}
          </span>
          <button
            onClick={() => handleCancel(b)}
            disabled={cancellingId !== null}
            className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
          >
            {cancellingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            إلغاء
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">
      <HamburgerMenu />
      <BottomNav />

      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-600 text-white p-6 pt-16 pb-8 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays /> جدولي
          </h1>
          <p className="text-white/85 text-sm mt-1">
            كل حصصك المحجوزة مرتبة بالتاريخ — {upcoming.length} قادمة
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6 -mt-2">
        {notice && (
          <p className="text-sm p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 leading-relaxed">
            {notice}
          </p>
        )}

        {listLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : listError ? (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">{listError}</p>
        ) : bookings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-10 text-center">
            <div className="text-5xl mb-3">🗓️</div>
            <p className="font-bold">لسه ماعندكش حجوزات</p>
            <p className="text-sm text-gray-500 mt-1">اختار مادة واحجز أول ميعاد ليك — التأكيد فوري</p>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-sm"
            >
              <CalendarPlus size={16} /> احجز حصتك دلوقتي
            </Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h2 className="font-bold text-lg mb-3">الحصص القادمة ⏳</h2>
                <div className="space-y-2">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} b={b} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="font-bold text-lg mb-3 text-gray-500">حصص سابقة 🕘</h2>
                <div className="space-y-2">
                  {past.map((b) => (
                    <BookingCard key={b.id} b={b} isPast />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
