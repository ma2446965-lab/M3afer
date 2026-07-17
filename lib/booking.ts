// Shared types & client logic for the tutoring content managed from /admin
// and booked by students from /booking.
//
// Firestore collections:
//   subjects: { name, description, teacherName, price, imageUrl }
//   slots:    { subjectId, date, time, capacity, bookedCount }
//   bookings: { userId, email, slotId, subjectId, subjectName, teacherName,
//               date, time, createdAt }   — doc id is `${slotId}_${userId}`
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

export interface SubjectInput {
  name: string;
  description: string;
  teacherName: string;
  price: number;
  imageUrl: string;
}

export interface Subject extends SubjectInput {
  id: string;
}

export interface SlotInput {
  subjectId: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" (24h)
  capacity: number;
  bookedCount: number;
}

export interface LessonSlot extends SlotInput {
  id: string;
}

export interface Booking {
  id: string; // `${slotId}_${userId}` — also prevents double-booking
  userId: string;
  email: string;
  slotId: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  date: string;
  time: string;
  createdAt?: any;
}

export const EMPTY_SUBJECT: SubjectInput = {
  name: "",
  description: "",
  teacherName: "",
  price: 0,
  imageUrl: ""
};

export const EMPTY_SLOT: SlotInput = {
  subjectId: "",
  date: "",
  time: "",
  capacity: 1,
  bookedCount: 0
};

// ---------------------------------------------------------------- helpers

// Parse "YYYY-MM-DD" as a LOCAL date (avoids UTC timezone shifting the day)
export function formatSlotDate(date: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(+d)) return date;
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

// "18:30" → "6:30 مساءً"
export function formatTimeAr(time: string): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const suffix = h < 12 ? "صباحًا" : "مساءً";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Local Date for a slot/booking; NaN date if unparsable
export function slotDateTime(s: { date: string; time: string }): Date {
  return new Date(`${s.date}T${s.time || "00:00"}:00`);
}

export function bookingIdFor(slotId: string, userId: string): string {
  return `${slotId}_${userId}`;
}

// ----------------------------------------------------- booking transactions

// Books a slot: creates bookings/{slotId}_{userId} AND increments
// slots.bookedCount atomically. Firestore Security Rules enforce both sides
// of this transaction (see firestore.rules) so counts can't drift.
export async function bookSlot(opts: {
  slot: LessonSlot;
  subject: Subject;
  userId: string;
  email: string;
}): Promise<void> {
  const { slot, subject, userId, email } = opts;
  const slotRef = doc(db, "slots", slot.id);
  const bookingRef = doc(db, "bookings", bookingIdFor(slot.id, userId));

  await runTransaction(db, async (tx) => {
    // All reads happen BEFORE any write (transaction requirement)
    const [slotSnap, bookingSnap] = await Promise.all([
      tx.get(slotRef),
      tx.get(bookingRef)
    ]);

    if (!slotSnap.exists()) throw new Error("الميعاد ده اتمسح — حدث الصفحة");
    if (bookingSnap.exists()) throw new Error("أنت حاجز الميعاد ده بالفعل ✅");

    const data = slotSnap.data();
    const bookedCount = data.bookedCount ?? 0;
    const capacity = data.capacity ?? 0;
    if (bookedCount >= capacity) {
      throw new Error("الميعاد كمل العدد 😅 — جرب ميعاد تاني");
    }

    tx.update(slotRef, { bookedCount: bookedCount + 1 });
    tx.set(bookingRef, {
      userId,
      email,
      slotId: slot.id,
      subjectId: subject.id,
      subjectName: subject.name,
      teacherName: subject.teacherName,
      date: slot.date,
      time: slot.time,
      createdAt: serverTimestamp()
    });
  });
}

// Cancels a booking: deletes the bookings doc AND decrements bookedCount
// atomically. Under the rules, any bookedCount decrement requires the
// matching booking to be deleted in the same transaction.
export async function cancelBooking(b: Booking): Promise<void> {
  const slotRef = doc(db, "slots", b.slotId);
  const bookingRef = doc(db, "bookings", b.id);

  await runTransaction(db, async (tx) => {
    const slotSnap = await tx.get(slotRef);
    tx.delete(bookingRef);
    if (slotSnap.exists()) {
      const current = slotSnap.data().bookedCount ?? 0;
      if (current > 0) {
        tx.update(slotRef, { bookedCount: current - 1 });
      }
    }
  });
}
