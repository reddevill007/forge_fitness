"use client";

import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import { useUserData } from "@/src/lib/firebase/user-data-context";

function relativeDayLabel(iso: string) {
  const started = new Date(iso);
  if (Number.isNaN(started.getTime())) return "your last session";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfSession = new Date(started);
  startOfSession.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfSession.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff <= 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return started.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AutoSubmitNotice() {
  const { autoSubmittedNotice, dismissAutoSubmittedNotice } = useUserData();

  useEffect(() => {
    if (!autoSubmittedNotice) return;
    const timer = window.setTimeout(() => dismissAutoSubmittedNotice(), 12000);
    return () => window.clearTimeout(timer);
  }, [autoSubmittedNotice, dismissAutoSubmittedNotice]);

  if (!autoSubmittedNotice) return null;

  const when = relativeDayLabel(autoSubmittedNotice.startedAt);
  const setLabel = autoSubmittedNotice.setCount === 1 ? "set" : "sets";

  return (
    <div className="auto-submit-notice" role="status" aria-live="polite">
      <span className="auto-submit-notice-icon" aria-hidden="true">
        <CheckCircle2 size={18} />
      </span>
      <div className="auto-submit-notice-body">
        <strong>Saved {when}&apos;s session</strong>
        <p>
          {autoSubmittedNotice.workoutName} · {autoSubmittedNotice.setCount} logged {setLabel}. You forgot to hit finish, so Forge submitted it for you.
        </p>
        <Link href="/history" className="auto-submit-notice-link" onClick={dismissAutoSubmittedNotice}>
          View in history
        </Link>
      </div>
      <button
        type="button"
        className="auto-submit-notice-close"
        aria-label="Dismiss"
        onClick={dismissAutoSubmittedNotice}
      >
        <X size={16} />
      </button>
    </div>
  );
}
