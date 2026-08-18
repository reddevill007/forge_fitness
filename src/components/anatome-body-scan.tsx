"use client";

import { useEffect, useMemo, useState } from "react";
import {
  anatomeGenerateImage,
  type AnatomeGenerateImageResponse,
  type AnatomeLayer,
} from "@/src/lib/anatome";
import { PRIMARY_MUSCLE_COLOR, SECONDARY_MUSCLE_COLOR, toAnatomeSlug } from "@/src/lib/anatome-muscles";
import type { StoredSession, StoredWorkout } from "@/src/lib/firebase/types";

export const BODY_SITES = [
  { id: "chest", label: "Chest", unit: "cm", muscles: ["chest"], top: 25, side: "left" },
  { id: "arms", label: "Arms", unit: "cm", muscles: ["biceps", "triceps", "forearm"], top: 35, side: "right" },
  { id: "waist", label: "Waist", unit: "cm", muscles: ["abs", "obliques"], top: 45, side: "left" },
  { id: "hips", label: "Hips", unit: "cm", muscles: ["gluteal"], top: 55, side: "right" },
  { id: "thighs", label: "Thighs", unit: "cm", muscles: ["quadriceps", "hamstring", "adductors"], top: 68, side: "left" },
  { id: "calves", label: "Calves", unit: "cm", muscles: ["calves"], top: 85, side: "right" },
] as const;

export type BodySiteId = (typeof BODY_SITES)[number]["id"];

const GHOST_MUSCLES = [
  "chest",
  "deltoids",
  "biceps",
  "triceps",
  "forearm",
  "abs",
  "obliques",
  "quadriceps",
  "adductors",
  "calves",
  "upper-back",
  "trapezius",
  "gluteal",
  "hamstring",
  "lower-back",
];

export function trainingHeatFromSessions(sessions: StoredSession[], workouts: StoredWorkout[]) {
  const by = new Map<string, number>();
  for (const session of sessions) {
    const workout = workouts.find((item) => item.id === session.workoutDayId);
    for (const exerciseSession of session.exerciseSessions) {
      const planned = workout?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId);
      const slug = toAnatomeSlug(planned?.target) ?? toAnatomeSlug(exerciseSession.exerciseName);
      if (!slug) continue;
      const sets = exerciseSession.sets.filter((set) => set.completed || set.reps > 0).length;
      if (!sets) continue;
      by.set(slug, (by.get(slug) ?? 0) + sets);
    }
  }
  return by;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function layersForScan(params: {
  measuredMuscles: string[];
  selectedMuscles: string[];
  trainingBySlug: Map<string, number>;
}): AnatomeLayer[] {
  const isolated = params.selectedMuscles.length > 0;
  const layers: AnatomeLayer[] = [
    { color: "#6a7066", muscles: GHOST_MUSCLES, opacity: isolated ? 0.14 : 0.3 },
  ];

  if (isolated) {
    layers.push({ color: PRIMARY_MUSCLE_COLOR, muscles: params.selectedMuscles, opacity: 1 });
    return layers;
  }

  const maxSets = Math.max(0, ...params.trainingBySlug.values());
  if (maxSets > 0) {
    const low: string[] = [];
    const mid: string[] = [];
    const high: string[] = [];
    for (const [slug, sets] of params.trainingBySlug) {
      const ratio = sets / maxSets;
      if (ratio >= 0.62) high.push(slug);
      else if (ratio >= 0.28) mid.push(slug);
      else low.push(slug);
    }
    if (low.length) layers.push({ color: SECONDARY_MUSCLE_COLOR, muscles: low, opacity: 0.38 });
    if (mid.length) layers.push({ color: SECONDARY_MUSCLE_COLOR, muscles: mid, opacity: 0.62 });
    if (high.length) layers.push({ color: SECONDARY_MUSCLE_COLOR, muscles: high, opacity: 0.88 });
  }

  if (params.measuredMuscles.length) {
    layers.push({ color: PRIMARY_MUSCLE_COLOR, muscles: params.measuredMuscles, opacity: 0.94 });
  }

  return layers;
}

export function AnatomeBodyScan({
  gender,
  view,
  measuredMuscles,
  selectedMuscles,
  trainingBySlug,
}: {
  gender: "male" | "female";
  view: "front" | "back" | "dual";
  measuredMuscles: string[];
  selectedMuscles: string[];
  trainingBySlug: Map<string, number>;
}) {
  const [data, setData] = useState<AnatomeGenerateImageResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const layers = useMemo(
    () => layersForScan({ measuredMuscles, selectedMuscles, trainingBySlug }),
    [measuredMuscles, selectedMuscles, trainingBySlug],
  );
  const signature = useMemo(() => JSON.stringify({ gender, view, layers }), [gender, view, layers]);

  useEffect(() => {
    let cancelled = false;
    setStatus((current) => (current === "ready" ? current : "loading"));
    const timer = window.setTimeout(() => {
      anatomeGenerateImage({ layers, gender, view })
        .then((image) => {
          if (cancelled) return;
          setData(image);
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signature, layers, gender, view]);

  return (
    <div className="anatome-stage-wrap">
      <div className="anatome-stage">
        {status === "loading" && !data && <div className="anatome-loading">Painting anatomy…</div>}
        {status === "error" && !data && <div className="anatome-loading">Anatome could not render this map.</div>}
        {data?.svg && (
          <div
            className={`anatome-svg-inner ${status === "loading" ? "is-updating" : ""}`}
            dangerouslySetInnerHTML={{ __html: data.svg }}
          />
        )}
      </div>
      {data?.attribution && <small className="media-credit">{data.attribution}</small>}
    </div>
  );
}

export function measuredMusclesFromValues(values: Partial<Record<BodySiteId, number | undefined>>) {
  return unique(
    BODY_SITES.flatMap((site) => (values[site.id] ? site.muscles : [])),
  );
}
