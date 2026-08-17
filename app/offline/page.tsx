"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="login-screen">
      <section className="login-card">
        <WifiOff size={28} />
        <span className="eyebrow">Offline</span>
        <h1>You are offline.</h1>
        <p>Open a page you already visited, or reconnect to load new catalog pages. Your workouts and logs stay on this device.</p>
        <Link className="primary-button" href="/">Go home</Link>
      </section>
    </main>
  );
}
