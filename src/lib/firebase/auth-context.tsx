"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ensureAuthPersistence, getFirebaseAuth } from "@/src/lib/firebase/client";
import { ensureUserProfile } from "@/src/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/src/lib/firebase/config";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let unsubscribe: (() => void) | undefined;

    ensureAuthPersistence()
      .then(() => {
        const auth = getFirebaseAuth();
        if (!auth) {
          setLoading(false);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          if (nextUser?.email) {
            await ensureUserProfile(
              nextUser.uid,
              nextUser.email,
              nextUser.displayName ?? "",
            ).catch(() => undefined);
          }
          setUser(nextUser);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));

    return () => unsubscribe?.();
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName?.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
    }),
    [user, loading, configured, signInWithGoogle, signInWithEmail, signUpWithEmail, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
