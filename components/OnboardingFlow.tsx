"use client";
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { GRADES, TRACKS, Grade, Track } from "@/lib/subjects";
import { Check, GraduationCap, FlaskConical } from "lucide-react";

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGradeSelect = (grade: Grade) => {
    setSelectedGrade(grade);
    if (grade === "الصف الأول الثانوي") {
      setSelectedTrack(null);
      setStep(3); // skip track, go to confirmation
    } else {
      setStep(2);
    }
  };

  const handleComplete = async () => {
    if (!user || !selectedGrade) return;
    setLoading(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        grade: selectedGrade,
        track: selectedTrack,
      }, { merge: true });
      await refreshProfile();
      onComplete();
    } catch (e) {
      console.error(e);
      alert("حدث خطأ، حاول تاني");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">Meafer.ai</h1>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full">
              خطوة {step} من {selectedGrade === "الصف الأول الثانوي" ? 2 : 3}
            </span>
          </div>
          <div className="flex gap-2">
            {[1,2,3].map(i => (
              <div key={i} className={`h-2 flex-1 rounded-full transition-all ${i <= step ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"}`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <GraduationCap className="text-white" size={32} />
                </div>
                <h2 className="text-2xl font-bold">أنت في سنة كام؟</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">ده هيحدد منهجك وطريقة الشرح</p>
              </div>

              {GRADES.map((grade) => (
                <button
                  key={grade}
                  onClick={() => handleGradeSelect(grade)}
                  className={`w-full p-4 rounded-2xl border-2 text-right flex items-center justify-between transition-all hover:scale-[1.02] ${
                    selectedGrade === grade ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-100 dark:border-gray-700 hover:border-indigo-200"
                  }`}
                >
                  <div>
                    <p className="font-bold">{grade}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {grade === "الصف الأول الثانوي" && "سنة تأسيسية • شعبة عامة"}
                      {grade === "الصف الثاني الثانوي" && "بداية التخصص • علمي/أدبي"}
                      {grade === "الصف الثالث الثانوي" && "سنة الحسم • الثانوية العامة 🎯"}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedGrade === grade ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"}`}>
                    {selectedGrade === grade && <Check size={14} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <FlaskConical className="text-white" size={32} />
                </div>
                <h2 className="text-2xl font-bold">شعبتك إيه؟</h2>
                <p className="text-gray-500 text-sm mt-1">علمي علوم / علمي رياضة / أدبي</p>
              </div>

              {TRACKS.map((track) => (
                <button
                  key={track}
                  onClick={() => { setSelectedTrack(track); setStep(3); }}
                  className={`w-full p-4 rounded-2xl border-2 text-right flex items-center justify-between transition-all hover:scale-[1.02] ${
                    selectedTrack === track ? "border-violet-600 bg-violet-50 dark:bg-violet-900/20" : "border-gray-100 dark:border-gray-700"
                  }`}
                >
                  <div>
                    <p className="font-bold">{track}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {track === "علمي علوم" && "أحياء • كيمياء • فيزياء • جيولوجيا"}
                      {track === "علمي رياضة" && "رياضة بحتة • تطبيقية • فيزياء • كيمياء"}
                      {track === "أدبي" && "تاريخ • جغرافيا • فلسفة • علم نفس"}
                    </p>
                  </div>
                  <div className="text-2xl">
                    {track === "علمي علوم" && "🧬"}
                    {track === "علمي رياضة" && "📐"}
                    {track === "أدبي" && "📚"}
                  </div>
                </button>
              ))}

              <button onClick={() => setStep(1)} className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700">← رجوع</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="text-green-600" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">ممتاز! 🎉</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  سجلناك في<br />
                  <span className="font-bold text-indigo-600 text-lg">{selectedGrade}</span><br />
                  {selectedTrack && <span className="font-bold">{selectedTrack}</span>}
                </p>
                <p className="text-xs text-gray-500 mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                  كل الملخصات والكويزات هتكون مخصصة لمنهجك بأسلوب وزارة التربية والتعليم المصرية.<br />
                  تقدر تغير الشعبة/السنة في أي وقت من الإعدادات.
                </p>
              </div>

              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {loading ? "جاري الحفظ..." : "يلا نبدأ المذاكرة 🚀"}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
