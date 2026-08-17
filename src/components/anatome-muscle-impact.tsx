"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnatomeWorkoutImageResponse } from "@/src/lib/anatome";
import { anatomeWorkoutImage } from "@/src/lib/anatome";

const slugToLabel: Record<string, string> = {
  chest: "Chest",
  triceps: "Triceps",
  deltoids: "Shoulders",
  delts: "Shoulders",
  abs: "Core",
  core: "Core",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  gluteal: "Glutes",
  biceps: "Biceps",
  forearm: "Forearms",
  lats: "Lats",
  "upper-back": "Upper back",
  calves: "Calves",
  obliques: "Obliques",
  adductors: "Adductors",
};

const slugToTone: Record<string, string> = {
  chest: "lime",
  triceps: "lime",
  deltoids: "orange",
  abs: "blue",
  core: "blue",
  quadriceps: "yellow",
  hamstrings: "yellow",
};

function intensityFromPercent(pct: number) {
  if (pct >= 70) return "High";
  if (pct >= 40) return "Medium";
  return "Indirect";
}

export function AnatomeMuscleImpact({
  exerciseNames,
  view = "front",
  gender = "male",
  variant = "card",
  onSelectMuscle,
}: {
  exerciseNames: string[];
  view?: "front" | "back" | "dual";
  gender?: "male" | "female";
  variant?: "card" | "stage";
  onSelectMuscle?: (slug: string, label: string) => void;
}) {
  const [data, setData] = useState<AnatomeWorkoutImageResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("loading");

  const signature = useMemo(() => [...exerciseNames].sort().join("|"), [exerciseNames]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!exerciseNames.length) return;
      try {
        const result = await anatomeWorkoutImage({ exercises: exerciseNames, gender, view, output: "json" });
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [signature, gender, view, exerciseNames]);

  const bars = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.per_muscle_count ?? {}).sort((a, b) => b[1] - a[1]);
    const top = variant === "stage" ? entries.slice(0, 8) : entries.slice(0, 4);
    const max = top[0]?.[1] ?? 1;
    return top.map(([slug, count]) => {
      const pct = Math.round((count / (max || 1)) * 100);
      return {
        slug,
        label: slugToLabel[slug] ?? slug.replace(/-/g, " "),
        pct,
        tone: slugToTone[slug] ?? "gray",
      };
    });
  }, [data, variant]);

  const svg = (
    <div className={variant === "stage" ? "anatome-stage" : "anatome-svg"}>
      {status === "loading" && <div className="anatome-loading">Loading muscle map…</div>}
      {status === "error" && <div className="anatome-loading">Anatome could not render this session.</div>}
      {status === "ready" && data?.svg && <div className="anatome-svg-inner" dangerouslySetInnerHTML={{ __html: data.svg }} />}
    </div>
  );

  if (variant === "stage") {
    return (
      <div className="anatome-stage-wrap">
        {svg}
        {data?.attribution && <small className="media-credit">{data.attribution}</small>}
      </div>
    );
  }

  return (
    <div className="anatome-impact">
      {svg}
      <div className="anatome-bar-list muscle-list">
        {bars.map((bar) => (
          <button
            type="button"
            key={bar.slug}
            className="anatome-bar"
            onClick={() => onSelectMuscle?.(bar.slug, bar.label)}
          >
            <span>
              <strong>{bar.label}</strong>
              <small>{intensityFromPercent(bar.pct)}</small>
            </span>
            <div className="progress-track">
              <i className={bar.tone} style={{ width: `${bar.pct}%` }} />
            </div>
            <b>{bar.pct}%</b>
          </button>
        ))}
      </div>
    </div>
  );
}
