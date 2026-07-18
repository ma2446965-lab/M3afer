"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";

// UserProfile + doc→profile normalization live in lib/profile.ts (pure, no
// Firebase imports) so they're unit-testable. The normalizer makes hand-made
// admin docs (usually just {role:"admin"}) safe to render on every page.
import { normalizeProfile, type UserProfile } from "@/lib/profile";
export type { UserProfile };

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  // Set when loading the Firestore profile FAILS (rules deny access, network
  // error, missing env config...). Lets pages show an explicit error state
  // instead of the old silent failures (endless spinner / silent redirect).
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileError: null,
  refreshProfile: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchProfile = async (uid: string, emailFallback?: string | null) => {
    setProfileError(null);
    try {
      const docRef = doc(db, "users", uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        // Was: setProfile(snap.data() as UserProfile) — trusted the doc shape
        // blindly; hand-made admin docs missing `email` then crashed /profile
        // at render (profile.email[0]). Normalize instead.
        setProfile(normalizeProfile(snap.data(), uid, emailFallback));
      } else {
        // Create profile if not exists (for existing auth users)
        const newProfile: UserProfile = {
          uid,
          email: emailFallback || user?.email || "",
          uuid: uuidv4(),
          grade: null,
          track: null,
          role: "user",
          subscription: "free",
          subscriptionActive: false,
          subscribed: false,
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          streak: 0,
          lastActiveDate: null,
          weeklySubjects: [],
          preferredPersona: "ing.Mohamed",
          createdAt: new Date().toISOString()
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (e: any) {
      // OLD BUG: this error was swallowed with console.error only, leaving
      // profile = null forever. /admin then either redirected a legit admin
      // to home silently, or showed "جاري التحقق..." indefinitely.
      console.error("Error fetching profile", e);
      setProfile(null);
      setProfileError(
        e?.code === "permission-denied"
          ? "Firestore رفض قراءة مستند المستخدم (permission-denied) — راجع Security Rules لمجموعة users"
          : e?.message || "تعذر تحميل بيانات المستخدم من Firestore"
      );
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid, user.email);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setProfileError(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // OLD BUG: fetchProfile used the stale `user` state for the email of
        // newly-created profiles (state isn't updated yet inside this
        // callback) — profiles could be created with an empty email.
        // The email is now passed through as a parameter.
        await fetchProfile(firebaseUser.uid, firebaseUser.email);
      } else {
        setProfile(null);
        setProfileError(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daily streak update
  useEffect(() => {
    if (profile && user) {
      const today = new Date().toDateString();
      if (profile.lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isConsecutive = profile.lastActiveDate === yesterday.toDateString();
        const newStreak = isConsecutive ? profile.streak + 1 : 1;

        const updateStreak = async () => {
          try {
            const docRef = doc(db, "users", user.uid);
            await setDoc(docRef, {
              ...profile,
              streak: newStreak,
              lastActiveDate: today
            }, { merge: true });
            setProfile(prev => prev ? { ...prev, streak: newStreak, lastActiveDate: today } : prev);
          } catch (e) {
            console.error("Streak update failed", e);
          }
        };
        updateStreak();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.lastActiveDate, user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
