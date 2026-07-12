// CLIENT-SAFE FILE. Contains no API keys. Every function here calls our own
// server route (/api/gemini) which holds the real Gemini API key and never
// ships it to the browser. Function names/signatures match the old direct
// implementation so components don't need to change.
import { auth } from "@/lib/firebase";

export type AIPersona = "ing.Mohamed" | "Dr.Basmala";

async function callGeminiApi(payload: Record<string, any>) {
  const user = auth.currentUser;
  if (!user) throw new Error("not_authenticated");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("rate_limited");
    if (res.status === 401) throw new Error("not_authenticated");
    throw new Error("gemini_request_failed");
  }
  return res.json();
}

export async function generateWithGemini(
  prompt: string,
  persona: AIPersona,
  grade: string,
  track: string,
  subject?: string
) {
  try {
    const { text } = await callGeminiApi({ action: "chat", prompt, persona, grade, track, subject });
    return text as string;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "⚠️ حصلت مشكلة في الاتصال، حاول تاني كمان شوية.";
  }
}

export async function generateSummary(pdfText: string, grade: string, track: string, subject: string, length: "short" | "medium" | "long" = "medium") {
  const { text } = await callGeminiApi({ action: "summary", pdfText, grade, track, subject, length });
  return text as string;
}

export async function generateQuiz(pdfText: string, grade: string, track: string, subject: string, count: number = 5) {
  const { data } = await callGeminiApi({ action: "quiz", pdfText, grade, track, subject, count });
  return data;
}

export async function generateFlashcards(pdfText: string, grade: string, track: string, subject: string) {
  const { data } = await callGeminiApi({ action: "flashcards", pdfText, grade, track, subject });
  return data;
}

export async function generateAudioScript(pdfText: string, grade: string, track: string, subject: string) {
  const { text } = await callGeminiApi({ action: "audio", pdfText, grade, track, subject });
  return text as string;
}
