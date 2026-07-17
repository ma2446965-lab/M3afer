"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  Subject,
  LessonSlot,
  bookSlot,
  formatSlotDate,
  formatTimeAr,
  slotDateTime
} from "@/lib/booking";
import HamburgerMenu from "@/components/HamburgerMenu";
import BottomNav from "@/components/BottomNav";
import { CalendarPlus, Loader2, Users, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export default function BookingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [mySlotIds, setMySlotIds] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Subject | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  // Subjects + slots (live). Signed-in read is allowed by the rules.
  useEffect(() => {
    if (!user) return;
    const unsubSubjects = onSnapshot(
      collection(db, "subjects"),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, "id">) }));
        rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        setSubjects(rows);
        setDataLoading(false);
      },
      (err) => {
        console.error(err);
        setLoadError("مش قادرين نقرا المواد — اتأكد إن firestore.rules مرفوعة على المشروع");
        setDataLoading(false);
      }
    );
    const unsubSlots = onSnapshot(
      collection(db, "slots"),
      (snap) => setSlots(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LessonSlot, "id">) }))),
      (err) => console.error(err)
    );
    return () => {
      unsubSubjects();
      unsubSlots();
    };
  }, [user]);

  // My bookings → mark slots I already booked
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bookings"), where("userId", "==", user.uid));
    return onSnapshot(
      q,
      (snap) => setMySlotIds(new Set(snap.docs.map((d) => d.data().slotId as string))),
      (err) => console.error(err)
    );
  }, [user]);

  const isAvailable = (s: LessonSlot) => {
    const dt = slotDateTime(s);
    return (s.bookedCount ?? 0) < s.capacity && !isNaN(+dt) && dt > new Date();
  };

  // Slots of the selected subject: future + not full, soonest first
  const availableSlots = useMemo(() => {
    if (!selected) return [];
    return slots
      .filter((s) => s.subjectId === selected.id && isAvailable(s))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, selected]);

  const availableCountFor = (subjectId: string) =>
    slots.filter((s) => s.subjectId === subjectId && isAvailable(s)).length;

  const handleBook = async (slot: LessonSlot) => {
    if (!user || !selected || bookingSlotId) return;
    setBookingSlotId(slot.id);
    setNotice("");
    try {
      await bookSlot({
        slot,
        subject: selected,
        userId: user.uid,
        email: user.email || profile?.email || ""
      });
      setNotice(
        `✅ تمام يا بطل! حجزت ${selected.name} — ${formatSlotDate(slot.date)} الساعة ${formatTimeAr(slot.time)}. هتلاقيها في "جدولي" من القايمة.`
      );
    } catch (e: any) {
      if (e?.code === "permission-denied") {
        setNotice("⚠️ الحجز اترفض من Firestore — لازم تترفع firestore.rules الجديدة على المشروع (فيها قواعد معاملة الحجز).");
      } else {
        setNotice(e?.message || "حصل خطأ أثناء الحجز — جرب تاني");
      }
    } finally {
      setBookingSlotId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-900">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24 md:pb-0">
      <HamburgerMenu />
      <BottomNav />

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white p-6 pt-16 pb-8 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarPlus /> احجز حصتك
          </h1>
          <p className="text-white/85 text-sm mt-1">
            ١) اختار المادة ← ٢) اختار الميعاد المناسب ← تأكيد فوري ✅
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-5 -mt-2">
        {notice && (
          <p className="text-sm p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 leading-relaxed">
            {notice}
          </p>
        )}

        {!selected ? (
          <>
            <h2 className="font-bold text-lg">١) اختار المادة</h2>
            {dataLoading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="animate-spin text-gray-400" />
              </div>
            ) : loadError ? (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl">{loadError}</p>
            ) : subjects.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white dark:bg-gray-800 p-8 rounded-2xl text-center border dark:border-gray-700">
                لسه مفيش مواد متاحة للحجز 📚 — تابِعنا قريب
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((s) => {
                  const count = availableCountFor(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelected(s);
                        setNotice("");
                      }}
                      className="text-right bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all overflow-hidden"
                    >
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt="" className="w-full h-28 object-cover bg-gray-100 dark:bg-gray-700" />
                      ) : (
                        <div className="w-full h-28 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center text-4xl">
                          📚
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold">{s.name}</h3>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full whitespace-nowrap">
                            {s.price} ج.م
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">👨‍🏫 {s.teacherName}</p>
                        {s.description && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.description}</p>
                        )}
                        <p className={`text-xs font-bold mt-3 ${count > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                          {count > 0 ? `${count} ${count === 1 ? "ميعاد متاح" : "مواعيد متاحة"} ←` : "مفيش مواعيد متاحة حاليًا"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border dark:border-gray-700 px-4 py-2 rounded-xl hover:border-emerald-300"
            >
              <ArrowRight size={16} /> رجوع للمواد
            </button>

            {/* Selected subject summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 flex items-center gap-4">
              {selected.imageUrl ? (
                <img src={selected.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover bg-gray-100 dark:bg-gray-700" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-2xl">📚</div>
              )}
              <div className="flex-1">
                <h3 className="font-bold">{selected.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">👨‍🏫 {selected.teacherName}</p>
              </div>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
                {selected.price} ج.م
              </span>
            </div>

            <h2 className="font-bold text-lg">٢) اختار الميعاد</h2>
            {availableSlots.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-8 text-center">
                <Clock className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-500">مفيش مواعيد متاحة في {selected.name} حاليًا — جرب مادة تانية أو استنى مواعيد جديدة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableSlots.map((slot) => {
                  const remaining = slot.capacity - (slot.bookedCount ?? 0);
                  const mine = mySlotIds.has(slot.id);
                  return (
                    <div
                      key={slot.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 flex items-center gap-3"
                    >
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 leading-none">
                          {slot.date.slice(8, 10)}
                        </span>
                        <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70">
                          {slot.date.slice(5, 7)}/{slot.date.slice(0, 4)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{formatSlotDate(slot.date)}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock size={12} /> {formatTimeAr(slot.time)}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-full whitespace-nowrap ${
                          remaining <= Math.max(1, Math.floor(slot.capacity * 0.25))
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300"
                        }`}
                      >
                        <Users size={12} /> {remaining === 1 ? "آخر مكان!" : `${remaining} متاح`}
                      </span>
                      {mine ? (
                        <span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-3 py-2 rounded-xl flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 size={14} /> محجوز ليك
                        </span>
                      ) : (
                        <button
                          onClick={() => handleBook(slot)}
                          disabled={bookingSlotId !== null}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {bookingSlotId === slot.id && <Loader2 size={14} className="animate-spin" />}
                          احجز
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              حجزت بالغلط؟ تقدر تلغي من صفحة <Link href="/schedule" className="text-emerald-600 underline">جدولي</Link> في أي وقت قبل الميعاد
            </p>
          </>
        )}
      </div>
    </div>
  );
}
