"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCoachStamp, groupCoachThreads } from "@/src/lib/coach/history";
import { useCoach } from "@/src/lib/coach/context";

export function CoachHistoryList({
  onPick,
}: {
  onPick?: () => void;
}) {
  const coach = useCoach();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = !coach
      ? []
      : needle
        ? coach.threads.filter((thread) => (
          thread.title.toLowerCase().includes(needle)
          || thread.preview.toLowerCase().includes(needle)
        ))
        : coach.threads;
    return groupCoachThreads(items);
  }, [coach, query]);

  if (!coach) return null;

  return (
    <div className="coach-log">
      <header className="coach-log-head">
        <span className="eyebrow">Sessions</span>
        <strong>Atlas</strong>
      </header>

      <button
        type="button"
        className="coach-log-new"
        onClick={() => {
          coach.newChat();
          onPick?.();
        }}
      >
        <Plus size={16} />
        New chat
      </button>

      {coach.threads.length > 6 && (
        <label className="coach-log-find">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
          />
        </label>
      )}

      {coach.threads.length === 0 ? (
        <p className="coach-log-empty">Chats you start with Atlas land here.</p>
      ) : groups.length === 0 ? (
        <p className="coach-log-empty">Nothing matches “{query}”.</p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="coach-log-group">
            <h3>{group.label}</h3>
            <ol className="coach-log-list">
              {group.items.map((thread) => {
                const active = thread.id === coach.activeThreadId;
                return (
                  <li key={thread.id} className={active ? "is-active" : ""}>
                    <button
                      type="button"
                      className="coach-slip"
                      disabled={coach.busy && !active}
                      onClick={() => {
                        if (!active) void coach.openThread(thread.id);
                        onPick?.();
                      }}
                    >
                      <strong>{thread.title}</strong>
                      <time>{formatCoachStamp(thread.updatedAt)}</time>
                    </button>
                    <button
                      type="button"
                      className="coach-log-trash"
                      aria-label={`Delete ${thread.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void coach.deleteThread(thread.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
