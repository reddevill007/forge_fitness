"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/firebase/auth-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!configured) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, loading, configured, router, pathname]);

  if (!configured) {
    return (
      <div className="auth-loading">
        <p>Firebase is not configured. Add your Firebase keys to <code>.env.local</code>.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" aria-hidden="true" />
        <p>Loading your account…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" aria-hidden="true" />
        <p>Redirecting to sign in…</p>
      </div>
    );
  }

  return children;
}
