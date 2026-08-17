import { Suspense } from "react";
import LoginPageClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-screen"><p>Loading…</p></main>}>
      <LoginPageClient />
    </Suspense>
  );
}
