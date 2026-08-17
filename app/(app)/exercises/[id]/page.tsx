"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExerciseDetail } from "@/src/components/forge-app";
import { fetchExercise } from "@/src/lib/exercises-client";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import type { Exercise } from "@/src/types/fitness";

export default function ExerciseDetailRoute() {
  const params = useParams<{ id: string }>();
  const { customExercises } = useUserData();
  const custom = customExercises.find((item) => item.id === params.id) ?? null;
  const [catalogExercise, setCatalogExercise] = useState<Exercise | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (custom) return;
    let cancelled = false;
    fetchExercise(params.id).then((item) => {
      if (cancelled) return;
      if (item) {
        setCatalogExercise(item);
        setStatus("ready");
        return;
      }
      setStatus("missing");
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, custom]);

  const exercise = custom ?? catalogExercise;
  if (custom || (status === "ready" && exercise)) return <ExerciseDetail exercise={exercise!} />;
  if (status === "missing" && !custom) return <div className="empty-state"><h3>Exercise not found.</h3></div>;
  return <div className="empty-state"><h3>Loading exercise…</h3></div>;
}
