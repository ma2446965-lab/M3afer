// Shared types for the tutoring content managed from /admin
// Firestore collections:
//   subjects: { name, description, teacherName, price, imageUrl }
//   slots:    { subjectId, date, time, capacity, bookedCount }

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

// Parse "YYYY-MM-DD" as a LOCAL date (avoids UTC timezone shifting the day)
export function formatSlotDate(date: string): string {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(+d)) return date;
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}
