// SERVER-ONLY: Firebase Admin SDK singleton for API routes.
// Uses the same FIREBASE_ADMIN_* env vars as app/api/gemini/route.ts.
// Never import this from client components.
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const app: App = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")
      })
    });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
