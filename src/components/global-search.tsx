"use client";

import { ArrowRight, ArrowUpRight, Dumbbell, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { Exercise } from "@/src/types/fitness";
import { fetchExercises } from "@/src/lib/exercises-client";
import { navItems } from "@/src/lib/nav";

export function GlobalSearch({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      fetchExercises({ q: query, limit: 6, page: 1 })
        .then((data) => setResults(data.items))
        .catch(() => setResults([]));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visible = query.trim() ? results : [];

  return (
    <div className="modal-layer search-layer" role="dialog" aria-modal="true" aria-label="Global search">
      <div className="search-command">
        <label>
          <Search size={21} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything…" />
          <button type="button" onClick={onClose}>ESC</button>
        </label>
        <div className="search-results">
          <span className="eyebrow">{query ? "Exercises" : "Jump to"}</span>
          {query
            ? visible.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => {
                    onNavigate(`/exercises/${exercise.id}`);
                    onClose();
                  }}
                >
                  <span className="result-icon"><Dumbbell size={18} /></span>
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{exercise.target} · {exercise.equipment}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))
            : navItems.slice(1, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.href);
                    onClose();
                  }}
                >
                  <span className="result-icon"><ArrowRight size={18} /></span>
                  <strong>{item.label}</strong>
                  <span className="shortcut">↵</span>
                </button>
              ))}
        </div>
        <footer>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </footer>
      </div>
    </div>
  );
}
