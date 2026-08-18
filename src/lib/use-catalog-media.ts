"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchExercise, fetchExercises } from "@/src/lib/exercises-client";
import { workoutStillUrl } from "@/src/lib/workout-exercise-media";
import type { Exercise, WorkoutExercise } from "@/src/types/fitness";

export function useCatalogMedia(exercises: WorkoutExercise[]) {
  const missingIds = useMemo(
    () => [...new Set(exercises.filter((item) => item.exerciseId && !item.gifUrl).map((item) => item.exerciseId))],
    [exercises],
  );
  const [byId, setById] = useState<Record<string, Exercise>>({});
  const triedNames = useRef(new Set<string>());

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

  const missingNames = useMemo(() => {
    const names = new Set<string>();
    for (const item of exercises) {
      const name = item.name.trim().toLowerCase();
      if (!name || triedNames.current.has(name)) continue;
      if (workoutStillUrl(item, byId[item.exerciseId] ?? byId[`name:${name}`])) continue;
      names.add(name);
    }
    return [...names];
  }, [exercises, byId]);

  useEffect(() => {
    if (!missingNames.length) return;
    let cancelled = false;
    for (const name of missingNames) triedNames.current.add(name);
    Promise.all(
      missingNames.map((name) =>
        fetchExercises({ q: name, limit: 8 }).then((result) => {
          const exact = result.items.find((item) => item.name.trim().toLowerCase() === name);
          return [name, exact ?? result.items[0] ?? null] as const;
        }),
      ),
    )
      .then((rows) => {
        if (cancelled) return;
        setById((current) => {
          const next = { ...current };
          for (const [name, item] of rows) {
            if (!item) continue;
            next[item.id] = item;
            next[`name:${name}`] = item;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [missingNames.join("|")]);

  return byId;
}
