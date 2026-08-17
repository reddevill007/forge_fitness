"use client";

import { CoachMark } from "@/src/components/coach/coach-mark";
import { useCoach } from "@/src/lib/coach/context";

export function ContextualAiActions({
  actions,
}: {
  actions: Array<{ label: string; prompt: string }>;
}) {
  const coach = useCoach();
  if (!coach || actions.length === 0) return null;
  return (
    <div className="coach-context-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="coach-chip"
          onClick={() => void coach.ask(action.prompt)}
        >
          <span className="coach-chip-face"><CoachMark /></span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
