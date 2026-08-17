"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { anatomeGenerateImage, type AnatomeGenerateImageResponse, type AnatomeLayer } from "@/src/lib/anatome";
import { toAnatomeSlug } from "@/src/lib/anatome-muscles";
import { focusMuscleColor } from "@/src/lib/focus-muscles";

function layersForMuscles(names: string[], isolated: string | null): AnatomeLayer[] {
  const used = new Set<string>();
  const layers: AnatomeLayer[] = [];
  const visible = isolated && names.includes(isolated) ? [isolated] : names;
  for (const name of visible) {
    const index = names.indexOf(name);
    const slug = toAnatomeSlug(name);
    if (!slug || used.has(slug)) continue;
    used.add(slug);
    layers.push({ color: focusMuscleColor(index), muscles: [slug] });
  }
  return layers;
}

export function FocusMuscleMap({
  muscles,
  compact = false,
}: {
  muscles: string[];
  compact?: boolean;
}) {
  const [view, setView] = useState<"front" | "back" | "dual">("dual");
  const [isolated, setIsolated] = useState<string | null>(null);
  const [data, setData] = useState<AnatomeGenerateImageResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(muscles.length ? "loading" : "idle");
  const signature = muscles.join("|");

  const legend = useMemo(
    () =>
      muscles.map((name, index) => ({
        name,
        color: focusMuscleColor(index),
      })),
    [muscles],
  );

  useEffect(() => {
    if (isolated && !muscles.includes(isolated)) setIsolated(null);
  }, [muscles, isolated]);

  useEffect(() => {
    let cancelled = false;
    const names = signature.split("|").filter(Boolean);
    const layers = layersForMuscles(names, isolated && names.includes(isolated) ? isolated : null);
    if (!layers.length) {
      setData(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const timer = window.setTimeout(() => {
      anatomeGenerateImage({ layers, view, gender: "male" })
        .then((image) => {
          if (cancelled) return;
          setData(image);
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signature, view, isolated]);

  function toggleIsolated(name: string) {
    setIsolated((current) => (current === name ? null : name));
  }

  return (
    <div className={`focus-muscle-map ${compact ? "is-compact" : ""}`}>
      <div className="view-toggle compact-toggle">
        <button type="button" className={view === "dual" ? "active" : ""} onClick={() => setView("dual")}>Both</button>
        <button type="button" className={view === "front" ? "active" : ""} onClick={() => setView("front")}>Front</button>
        <button type="button" className={view === "back" ? "active" : ""} onClick={() => setView("back")}>Back</button>
      </div>
      <div className="anatome-svg focus-muscle-svg">
        {status === "idle" && <div className="anatome-loading">Add a muscle to light the map.</div>}
        {status === "loading" && !data && <div className="anatome-loading">Painting muscles…</div>}
        {status === "error" && !data && <div className="anatome-loading">Could not render this map.</div>}
        {data?.svg && (
          <div
            className={`anatome-svg-inner ${status === "loading" ? "is-updating" : ""}`}
            dangerouslySetInnerHTML={{ __html: data.svg }}
          />
        )}
      </div>
      {legend.length > 0 && (
        <div className="muscle-legend">
          {legend.map((item) => {
            const active = isolated === item.name;
            const dim = Boolean(isolated) && !active;
            return (
              <button
                key={item.name}
                type="button"
                className={`legend-pill ${active ? "is-active" : ""} ${dim ? "is-dim" : ""}`}
                style={{ "--chip": item.color } as CSSProperties}
                aria-pressed={active}
                onClick={() => toggleIsolated(item.name)}
              >
                <i />
                {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
