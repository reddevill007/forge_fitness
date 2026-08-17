"use client";

import { useRouter } from "next/navigation";
import { ActiveWorkout } from "@/src/components/forge-app";

export default function ActiveWorkoutRoute() {
  const router = useRouter();
  return (
    <ActiveWorkout
      onExit={() => router.push("/")}
      onComplete={() => router.push("/workout/summary")}
    />
  );
}
