import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import {
  generateWithGemini,
  generateSummary,
  generateQuiz,
  generateFlashcards,
  generateAudioScript,
} from "@/lib/gemini-server";

// --- Firebase Admin setup (server-only, verifies the user's ID token) ---
// Requires these THREE env vars in .env.local (NOT prefixed with NEXT_PUBLIC_ —
// they must never reach the browser bundle). Get them from:
// Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
//   FIREBASE_ADMIN_PROJECT_ID=...
//   FIREBASE_ADMIN_CLIENT_EMAIL=...
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    return await getAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// Simple in-memory per-user rate limit (resets on server restart).
// Good enough to blunt casual abuse; swap for a durable store (Firestore/Redis) before scaling.
const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute

function isRateLimited(uid: string) {
  const now = Date.now();
  const timestamps = (requestLog.get(uid) || []).filter((t) => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(uid, timestamps);
  return timestamps.length > RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  const decodedToken = await requireUser(req);
  if (!decodedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isRateLimited(decodedToken.uid)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json();
  const { action, persona, grade, track, subject, prompt, pdfText, length, count } = body;

  try {
    switch (action) {
      case "chat": {
        const text = await generateWithGemini(prompt, persona, grade, track, subject);
        return NextResponse.json({ text });
      }
      case "summary": {
        const text = await generateSummary(pdfText, grade, track, subject, length);
        return NextResponse.json({ text });
      }
      case "quiz": {
        const data = await generateQuiz(pdfText, grade, track, subject, count);
        return NextResponse.json({ data });
      }
      case "flashcards": {
        const data = await generateFlashcards(pdfText, grade, track, subject);
        return NextResponse.json({ data });
      }
      case "audio": {
        const text = await generateAudioScript(pdfText, grade, track, subject);
        return NextResponse.json({ text });
      }
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch (e) {
    console.error("Gemini API route error:", e);
    return NextResponse.json({ error: "gemini_request_failed" }, { status: 502 });
  }
}
