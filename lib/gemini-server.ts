// SERVER-ONLY FILE. Never import this from a "use client" component —
// it uses the private GEMINI_API_KEY and must only run inside app/api/* route handlers.
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export type AIPersona = "ing.Mohamed" | "Dr.Basmala";

export function getSystemPrompt(persona: AIPersona, grade: string, track: string, subject?: string) {
  const baseContext = `أنت مساعد ذكاء اصطناعي مصمم خصيصاً لطالب ثانوية عامة مصري.
الطالب في: ${grade} - ${track ? `${track}` : 'شعبة عامة'} ${subject ? ` - مادة ${subject}` : ''}.
الثانوية العامة نظام مصيري وضغط عالي، فلازم تكون متفهم للضغط ده وتدعم الطالب نفسياً.
لازم ترد بالعامية المصرية بشكل أساسي، إلا لو الطالب طلب لغة تانية.
لازم تستخدم مصطلحات وزارة التربية والتعليم المصرية: مسائل تراكمية، سؤال البيانات، درجة التفكير الناقد، نماذج الوزارة، بنك المعرفة، نظام البابل شيت، إلخ.
اشرح بأسلوب المراجعة النهائية اللي الطلبة متعودين عليه.`;

  if (persona === "ing.Mohamed") {
    return `
${baseContext}

أنت "بشمهندس محمد - ing.Mohamed": مهندس ذكي، لماح، وبتحب الهزار. بتستخدم تشبيهات هندسية وتكنولوجية مضحكة.
مثلاً: "المعادلة دي زي كود بايظ لازم نعمله debug" أو "القانون ده زي الـ algorithm بتاع حياتك".
لو المادة رياضة / فيزياء / كيمياء للعلمي، اربط الشرح بطريقة أسئلة الوزارة مباشرة.
خليك witty، شجع الطالب يفكر بمنطق مهندس، واديله تحديات تفكير.
دايماً اختم بجملة تحفيزية بأسلوب مهندس روش: "يلا يا بشمهندس/يا بشمهندسة، نكمل السبرنت الجاي! 🚀"
`;
  } else {
    return `
${baseContext}

أنتِ "دكتورة بسملة - Dr.Basmala": دكتورة حنينة جداً، مشجعة، وبتحب تستخدم تشبيهات طبية وبيولوجية جميلة.
مثلاً: "الخلية دي زي مستشفى صغيرة كل عضي بيشتغل فيها" أو "المعلومة دي زي الـ DNA بتثبت في الذاكرة".
لو المادة أحياء / كيمياء، اربطي الشرح بطريقة أسئلة الوزارة مباشرة.
احتفلي بكل إنجاز صغير للطالب، واديله طاقة إيجابية، وطمنيه إن التوتر طبيعي في الثانوية العامة.
دايماً اختمي بجملة تشجيعية حنينة: "برافو يا دكتور/يا دكتورة المستقبل! أنا فخورة بيك جداً 💙🌸"
`;
  }
}

export async function generateWithGemini(
  prompt: string,
  persona: AIPersona,
  grade: string,
  track: string,
  subject?: string
) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const systemPrompt = getSystemPrompt(persona, grade, track, subject);
    const fullPrompt = `${systemPrompt}\n\nسؤال الطالب / المحتوى المطلوب معالجته:\n${prompt}\n\nردك:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("gemini_request_failed");
  }
}

export async function generateSummary(pdfText: string, grade: string, track: string, subject: string, length: "short" | "medium" | "long" = "medium") {
  const lengthMap = {
    short: "ملخص سريع في 5-7 نقاط رئيسية",
    medium: "ملخص متوسط شامل بأسلوب المراجعة النهائية (صفحة إلى صفحتين)",
    long: "ملخص تفصيلي جداً مع كل النقاط والتعريفات والقوانين المهمة"
  };

  const prompt = `
المطلوب: اعمل ${lengthMap[length]} للمحتوى التالي من مادة ${subject} لـ ${grade} - ${track}.

المحتوى:
${pdfText.slice(0, 15000)}

التعليمات:
- استخدم أسلوب المراجعة النهائية للثانوية العامة المصرية
- قسم الملخص لعناوين واضحة
- ضيف أهم القوانين / التعريفات / التواريخ لو المادة تحتاج
- في الآخر، اكتب "أهم 3 أسئلة متوقعة في الامتحان" على المحتوى ده بأسلوب وزارة التربية والتعليم
- رد بالعامية المصرية مع الحفاظ على المصطلحات العلمية الفصحى
`;
  return generateWithGemini(prompt, "Dr.Basmala", grade, track, subject);
}

export async function generateQuiz(pdfText: string, grade: string, track: string, subject: string, count: number = 5) {
  const prompt = `
المطلوب: اعمل ${count} أسئلة MCQ بنظام البابل شيت للثانوية العامة المصرية من المحتوى التالي.

المحتوى:
${pdfText.slice(0, 15000)}

التعليمات:
- الأسئلة لازم تكون بأسلوب وزارة التربية والتعليم المصرية الحقيقي
- استخدم أنواع الأسئلة: مسائل تراكمية، سؤال البيانات، درجة التفكير الناقد، اختيار من متعدد
- لكل سؤال، اعطي 4 اختيارات (أ، ب، ج، د)
- بعد كل الأسئلة، اكتب نموذج الإجابة مع شرح مختصر لكل إجابة
- المادة: ${subject} - ${grade} - ${track}
- رتب الأسئلة من السهل للصعب
- رجع الرد كـ JSON بالشكل ده:
{
  "questions": [
    {
      "id": 1,
      "question": "نص السؤال",
      "options": ["أ - ...", "ب - ...", "ج - ...", "د - ..."],
      "correctAnswer": 0,
      "explanation": "شرح الإجابة",
      "difficulty": "easy|medium|hard",
      "type": "تراكمي|بيانات|تفكير ناقد|مباشر"
    }
  ]
}

حاول ترجع JSON صالح فقط.
`;
  const response = await generateWithGemini(prompt, "ing.Mohamed", grade, track, subject);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { raw: response, questions: [] };
  } catch {
    return { raw: response, questions: [] };
  }
}

export async function generateFlashcards(pdfText: string, grade: string, track: string, subject: string) {
  const prompt = `
اعمل 10 flashcards من المحتوى ده لمادة ${subject}.

المحتوى:
${pdfText.slice(0, 12000)}

رجع JSON:
{
  "flashcards": [
    { "front": "السؤال / المصطلح", "back": "الإجابة / التعريف", "hint": "تلميح" }
  ]
}
`;
  const response = await generateWithGemini(prompt, "Dr.Basmala", grade, track, subject);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { raw: response, flashcards: [] };
  } catch {
    return { raw: response, flashcards: [] };
  }
}

export async function generateAudioScript(pdfText: string, grade: string, track: string, subject: string) {
  const prompt = `
اعمل سكريبت بودكاست تعليمي بأسلوب NotebookLM من المحتوى ده.

المحتوى:
${pdfText.slice(0, 10000)}

المطلوب:
- حوار بين مضيفين (مضيف ومضيفة) بيشرحوا المادة بأسلوب مسلي
- مدة الحوار حوالي 5 دقائق قراءة
- بأسلوب ثانوية عامة مصرية
- المادة: ${subject}

ارجع السكريبت كنص حواري.
`;
  return generateWithGemini(prompt, "ing.Mohamed", grade, track, subject);
}
