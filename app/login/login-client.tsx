"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ForgeMark } from "@/src/components/doodles";
import { useAuth } from "@/src/lib/firebase/auth-context";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const { user, loading, configured, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [user, loading, router, next]);

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, displayName.trim());
      }
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <h1>Firebase not configured</h1>
          <p>Add <code>NEXT_PUBLIC_FIREBASE_*</code> keys to <code>.env.local</code> and restart the dev server.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="login-screen">
        <div className="auth-spinner" aria-hidden="true" />
        <p>Checking session…</p>
      </main>
    );
  }

  return (
    <main className="login-screen">
      <section className="login-card reveal">
        <Link className="brand login-brand" href="/">
          <ForgeMark />
          <span>FORGE</span>
        </Link>
        <span className="eyebrow">Your training journal</span>
        <h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1>
        <p>Sign in to save workouts, history, records, and measurements. You stay logged in on this device.</p>

        <button className="primary-button login-google" type="button" onClick={handleGoogle} disabled={submitting}>
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        <form className="login-form" onSubmit={handleEmailSubmit}>
          {mode === "signup" && (
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button dark-button" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="text-button login-toggle"
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
