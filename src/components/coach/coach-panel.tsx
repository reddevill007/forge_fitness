"use client";

import { Maximize2, Minimize2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CoachBlockView } from "@/src/components/coach/coach-blocks";
import { CoachMark, CoachThinkingDoodle } from "@/src/components/coach/coach-mark";
import { useCoach } from "@/src/lib/coach/context";

const STARTERS = [
  "What's my best PR?",
  "Am I getting stronger?",
  "Which muscle am I neglecting?",
  "Create me a 45-minute Pull workout.",
];

export function CoachPanel() {
  const coach = useCoach();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [coach?.messages, coach?.thinking]);

  if (!coach || !coach.open) return null;

  async function send(text = draft) {
    const prompt = text.trim();
    if (!prompt) return;
    setDraft("");
    await coach?.ask(prompt);
  }

  return (
    <div className={`coach-layer ${coach.expanded ? "is-expanded" : ""}`}>
      <button className="coach-scrim" type="button" aria-label="Close Coach" onClick={coach.closePanel} />
      <aside className="coach-panel" role="dialog" aria-label="Coach">
        <header className="coach-header">
          <div className="coach-brand">
            <CoachMark />
            <div>
              <span className="eyebrow">Atlas</span>
              <strong>Coach</strong>
            </div>
          </div>
          <div className="coach-header-actions">
            <button type="button" className="icon-button" aria-label={coach.expanded ? "Shrink Coach" : "Expand Coach"} onClick={coach.toggleExpanded}>
              {coach.expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" className="icon-button" aria-label="Close Coach" onClick={coach.closePanel}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="coach-thread" ref={scroller}>
          {coach.messages.length === 0 && (
            <div className="coach-empty">
              <CoachMark />
              <h2>Ask with your data in the room.</h2>
              <p>PRs, muscle volume, this workout, the last eight weeks — Coach reads Forge, not generic advice.</p>
              <div className="coach-starters">
                {STARTERS.map((item) => (
                  <button key={item} type="button" onClick={() => void send(item)}>
                    <Sparkles size={14} /> {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {coach.messages.map((message) => (
            <article key={message.id} className={`coach-bubble ${message.role}`}>
              {message.role === "assistant" && <CoachMark />}
              <div>
                {message.text ? <p className="coach-text">{message.text}</p> : null}
                {message.blocks.map((block, index) => (
                  <CoachBlockView key={`${message.id}-${index}`} block={block} />
                ))}
              </div>
            </article>
          ))}

          {coach.thinking && (
            <div className="coach-thinking">
              <CoachThinkingDoodle />
              <span>{coach.thinking}</span>
            </div>
          )}
          {coach.busy && !coach.thinking && (
            <div className="coach-thinking">
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

        <form
          className="coach-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label>
            <span className="sr-only">Message Coach</span>
            <textarea
              value={draft}
              rows={2}
              placeholder={coach.pageContext.currentExercise
                ? `Ask about ${coach.pageContext.currentExercise.name}…`
                : coach.pageContext.currentWorkout
                  ? `Ask about ${coach.pageContext.currentWorkout.name}…`
                  : "Ask Coach anything about your training…"}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
          </label>
          <button className="primary-button" type="submit" disabled={coach.busy || !draft.trim()}>
            <Send size={16} /> Send
          </button>
        </form>
      </aside>
    </div>
  );
}

export function CoachFab() {
  const coach = useCoach();
  if (!coach || coach.open) return null;
  return (
    <button className="coach-fab" type="button" onClick={coach.openPanel} aria-label="Open Coach">
      <CoachMark />
      <span>Coach</span>
    </button>
  );
}
