// Subject configuration per grade and track - easy to update each academic year
export type Grade = "الصف الأول الثانوي" | "الصف الثاني الثانوي" | "الصف الثالث الثانوي";
export type Track = "علمي علوم" | "علمي رياضة" | "أدبي";

export interface SubjectConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
}

export const GRADES: Grade[] = [
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي"
];

export const TRACKS: Track[] = [
  "علمي علوم",
  "علمي رياضة",
  "أدبي"
];

// Grade 1 is unified in Egypt - no track separation
export const SUBJECTS_CONFIG: Record<string, SubjectConfig[]> = {
  "الصف الأول الثانوي": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "math", nameAr: "الرياضيات", nameEn: "Math", icon: "📐" },
    { id: "physics", nameAr: "الفيزياء", nameEn: "Physics", icon: "⚛️" },
    { id: "chemistry", nameAr: "الكيمياء", nameEn: "Chemistry", icon: "🧪" },
    { id: "biology", nameAr: "الأحياء", nameEn: "Biology", icon: "🧬" },
    { id: "history", nameAr: "التاريخ", nameEn: "History", icon: "🏛️" },
    { id: "geography", nameAr: "الجغرافيا", nameEn: "Geography", icon: "🌍" },
    { id: "philosophy", nameAr: "الفلسفة", nameEn: "Philosophy", icon: "🤔" },
  ],
  "الصف الثاني الثانوي-علمي علوم": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "math", nameAr: "الرياضيات", nameEn: "Math", icon: "📐" },
    { id: "physics", nameAr: "الفيزياء", nameEn: "Physics", icon: "⚛️" },
    { id: "chemistry", nameAr: "الكيمياء", nameEn: "Chemistry", icon: "🧪" },
    { id: "biology", nameAr: "الأحياء", nameEn: "Biology", icon: "🧬" },
  ],
  "الصف الثاني الثانوي-علمي رياضة": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "pure_math", nameAr: "الرياضيات البحتة", nameEn: "Pure Math", icon: "📐" },
    { id: "applied_math", nameAr: "الرياضيات التطبيقية", nameEn: "Applied Math", icon: "📊" },
    { id: "physics", nameAr: "الفيزياء", nameEn: "Physics", icon: "⚛️" },
    { id: "chemistry", nameAr: "الكيمياء", nameEn: "Chemistry", icon: "🧪" },
  ],
  "الصف الثاني الثانوي-أدبي": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "history", nameAr: "التاريخ", nameEn: "History", icon: "🏛️" },
    { id: "geography", nameAr: "الجغرافيا", nameEn: "Geography", icon: "🌍" },
    { id: "philosophy_logic", nameAr: "الفلسفة والمنطق", nameEn: "Philosophy & Logic", icon: "🤔" },
    { id: "psychology", nameAr: "علم النفس والاجتماع", nameEn: "Psychology & Sociology", icon: "🧠" },
  ],
  "الصف الثالث الثانوي-علمي علوم": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "physics", nameAr: "الفيزياء", nameEn: "Physics", icon: "⚛️" },
    { id: "chemistry", nameAr: "الكيمياء", nameEn: "Chemistry", icon: "🧪" },
    { id: "biology", nameAr: "الأحياء", nameEn: "Biology", icon: "🧬" },
    { id: "geology", nameAr: "الجيولوجيا وعلوم البيئة", nameEn: "Geology", icon: "🪨" },
  ],
  "الصف الثالث الثانوي-علمي رياضة": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "pure_math", nameAr: "الرياضيات البحتة", nameEn: "Pure Math", icon: "📐" },
    { id: "applied_math", nameAr: "الرياضيات التطبيقية", nameEn: "Applied Math", icon: "📊" },
    { id: "physics", nameAr: "الفيزياء", nameEn: "Physics", icon: "⚛️" },
    { id: "chemistry", nameAr: "الكيمياء", nameEn: "Chemistry", icon: "🧪" },
  ],
  "الصف الثالث الثانوي-أدبي": [
    { id: "arabic", nameAr: "اللغة العربية", nameEn: "Arabic", icon: "📖" },
    { id: "english", nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "🔤" },
    { id: "history", nameAr: "التاريخ", nameEn: "History", icon: "🏛️" },
    { id: "geography", nameAr: "الجغرافيا", nameEn: "Geography", icon: "🌍" },
    { id: "philosophy_logic", nameAr: "الفلسفة والمنطق", nameEn: "Philosophy & Logic", icon: "🤔" },
    { id: "psychology", nameAr: "علم النفس والاجتماع", nameEn: "Psychology & Sociology", icon: "🧠" },
  ],
};

export function getSubjectsForGradeTrack(grade: Grade, track?: Track | null): SubjectConfig[] {
  if (grade === "الصف الأول الثانوي") {
    return SUBJECTS_CONFIG[grade] || [];
  }
  if (!track) return [];
  const key = `${grade}-${track}`;
  return SUBJECTS_CONFIG[key] || [];
}
