"use client";

import { CoachDesk } from "@/src/components/coach/coach-desk";
import { useCoach, useCoachPage } from "@/src/lib/coach/context";

export default function AiRoutePage() {
  const coach = useCoach();
  useCoachPage({ currentPage: "ai" });
  if (!coach) return null;
  return <CoachDesk />;
}
