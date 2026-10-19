"use client";

import { useRouter } from "next/navigation";
import { Dashboard } from "@/src/components/forge-app";
import { useUserData } from "@/src/lib/firebase/user-data-context";

export default function HomePage() {
  const router = useRouter();
  const { todaysWorkout } = useUserData();
  return (
    <Dashboard
      onStart={(workoutId) => {
        if (workoutId) {
          router.push(`/workout?w=${encodeURIComponent(workoutId)}`);
          return;
        }
        if (todaysWorkout?.exercises.length) router.push("/workout");
        else router.push("/workouts");
      }}
    />
  );
}
