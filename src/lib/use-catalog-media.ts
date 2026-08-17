"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchExercise } from "@/src/lib/exercises-client";
import type { Exercise, WorkoutExercise } from "@/src/types/fitness";

export function useCatalogMedia(exercises: WorkoutExercise[]) {
  const missingIds = useMemo(
    () => [...new Set(exercises.filter((item) => item.exerciseId && !item.gifUrl).map((item) => item.exerciseId))],
    [exercises],
  );
  const [byId, setById] = useState<Record<string, Exercise>>({});

  useEffect(() => {
    if (!missingIds.length) return;
    let cancelled = false;
    Promise.all(missingIds.map((id) => fetchExercise(id).then((item) => [id, item] as const)))
      .then((rows) => {
        if (cancelled) return;
        setById((current) => {
          const next = { ...current };
          for (const [id, item] of rows) {
            if (item) next[id] = item;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [missingIds.join("|")]);

  return byId;
}
