"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CoachBlockView } from "@/src/components/coach/coach-blocks";
import { CoachMark, CoachPortrait, CoachThinkingDoodle } from "@/src/components/coach/coach-mark";
import { useCoach, useCoachPage } from "@/src/lib/coach/context";

const STARTERS = [
  "What's my best PR?",
  "Am I getting stronger?",
  "Which muscle am I neglecting?",
  "Create me a 45-minute Pull workout.",
];

export default function AiRoutePage() {
  const coach = useCoach();
  useCoachPage({ currentPage: "ai" });

  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [coach?.messages, coach?.thinking]);

  if (!coach) return null;

  async function send(text = draft) {
    const prompt = text.trim();
    if (!prompt) return;
    setDraft("");
    await coach?.ask(prompt);
  }

  return (
    <div className="ai-page">
      <header className="ai-page-header">
        <span className="coach-face">
          <CoachMark />
        </span>
        <div>
          <span className="eyebrow">Training coach</span>
          <strong>Atlas</strong>
        </div>
      </header>

      <div className="ai-page-thread" ref={scroller}>
        {coach.messages.length === 0 && (
          <div className="coach-empty">
            <div className="coach-empty-hero">
              <CoachPortrait />
            </div>
            <p className="coach-empty-note">Clipboard out. Data in the room.</p>
            <h2>What&apos;s the work?</h2>
            <p>PRs, muscle volume, this session, the last eight weeks — Atlas reads Forge, not generic advice.</p>
            <div className="coach-starters">
              {STARTERS.map((item) => (
                <button key={item} type="button" onClick={() => void send(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {coach.messages.map((message) => (
          <article key={message.id} className={`coach-bubble ${message.role}`}>
            {message.role === "assistant" && (
              <span className="coach-face is-sm">
                <CoachMark />
              </span>
            )}
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

      <form
        className="ai-page-composer"
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
            placeholder="Ask Atlas anything about your training…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <button className="coach-send" type="submit" disabled={coach.busy || !draft.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
