"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { v4 as uuidv4 } from "uuid";

export interface UserProfile {
  uid: string;
  email: string;
  uuid: string;
  grade: string | null;
  track: string | null;
  role: "user" | "admin";
  subscription: "free" | "basic" | "pro" | "premium";
  subscriptionActive: boolean;
  streak: number;
  lastActiveDate: string | null;
  weeklySubjects: string[];
  preferredPersona: "ing.Mohamed" | "Dr.Basmala";
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Create profile if not exists (for existing auth users)
        const newProfile: UserProfile = {
          uid,
          email: user?.email || "",
          uuid: uuidv4(),
          grade: null,
          track: null,
          role: "user",
          subscription: "free",
          subscriptionActive: false,
          streak: 0,
          lastActiveDate: null,
          weeklySubjects: [],
          preferredPersona: "ing.Mohamed",
          createdAt: new Date().toISOString()
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (e) {
      console.error("Error fetching profile", e);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
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
  }, [profile?.lastActiveDate, user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
