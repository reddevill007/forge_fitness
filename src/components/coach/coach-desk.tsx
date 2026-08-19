"use client";

import { CheckCheck, History, Plus, Send } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CoachBlockView, CoachChipRow } from "@/src/components/coach/coach-blocks";
import { CoachHistoryList } from "@/src/components/coach/coach-history";
import { CoachMark, CoachThinkingDoodle } from "@/src/components/coach/coach-mark";
import { COACH_STARTERS, formatCoachStamp } from "@/src/lib/coach/history";
import { useCoach } from "@/src/lib/coach/context";

function activeTitle(coach: NonNullable<ReturnType<typeof useCoach>>) {
  if (!coach.activeThreadId || coach.messages.length === 0) return null;
  return coach.threads.find((thread) => thread.id === coach.activeThreadId)?.title
    || coach.messages.find((message) => message.role === "user")?.text
    || null;
}

export function useCoachComposerState() {
  const coach = useCoach();
  const [draft, setDraft] = useState("");

  async function send() {
    const prompt = draft.trim();
    if (!prompt) return;
    setDraft("");
    await coach?.ask(prompt);
  }

  const placeholder = coach?.pageContext.currentExercise
    ? `Ask anything about ${coach.pageContext.currentExercise.name}…`
    : coach?.pageContext.currentWorkout
      ? `Ask anything about ${coach.pageContext.currentWorkout.name}…`
      : "Ask anything about training…";

  return { coach, draft, setDraft, send, placeholder };
}

export function CoachThread({
  emptyNote,
  surface = "desk",
}: {
  emptyNote?: ReactNode;
  surface?: "desk" | "panel";
}) {
  const coach = useCoach();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [coach?.messages, coach?.thinking]);

  if (!coach) return null;

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    await coach?.ask(prompt);
  }

  return (
    <div className={`coach-thread is-${surface}`} ref={scroller}>
      {coach.messages.length === 0 && (
        <article className="coach-bubble assistant">
          <span className="coach-face is-sm">
            <CoachMark />
          </span>
          <div className="coach-bubble-body">
            <p className="coach-text">
              Hey! I&apos;m Atlas, your personal training assistant. How can I help you today?
            </p>
            <CoachChipRow
              items={COACH_STARTERS.map((item) => ({
                id: item.label,
                label: item.label,
                kind: "prompt" as const,
                prompt: item.prompt,
              }))}
              onPrompt={send}
            />
            {emptyNote}
          </div>
        </article>
      )}

      {coach.messages.map((message) => (
        <article key={message.id} className={`coach-bubble ${message.role}`}>
          {message.role === "assistant" && (
            <span className="coach-face is-sm">
              <CoachMark />
            </span>
          )}
          <div className="coach-bubble-body">
            {message.text ? <p className="coach-text">{message.text}</p> : null}
            {message.blocks.map((block, index) => (
              <CoachBlockView key={`${message.id}-${index}`} block={block} />
            ))}
            {message.createdAt ? (
              <time className="coach-stamp">
                {formatCoachStamp(message.createdAt)}
                {message.role === "user" ? <CheckCheck size={13} /> : null}
              </time>
            ) : null}
          </div>
        </article>
      ))}

      {coach.thinking && (
        <div className="coach-thinking">
          <span className="coach-face is-sm">
            <CoachMark />
          </span>
          <div>
            <CoachThinkingDoodle />
            <span>{coach.thinking}</span>
          </div>
        </div>
      )}
      {coach.busy && !coach.thinking && (
        <div className="coach-thinking">
          <span className="coach-face is-sm">
            <CoachMark />
          </span>
          <CoachThinkingDoodle />
        </div>
      )}

      {coach.error && (
        <p className="coach-error" role="alert">
          {coach.error}
          <button type="button" className="text-button" onClick={coach.clearError}>Dismiss</button>
        </p>
      )}
    </div>
  );
}

export function CoachDeskComposer() {
  const { coach, draft, setDraft, send, placeholder } = useCoachComposerState();
  if (!coach) return null;

  return (
    <form
      className="coach-desk-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="coach-desk-composer-shell">
        <label>
          <span className="sr-only">Message Coach</span>
          <textarea
            value={draft}
            rows={1}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <button className="coach-desk-send" type="submit" disabled={coach.busy || !draft.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}

export function CoachDesk() {
  const coach = useCoach();
  const [logOpen, setLogOpen] = useState(false);
  if (!coach) return null;
  const session = activeTitle(coach);

  return (
    <div className="ai-desk">
      <section className="ai-desk-main">
        <header className="ai-page-header">
          <div>
            <div className="coach-title-row">
              <strong>AI Coach</strong>
              <span className="coach-online"><i /> Online</span>
            </div>
            <p>{session ?? "Your personal training assistant."}</p>
          </div>
          <div className="ai-page-tools">
            <button
              type="button"
              className={`coach-log-toggle ${logOpen ? "is-active" : ""}`}
              aria-pressed={logOpen}
              onClick={() => setLogOpen((value) => !value)}
            >
              <History size={15} />
              Chats
            </button>
            <button type="button" className="coach-log-new is-header" onClick={() => { coach.newChat(); setLogOpen(false); }}>
              <Plus size={15} />
              New Chat
            </button>
          </div>
        </header>
        <div className="ai-desk-body">
          {logOpen ? (
            <div className="coach-session-flyout">
              <CoachHistoryList onPick={() => setLogOpen(false)} />
            </div>
          ) : null}
          <CoachThread surface="desk" />
          <CoachDeskComposer />
        </div>
      </section>
    </div>
  );
}
