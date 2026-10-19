"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { ActiveWorkout } from "@/src/components/forge-app";

function ActiveWorkoutRouteInner() {
  const router = useRouter();
  return (
    <ActiveWorkout
      onExit={() => router.push("/")}
      onComplete={() => router.push("/workout/summary")}
    />
  );
}

export default function ActiveWorkoutRoute() {
  return (
    <Suspense fallback={<div className="active-workout"><div className="empty-state"><h3>Loading session…</h3></div></div>}>
      <ActiveWorkoutRouteInner />
    </Suspense>
  );
}
