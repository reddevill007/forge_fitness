"use client";

import { Sparkles } from "lucide-react";
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
          <Sparkles size={14} /> {action.label}
        </button>
      ))}
    </div>
  );
}
