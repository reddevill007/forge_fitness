"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { focusMuscleColor, FOCUS_MUSCLES, formatFocusMuscles, groupFocusMuscles, parseFocusMuscles, uniqueMuscleNames } from "@/src/lib/focus-muscles";
import { fetchExerciseMuscles } from "@/src/lib/exercises-client";
import { FocusMuscleMap } from "@/src/components/focus-muscle-map";

export function MuscleFocusSelect({
  label = "Focus",
  value,
  onChange,
  showMap = true,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  showMap?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<string[]>([...FOCUS_MUSCLES]);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => parseFocusMuscles(value), [value]);
  const allMuscles = useMemo(() => uniqueMuscleNames([...FOCUS_MUSCLES, ...catalog, ...selected]), [catalog, selected]);
  const needle = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const filtered = allMuscles.filter((muscle) => !selected.includes(muscle) && (!needle || muscle.toLowerCase().includes(needle)));
    return groupFocusMuscles(filtered);
  }, [allMuscles, needle, selected]);
  const availableCount = groups.reduce((total, group) => total + group.muscles.length, 0);

  useEffect(() => {
    let cancelled = false;
    fetchExerciseMuscles()
      .then((data) => {
        if (!cancelled && data.items.length) setCatalog(data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function setMuscles(next: string[]) {
    onChange(formatFocusMuscles(next));
  }

  return (
    <div className="muscle-focus" ref={rootRef}>
      <span>{label}</span>
      <div className={`muscle-focus-layout ${showMap ? "has-map" : ""}`}>
        <div>
          <div className={`muscle-focus-field ${open ? "is-open" : ""}`}>
            {selected.map((muscle, index) => (
              <button
                key={muscle}
                type="button"
                className="muscle-chip"
                style={{ "--chip": focusMuscleColor(index) } as CSSProperties}
                onClick={() => setMuscles(selected.filter((item) => item !== muscle))}
                aria-label={`Remove ${muscle}`}
              >
                <i />
                {muscle}
                <X size={13} />
              </button>
            ))}
            <button
              type="button"
              className="muscle-focus-add"
              aria-expanded={open}
              aria-haspopup="listbox"
              onClick={() => setOpen((current) => !current)}
            >
              <Plus size={14} />
              {selected.length === 0 ? "Select muscles" : "Add"}
              <ChevronDown size={14} />
            </button>
          </div>
          {open && (
            <div className="muscle-focus-menu" role="listbox" aria-label="Muscles">
              <label className="muscle-focus-search">
                <Search size={14} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search upper chest, front delts…"
                  autoFocus
                />
              </label>
              {availableCount === 0 ? (
                <p className="muscle-focus-empty">No matching muscles.</p>
              ) : (
                groups.map((group) => (
                  <section key={group.region}>
                    <span className="eyebrow">{group.region}</span>
                    <ul>
                      {group.muscles.map((muscle) => (
                        <li key={muscle}>
                          <button
                            type="button"
                            role="option"
                            onClick={() => {
                              setMuscles([...selected, muscle]);
                              setQuery("");
                            }}
                          >
                            {muscle}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          )}
        </div>
        {showMap ? <FocusMuscleMap muscles={selected} compact /> : null}
      </div>
    </div>
  );
}
