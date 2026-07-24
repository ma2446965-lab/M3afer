"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSubjectsForGradeTrack } from "@/lib/subjects";
import { Upload, FileText, Sparkles, Brain, Headphones, Search, Filter } from "lucide-react";
import { generateSummary, generateQuiz, generateFlashcards, generateAudioScript } from "@/lib/gemini";
import { extractPdfText } from "@/lib/pdf-text";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

interface ProcessedPDF {
  id: string;
  fileName: string;
  subject: string;
  subjectAr: string;
  uploadedAt: string;
  summary?: string;
  quiz?: any;
  flashcards?: any;
  audioScript?: string;
  /** how many of the 4 AI outputs failed to generate (0 = all good) */
  aiFailed?: number;
  status: "processing" | "done";
}

export default function LibraryPage() {
  const { profile, user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfs, setPdfs] = useState<ProcessedPDF[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("meafer_pdfs");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [activeTab, setActiveTab] = useState<"summary" | "quiz" | "flashcards" | "audio">("summary");
  const [selectedPdf, setSelectedPdf] = useState<ProcessedPDF | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [processErr, setProcessErr] = useState("");

  const subjects = profile ? getSubjectsForGradeTrack(profile.grade as any, profile.track as any) : [];

  useEffect(() => {
    localStorage.setItem("meafer_pdfs", JSON.stringify(pdfs));
  }, [pdfs]);

  const handleUpload = async () => {
    if (!file || !selectedSubject || !profile || !user) return;
    setIsProcessing(true);
    setProcessErr("");

    const subjectObj = subjects.find(s => s.id === selectedSubject);

    try {
      // 1) REAL text extraction from the uploaded PDF (client-side pdfjs).
      let pdfText = "";
      try {
        pdfText = await extractPdfText(await file.arrayBuffer());
      } catch (e) {
        console.error("pdf extract failed", e);
      }
      if (pdfText.length < 60) {
        setProcessErr("مقدرناش نقرأ نص من الملف ده — غالبًا سكانر/صور مش PDF نصي. جرب نسخة نصية أو PDF من مصدر واضح 📄");
        return;
      }

      // 2) Archive the file in Storage (best-effort — never blocks the AI flow).
      const storageRef = ref(storage, `users/${user.uid}/pdfs/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file).catch(() => {});

      const newPdf: ProcessedPDF = {
        id: Date.now().toString(),
        fileName: file.name,
        subject: selectedSubject,
        subjectAr: subjectObj?.nameAr || selectedSubject,
        uploadedAt: new Date().toISOString(),
        status: "processing"
      };

      setPdfs(prev => [newPdf, ...prev]);

      // 3) AI generation on the REAL text — all-settled so one weak piece
      //    (e.g. audio script on a long doc) never kills the rest.
      const grade = profile.grade || "", track = profile.track || "", subj = subjectObj?.nameAr || "";
      const [summaryR, quizR, flashR, audioR] = await Promise.allSettled([
        generateSummary(pdfText, grade, track, subj, "medium"),
        generateQuiz(pdfText, grade, track, subj, 5),
        generateFlashcards(pdfText, grade, track, subj),
        generateAudioScript(pdfText, grade, track, subj)
      ]);
      const took = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : null);
      const failed = [summaryR, quizR, flashR, audioR].filter(r => r.status === "rejected").length;

      const completedPdf: ProcessedPDF = {
        ...newPdf,
        summary: took(summaryR) || undefined,
        quiz: took(quizR) || undefined,
        flashcards: took(flashR) || undefined,
        audioScript: took(audioR) || undefined,
        aiFailed: failed,
        status: "done"
      };

      if (failed === 4) {
        // Everything failed (most likely AI key/config) — keep the file but say so.
        setProcessErr("الملف اترفع بس الـ AI مش راضي يولّد دلوقتي — تأكد إن مفتاح Gemini متظبط وجرّب تاني من الملف ⚠️");
      } else if (failed > 0) {
        setProcessErr("بعض مخرجات الـ AI متكتملتش — الملخص والباقي ظاهر تحت عادي ✅");
      }

      setPdfs(prev => prev.map(p => p.id === newPdf.id ? completedPdf : p));
      setSelectedPdf(completedPdf);
      setFile(null);
      setSelectedSubject("");

    } catch (e) {
      console.error(e);
      setProcessErr("حصل خطأ غير متوقع في المعالجة — حاول تاني");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPdfs = pdfs.filter(p => 
    p.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.subjectAr.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 pb-24">

      <div className="max-w-5xl mx-auto p-4 pt-6 md:pt-10">
        <h1 className="text-2xl font-bold">المكتبة 📚</h1>
        <p className="text-sm text-gray-500">كل ملازمك وملخصاتك في مكان واحد</p>

        {/* Upload Card */}
        <div className="mt-6 bg-white dark:bg-navy-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-navy-700">
          <h3 className="font-bold flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
              <Upload size={16} className="text-brand-600" />
            </div>
            ارفع ملزمة جديدة
          </h3>
          
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium">اختر المادة</label>
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-700 text-sm"
              >
                <option value="">اختر المادة...</option>
                {subjects.map(subj => (
                  <option key={subj.id} value={subj.id}>{subj.icon} {subj.nameAr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">الملف (PDF)</label>
              <div className="mt-1 border-2 border-dashed border-gray-200 dark:border-navy-700 rounded-xl p-6 text-center hover:border-brand-300 transition">
                <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload" />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <FileText className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm font-medium">{file ? file.name : "اضغط لاختيار PDF"}</p>
                  <p className="text-xs text-gray-400 mt-1">حتى 20MB • هيتم حفظه بشكل آمن</p>
                </label>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || !selectedSubject || isProcessing}
              className="w-full bg-gradient-to-r from-brand-700 to-brand-500 text-white py-3 rounded-xl font-bold disabled:opacity-50 hover:scale-[1.01] transition"
            >
              {isProcessing ? "بنقرأ الملف ونلخصه بـ AI... 🧠" : "رفع ومعالجة بالـ AI ✨"}
            </button>

            {!!processErr && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 rounded-xl leading-relaxed">
                {processErr}
              </p>
            )}

            <p className="text-[11px] text-center text-gray-400">
              بنقرأ الـ PDF نفسه ونطلعلك: ملخص مراجعة نهائية + كويز بنظام الوزارة + فلاش كاردز + سكريبت بودكاست
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث في المكتبة..."
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm"
          />
        </div>

        {/* PDF List */}
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {filteredPdfs.map(pdf => (
            <div key={pdf.id} onClick={() => setSelectedPdf(pdf)} className="bg-white dark:bg-navy-800 rounded-2xl p-4 border border-gray-100 dark:border-navy-700 hover:shadow-md transition cursor-pointer">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                    <FileText size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm truncate max-w-[180px]">{pdf.fileName}</p>
                    <p className="text-xs text-gray-500">{pdf.subjectAr} • {new Date(pdf.uploadedAt).toLocaleDateString("ar-EG")}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${pdf.status === "done" ? "bg-green-50 text-green-600" : "bg-accent-50 text-accent-600"}`}>
                  {pdf.status === "done" ? "جاهز" : "بيتعالج..."}
                </span>
              </div>
              {pdf.status === "done" && (
                <div className="mt-3 flex gap-1.5">
                  <span className="text-[10px] bg-brand-50 dark:bg-brand-900/20 text-brand-600 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={10} /> ملخص</span>
                  <span className="text-[10px] bg-brand-50 dark:bg-brand-900/20 text-brand-600 px-2 py-1 rounded-full flex items-center gap-1"><Brain size={10} /> كويز</span>
                  <span className="text-[10px] bg-brand-50 dark:bg-brand-900/20 text-brand-600 px-2 py-1 rounded-full flex items-center gap-1"><Headphones size={10} /> صوتي</span>
                </div>
              )}
            </div>
          ))}
          {filteredPdfs.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-50" />
              <p>لسه مرفعتش أي ملفات</p>
              <p className="text-xs mt-1">ارفع أول ملزمة وهيتم تحويلها لمراجعة نهائية</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedPdf && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-white dark:bg-navy-900 w-full md:max-w-3xl h-[90vh] md:h-[80vh] rounded-t-[32px] md:rounded-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b dark:border-navy-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold">{selectedPdf.fileName}</h3>
                <p className="text-xs text-gray-500">{selectedPdf.subjectAr} • مراجعة نهائية</p>
              </div>
              <button onClick={() => setSelectedPdf(null)} className="p-2 bg-gray-100 dark:bg-navy-800 rounded-full">✕</button>
            </div>

            <div className="flex gap-1 p-2 bg-gray-50 dark:bg-navy-800/50">
              {[
                { id: "summary", label: "الملخص", icon: Sparkles },
                { id: "quiz", label: "كويز", icon: Brain },
                { id: "flashcards", label: "فلاش", icon: FileText },
                { id: "audio", label: "بودكاست", icon: Headphones },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition ${activeTab === tab.id ? "bg-white dark:bg-navy-700 shadow-sm text-brand-600 dark:text-white" : "text-gray-500"}`}>
                  <tab.icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "summary" && (
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed bg-accent-50/50 dark:bg-accent-900/10 p-4 rounded-xl border border-accent-100 dark:border-accent-900/20">
                    {selectedPdf.summary || (selectedPdf.status === "done" ? "الملخص ده مش متوفر للملف ده — جرب رفع نسخة أوضح أو كمان شوية." : "جاري توليد الملخص...")}
                  </div>
                </div>
              )}
              {activeTab === "quiz" && (
                <div className="space-y-3">
                  {selectedPdf.quiz?.questions?.length ? selectedPdf.quiz.questions.map((q: any, i: number) => (
                    <div key={i} className="bg-gray-50 dark:bg-navy-800 p-4 rounded-xl border dark:border-navy-700">
                      <p className="font-medium text-sm">س{i+1}: {q.question}</p>
                      <p className="text-[11px] text-brand-600 mt-1">{q.type} • {q.difficulty}</p>
                      <div className="mt-2 space-y-1.5">
                        {q.options?.map((opt: string, j: number) => (
                          <div key={j} className={`p-2 rounded-lg text-sm border ${j === q.correctAnswer ? "bg-green-50 border-green-200 text-green-700" : "bg-white dark:bg-navy-700 border-gray-100 dark:border-navy-600"}`}>{opt}</div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">💡 {q.explanation}</p>
                    </div>
                  )) : <p className="text-sm text-gray-500 whitespace-pre-wrap">{JSON.stringify(selectedPdf.quiz, null, 2) || "لا يوجد كويز"}</p>}
                </div>
              )}
              {activeTab === "flashcards" && (
                <div className="grid gap-3">
                  {selectedPdf.flashcards?.flashcards?.map((fc: any, i: number) => (
                    <div key={i} className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-violet-100 dark:border-brand-800/50">
                      <p className="font-bold text-sm">❓ {fc.front}</p>
                      <p className="text-sm mt-2 text-navy-700 dark:text-gray-300">✅ {fc.back}</p>
                      {fc.hint && <p className="text-xs text-gray-500 mt-1">💡 تلميح: {fc.hint}</p>}
                    </div>
                  )) || <p className="text-sm text-gray-500">{selectedPdf.flashcards?.raw || "لا يوجد فلاش كاردز"}</p>}
                </div>
              )}
              {activeTab === "audio" && (
                <div>
                  <div className="bg-gradient-to-br from-brand-50 to-slate-50 dark:from-sky-900/10 dark:to-indigo-900/10 p-4 rounded-xl border border-brand-100 dark:border-brand-900/20">
                    <p className="text-xs font-bold text-brand-700 dark:text-brand-300 mb-2">🎙️ سكريبت بودكاست (NotebookLM Style) — اقرأه بنفسك أو اسمعه لحد يشرحهولك</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedPdf.audioScript || (selectedPdf.status === "done" ? "السكريبت ده مش متوفر للملف ده حاليًا." : "جاري توليد السكريبت...")}</p>
                  </div>
                  <p className="mt-3 text-[11px] text-center text-gray-400">تحويل السكريبت لصوت فعلي جاي في تحديث قريب 🔊</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
