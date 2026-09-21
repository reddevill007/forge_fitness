"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Scribble } from "@/src/components/doodles";
import { useUserData } from "@/src/lib/firebase/user-data-context";

const AUTO_DISMISS_MS = 14000;

function relativeDayLabel(iso: string) {
  const started = new Date(iso);
  if (Number.isNaN(started.getTime())) return "last session";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfSession = new Date(started);
  startOfSession.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfSession.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff <= 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return started.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeLabel(iso: string) {
  const started = new Date(iso);
  if (Number.isNaN(started.getTime())) return "";
  return started.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function AutoSubmitNotice() {
  const { autoSubmittedNotice, dismissAutoSubmittedNotice } = useUserData();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!autoSubmittedNotice) return;
    setLeaving(false);
    const dismissTimer = window.setTimeout(() => setLeaving(true), AUTO_DISMISS_MS - 320);
    const removeTimer = window.setTimeout(() => dismissAutoSubmittedNotice(), AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(dismissTimer);
      window.clearTimeout(removeTimer);
    };
  }, [autoSubmittedNotice, dismissAutoSubmittedNotice]);

  if (!autoSubmittedNotice) return null;

  const when = relativeDayLabel(autoSubmittedNotice.startedAt);
  const clock = timeLabel(autoSubmittedNotice.startedAt);
  const sets = autoSubmittedNotice.setCount;
  const setLabel = sets === 1 ? "set" : "sets";

  function close() {
    setLeaving(true);
    window.setTimeout(dismissAutoSubmittedNotice, 260);
  }

  return (
    <aside
      className={`auto-submit-notice ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="auto-submit-notice-ribbon" aria-hidden="true" />
      <div className="auto-submit-notice-stamp" aria-hidden="true">
        <span className="auto-submit-notice-stamp-ring" />
        <Check size={22} strokeWidth={3} />
      </div>

      <div className="auto-submit-notice-body">
        <span className="auto-submit-notice-eyebrow">Auto-saved</span>
        <span className="auto-submit-notice-tag" aria-hidden="true">from {when}</span>
        <h3 className="auto-submit-notice-title">{autoSubmittedNotice.workoutName}</h3>
        <Scribble className="auto-submit-notice-scribble" />
        <dl className="auto-submit-notice-meta">
          <div>
            <dt>Sets</dt>
            <dd>{sets}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{clock || "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Logged</dd>
          </div>
        </dl>
        <p className="auto-submit-notice-copy">
          You didn&apos;t hit finish, so Forge saved the {sets} {setLabel} for you. Nothing lost.
        </p>
        <div className="auto-submit-notice-actions">
          <Link href="/history" className="auto-submit-notice-link" onClick={close}>
            Open in history
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <button
        type="button"
        className="auto-submit-notice-close"
        aria-label="Dismiss"
        onClick={close}
      >
        <X size={15} />
      </button>

      <span className="auto-submit-notice-progress" aria-hidden="true">
        <i style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }} />
      </span>
    </aside>
  );
}
