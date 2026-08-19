"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  anatomeGenerateImage,
  anatomeMuscleImageUrl,
  anatomeResolveExercise,
  type AnatomeGenerateImageResponse,
  type AnatomeLayer,
} from "@/src/lib/anatome";
import {
  PRIMARY_MUSCLE_COLOR,
  SECONDARY_MUSCLE_COLOR,
  slugLabel,
  uniqueSlugs,
} from "@/src/lib/anatome-muscles";

function layersFromNames(primary: string[], secondary: string[]): AnatomeLayer[] {
  const layers: AnatomeLayer[] = [];
  if (primary.length) layers.push({ color: PRIMARY_MUSCLE_COLOR, muscles: primary });
  const extra = secondary.filter((slug) => !primary.includes(slug));
  if (extra.length) layers.push({ color: SECONDARY_MUSCLE_COLOR, muscles: extra, opacity: 0.72 });
  return layers;
}

export function AnatomeExerciseMuscleThumb({
  exerciseName,
  target,
  secondaryMuscles,
  alt,
}: {
  exerciseName: string;
  target: string;
  secondaryMuscles: string[];
  alt?: string;
}) {
  const primary = uniqueSlugs([target]);
  const secondary = uniqueSlugs(secondaryMuscles);
  if (!primary.length && !secondary.length) return null;

  const src = anatomeMuscleImageUrl({
    primary,
    secondary,
    view: "dual",
  });

  return (
    <div className="anatome-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt ?? `${exerciseName} muscle map`} loading="lazy" />
    </div>
  );
}

export function AnatomeExerciseMuscles({
  exerciseName,
  target,
  secondaryMuscles,
}: {
  exerciseName: string;
  target: string;
  secondaryMuscles: string[];
}) {
  const fallbackPrimaryKey = uniqueSlugs([target]).join(",");
  const fallbackSecondaryKey = uniqueSlugs(secondaryMuscles).join(",");
  const [view, setView] = useState<"front" | "back" | "dual">("dual");
  const [isolated, setIsolated] = useState<string | null>(null);
  const [data, setData] = useState<AnatomeGenerateImageResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [primary, setPrimary] = useState(() => uniqueSlugs([target]));
  const [secondary, setSecondary] = useState(() => uniqueSlugs(secondaryMuscles));

  const fallbackPrimary = useMemo(() => fallbackPrimaryKey.split(",").filter(Boolean), [fallbackPrimaryKey]);
  const fallbackSecondary = useMemo(() => fallbackSecondaryKey.split(",").filter(Boolean), [fallbackSecondaryKey]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        let nextPrimary = fallbackPrimary;
        let nextSecondary = fallbackSecondary;

        const resolved = await anatomeResolveExercise(exerciseName).catch(() => null);
        if (cancelled) return;

        if (resolved?.matched && resolved.layers?.length) {
          const resolvedPrimary = resolved.layers[0]?.muscles ?? [];
          const resolvedSecondary = resolved.layers.slice(1).flatMap((layer) => layer.muscles);
          if (resolvedPrimary.length) nextPrimary = uniqueSlugs(resolvedPrimary);
          if (resolvedSecondary.length) nextSecondary = uniqueSlugs(resolvedSecondary);
        }

        const layers = isolated && (nextPrimary.includes(isolated) || nextSecondary.includes(isolated))
          ? [{
              color: nextPrimary.includes(isolated) ? PRIMARY_MUSCLE_COLOR : SECONDARY_MUSCLE_COLOR,
              muscles: [isolated],
              opacity: nextPrimary.includes(isolated) ? undefined : 0.72,
            }]
          : layersFromNames(nextPrimary, nextSecondary);
        if (!layers.length) {
          setStatus("error");
          return;
        }

        const image = await anatomeGenerateImage({ layers, view, gender: "male" });
        if (cancelled) return;
        setPrimary(nextPrimary);
        setSecondary(nextSecondary);
        setData(image);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [exerciseName, fallbackPrimary, fallbackSecondary, view, isolated]);

  useEffect(() => {
    setIsolated(null);
  }, [exerciseName]);

  function toggleIsolated(slug: string) {
    setIsolated((current) => (current === slug ? null : slug));
  }

  return (
    <div className="exercise-muscle-map">
      <div className="view-toggle compact-toggle">
        <button type="button" className={view === "dual" ? "active" : ""} onClick={() => setView("dual")}>Both</button>
        <button type="button" className={view === "front" ? "active" : ""} onClick={() => setView("front")}>Front</button>
        <button type="button" className={view === "back" ? "active" : ""} onClick={() => setView("back")}>Back</button>
      </div>
      <div className="anatome-svg exercise-muscle-svg">
        {status === "loading" && !data && <div className="anatome-loading">Loading muscle map…</div>}
        {status === "error" && !data && <div className="anatome-loading">Anatome could not map this movement.</div>}
        {data?.svg && (
          <div
            className={`anatome-svg-inner ${status === "loading" ? "is-updating" : ""}`}
            dangerouslySetInnerHTML={{ __html: data.svg }}
          />
        )}
      </div>
      <div className="muscle-legend">
        {primary.map((slug) => (
          <button
            key={`p-${slug}`}
            type="button"
            className={`legend-pill primary ${isolated === slug ? "is-active" : ""} ${isolated && isolated !== slug ? "is-dim" : ""}`}
            style={{ "--chip": PRIMARY_MUSCLE_COLOR } as CSSProperties}
            aria-pressed={isolated === slug}
            onClick={() => toggleIsolated(slug)}
          >
            <i /> {slugLabel(slug)}
          </button>
        ))}
        {secondary.filter((slug) => !primary.includes(slug)).map((slug) => (
          <button
            key={`s-${slug}`}
            type="button"
            className={`legend-pill secondary ${isolated === slug ? "is-active" : ""} ${isolated && isolated !== slug ? "is-dim" : ""}`}
            style={{ "--chip": SECONDARY_MUSCLE_COLOR } as CSSProperties}
            aria-pressed={isolated === slug}
            onClick={() => toggleIsolated(slug)}
          >
            <i /> {slugLabel(slug)}
          </button>
        ))}
      </div>
      {data?.attribution && <small className="media-credit">{data.attribution}</small>}
    </div>
  );
}
