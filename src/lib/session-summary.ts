import type { StoredSession } from "@/src/lib/firebase/types";
import { sessionDurationSeconds, sessionSetCount, sessionVolume } from "@/src/lib/firebase/stats";

const KEY = "forge:last-session";

export type SessionSummary = {
  workoutName: string;
  focus: string;
  durationSeconds: number;
  setCount: number;
  volume: number;
  exerciseCount: number;
  exerciseNames: string[];
};

export function buildSessionSummary(session: StoredSession): SessionSummary {
  return {
    workoutName: session.workoutName,
    focus: session.focus,
    durationSeconds: sessionDurationSeconds(session),
    setCount: sessionSetCount(session),
    volume: sessionVolume(session),
    exerciseCount: session.exerciseSessions.length,
    exerciseNames: session.exerciseSessions.map((item) => {
      const workoutExercise = session.exerciseSessions.find((e) => e.id === item.id);
      return workoutExercise ? item.workoutExerciseId : item.workoutExerciseId;
    }),
  };
}

export function storeSessionSummary(summary: SessionSummary) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(summary));
}

export function readSessionSummary(): SessionSummary | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionSummary;
  } catch {
    return null;
  }
}

export function clearSessionSummary() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
