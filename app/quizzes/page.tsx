"use client";
import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import FloatingChat from "@/components/FloatingChat";
import { Brain, Check, X, Trophy, RotateCcw, Flame } from "lucide-react";

interface QuizAttempt {
  id: string;
  subject: string;
  score: number;
  total: number;
  date: string;
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const pdfs = localStorage.getItem("meafer_pdfs");
      if (pdfs) {
        const parsed = JSON.parse(pdfs);
        return parsed.filter((p: any) => p.quiz?.questions?.length > 0).flatMap((p: any) => p.quiz.questions.map((q: any) => ({ ...q, source: p.fileName, subjectAr: p.subjectAr })));
      }
    }
    return [];
  });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("meafer_attempts");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const currentQuestion = quizzes[currentIndex];

  useEffect(() => {
    localStorage.setItem("meafer_attempts", JSON.stringify(attempts));
  }, [attempts]);

  const handleAnswer = () => {
    if (selectedOption === null || !currentQuestion) return;
    if (selectedOption === currentQuestion.correctAnswer) {
      setScore(s => s + 1);
    }
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIndex < quizzes.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      // Finish
      const attempt: QuizAttempt = {
        id: Date.now().toString(),
        subject: currentQuestion?.subjectAr || "عام",
        score: score + (selectedOption === currentQuestion.correctAnswer ? 1 : 0),
        total: quizzes.length,
        date: new Date().toISOString()
      };
      setAttempts(prev => [attempt, ...prev]);
      setTimeout(() => {
        setCurrentIndex(0);
        setScore(0);
        setSelectedOption(null);
        setShowResult(false);
      }, 2000);
    }
  };

  if (quizzes.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24">
        <HamburgerMenu />
        <FloatingChat />
        <BottomNav />
        <div className="max-w-5xl mx-auto p-4 pt-16 text-center py-20">
          <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain size={32} className="text-violet-600" />
          </div>
          <h2 className="text-xl font-bold">لسه مفيش كويزات</h2>
          <p className="text-sm text-gray-500 mt-2">ارفع ملزمة من المكتبة وهيتم توليد كويزات بنظام الوزارة تلقائياً</p>
          <a href="/library" className="inline-block mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">روح المكتبة 📚</a>
        </div>
      </div>
    );
  }

  const isLastQuestion = currentIndex === quizzes.length - 1;
  const progress = ((currentIndex + 1) / quizzes.length) * 100;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 pb-24">
      <HamburgerMenu />
      <FloatingChat />
      <BottomNav />

      <div className="max-w-2xl mx-auto p-4 pt-16">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="text-violet-600" /> الكويزات
            </h1>
            <p className="text-xs text-gray-500">نظام البابل شيت • أسئلة وزارة حقيقية</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl px-3 py-2 shadow-sm border flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            <span className="font-bold text-sm">{score}/{quizzes.length}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-full h-2 mb-6 overflow-hidden border">
          <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[11px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full font-medium">
                سؤال {currentIndex + 1} من {quizzes.length} • {currentQuestion.type || "متنوع"}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded-full ${currentQuestion.difficulty === "hard" ? "bg-red-50 text-red-600" : currentQuestion.difficulty === "medium" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                {currentQuestion.difficulty || "متوسط"}
              </span>
            </div>

            <h2 className="font-bold text-lg leading-relaxed">{currentQuestion.question}</h2>
            <p className="text-xs text-gray-400 mt-2">المصدر: {currentQuestion.source} • {currentQuestion.subjectAr}</p>

            <div className="mt-6 space-y-2.5">
              {currentQuestion.options?.map((opt: string, idx: number) => {
                const isSelected = selectedOption === idx;
                const isCorrect = currentQuestion.correctAnswer === idx;
                const showCorrect = showResult && isCorrect;
                const showWrong = showResult && isSelected && !isCorrect;

                return (
                  <button
                    key={idx}
                    onClick={() => !showResult && setSelectedOption(idx)}
                    className={`w-full text-right p-4 rounded-xl border-2 transition-all flex items-center justify-between
                      ${!showResult && isSelected ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"}
                      ${showCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}
                      ${showWrong ? "border-red-500 bg-red-50 dark:bg-red-900/20" : ""}
                    `}
                  >
                    <span className="text-sm">{opt}</span>
                    {showCorrect && <Check size={18} className="text-green-600" />}
                    {showWrong && <X size={18} className="text-red-600" />}
                  </button>
                );
              })}
            </div>

            {showResult && (
              <div className="mt-4 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/20 animate-in fade-in">
                <p className="text-sm font-bold text-sky-800 dark:text-sky-200">💡 الشرح:</p>
                <p className="text-sm text-sky-700 dark:text-sky-300 mt-1">{currentQuestion.explanation}</p>
              </div>
            )}

            <div className="mt-6">
              {!showResult ? (
                <button
                  onClick={handleAnswer}
                  disabled={selectedOption === null}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 hover:scale-[1.01] transition"
                >
                  تأكيد الإجابة
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition"
                >
                  {isLastQuestion ? (
                    <>
                      <Trophy size={18} /> إنهاء الكويز
                    </>
                  ) : (
                    <>
                      السؤال التالي <span>→</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recent Attempts */}
        {attempts.length > 0 && (
          <div className="mt-8">
            <h3 className="font-bold mb-3">محاولاتك الأخيرة 🏆</h3>
            <div className="space-y-2">
              {attempts.slice(0, 5).map(at => (
                <div key={at.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{at.subject}</p>
                    <p className="text-xs text-gray-500">{new Date(at.date).toLocaleDateString("ar-EG")}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{at.score}/{at.total}</p>
                    <p className="text-xs text-gray-500">{Math.round((at.score/at.total)*100)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
