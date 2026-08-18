"use client";

import Image from "next/image";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Exercise } from "@/src/types/fitness";
import { fetchExercises } from "@/src/lib/exercises-client";
import { fetchAlternativeSuggestions, type AlternativeSuggestFor } from "@/src/lib/exercise-suggestions";
import { IconButton } from "@/src/components/ui";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import { CustomExerciseForm } from "@/src/components/custom-exercise-form";
import { ExerciseStill } from "@/src/components/exercise-still";

type AddedExercise = { id: string; name: string };

export function ExercisePicker({
  onClose,
  onSelect,
  stayOpen = false,
  title = "Add a movement",
  added = [],
  suggestFor,
  excludeIds = [],
}: {
  onClose: () => void;
  onSelect: (exercise: Exercise) => void | Promise<void>;
  stayOpen?: boolean;
  title?: string;
  added?: AddedExercise[];
  suggestFor?: AlternativeSuggestFor;
  excludeIds?: string[];
}) {
  const { customExercises, addExerciseToCatalog } = useUserData();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Exercise[]>([]);
  const [suggestions, setSuggestions] = useState<Exercise[]>([]);
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [localAdded, setLocalAdded] = useState<AddedExercise[]>([]);

  const addedList = added.length ? added : localAdded;
  const addedCount = addedList.length;
  const showingSuggestions = Boolean(suggestFor && !query.trim());

  useEffect(() => {
    if (!suggestFor) {
      setSuggestions([]);
      setSuggestStatus("idle");
      return;
    }
    let cancelled = false;
    setSuggestStatus("loading");
    fetchAlternativeSuggestions(suggestFor, excludeIds)
      .then((next) => {
        if (cancelled) return;
        setSuggestions(next);
        setSuggestStatus(next.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestStatus("empty");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [excludeIds.join("|"), suggestFor?.exerciseId, suggestFor?.name, suggestFor?.target]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchExercises({ q: query, limit: 24, page: 1 })
        .then((data) => setItems(data.items))
        .catch(() => setItems([]));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const customMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excluded = new Set(excludeIds);
    return customExercises.filter((exercise) => {
      if (excluded.has(exercise.id)) return false;
      if (!q) {
        if (!suggestFor) return true;
        const target = suggestFor.target.toLowerCase();
        return exercise.target.toLowerCase() === target
          || exercise.secondary_muscles.some((muscle) => muscle.toLowerCase() === target);
      }
      return exercise.name.toLowerCase().includes(q) || exercise.target.toLowerCase().includes(q);
    });
  }, [customExercises, excludeIds, query, suggestFor]);

  const catalogItems = useMemo(() => {
    const excluded = new Set([...excludeIds, ...suggestions.map((item) => item.id)]);
    return items.filter((item) => !excluded.has(item.id));
  }, [excludeIds, items, suggestions]);

  async function handleSelect(exercise: Exercise) {
    setPendingId(exercise.id);
    try {
      await onSelect(exercise);
      setLocalAdded((current) => [...current, { id: exercise.id, name: exercise.name }]);
      setFlashId(exercise.id);
      window.setTimeout(() => setFlashId((id) => (id === exercise.id ? null : id)), 900);
      if (!stayOpen) onClose();
    } finally {
      setPendingId(null);
    }
  }

  if (creating) {
    return (
      <CustomExerciseForm
        onClose={() => setCreating(false)}
        onSave={async (input) => {
          const id = await addExerciseToCatalog(input);
          await handleSelect({ ...input, id });
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Exercise browser" onClick={onClose}>
      <div className="exercise-picker" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">Exercise browser</span>
            <h2>{title}</h2>
            {suggestFor ? <p className="picker-subtitle">Suggested swaps for <strong>{suggestFor.name}</strong></p> : null}
          </div>
          <IconButton label="Close exercise browser" onClick={onClose}><X size={21} /></IconButton>
        </header>
        {addedCount > 0 && (
          <div className="picker-added">
            <span className="eyebrow">{addedCount} in this workout</span>
            <div className="picker-added-list">
              {addedList.slice(-10).map((item, index) => (
                <span className="picker-chip" key={`${item.id}-${index}`}>{item.name}</span>
              ))}
            </div>
          </div>
        )}
        <div className="picker-search">
          <Search size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={suggestFor ? `Search other ${suggestFor.target} movements…` : "Search catalog or your custom exercises…"}
          />
        </div>
        <div className="picker-toolbar">
          <p>{showingSuggestions ? "Pick a related movement below, or search the full catalog." : "Tap a card to add it. Keep stacking, then hit Done."}</p>
          <button className="outline-button" type="button" onClick={() => setCreating(true)}>
            <Plus size={16} /> Custom exercise
          </button>
        </div>
        {showingSuggestions && (
          <section className="picker-suggestions">
            <span className="eyebrow">Suggested alternatives</span>
            {suggestStatus === "loading" && <p className="picker-suggest-note">Finding related movements…</p>}
            {suggestStatus === "empty" && <p className="picker-suggest-note">No close matches yet. Try searching by name or equipment.</p>}
            <div className="picker-grid picker-suggest-grid">
              {suggestions.map((exercise) => (
                <PickerCard
                  key={`suggest-${exercise.id}`}
                  exercise={exercise}
                  pending={pendingId === exercise.id}
                  justAdded={flashId === exercise.id}
                  onSelect={handleSelect}
                />
              ))}
              {customMatches.slice(0, suggestStatus === "ready" ? 4 : 8).map((exercise) => (
                <PickerCard
                  key={`custom-suggest-${exercise.id}`}
                  exercise={exercise}
                  custom
                  pending={pendingId === exercise.id}
                  justAdded={flashId === exercise.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>
        )}
        {!showingSuggestions && (
          <div className="picker-grid">
            {customMatches.map((exercise) => (
              <PickerCard
                key={exercise.id}
                exercise={exercise}
                custom
                pending={pendingId === exercise.id}
                justAdded={flashId === exercise.id}
                onSelect={handleSelect}
              />
            ))}
            {catalogItems.map((exercise) => (
              <PickerCard
                key={exercise.id}
                exercise={exercise}
                pending={pendingId === exercise.id}
                justAdded={flashId === exercise.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
        <footer>
          <small>{stayOpen ? "Stays open so you can add several in a row" : "Catalog + your custom exercises"}</small>
          <button className="primary-button" onClick={onClose}>
            Done{addedCount ? ` · ${addedCount}` : ""}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PickerCard({
  exercise,
  custom,
  pending,
  justAdded,
  onSelect,
}: {
  exercise: Exercise;
  custom?: boolean;
  pending: boolean;
  justAdded: boolean;
  onSelect: (exercise: Exercise) => void;
}) {
  const thumb = exercise.gif_url || exercise.image;
  return (
    <button
      type="button"
      className={`picker-card${justAdded ? " just-added" : ""}${pending ? " pending" : ""}`}
      onClick={() => onSelect(exercise)}
      disabled={pending}
    >
      {thumb ? (
        custom ? (
          <ExerciseStill src={thumb} alt="" width={140} height={110} />
        ) : (
          <Image src={thumb} alt="" width={140} height={110} unoptimized />
        )
      ) : (
        <span className="picker-custom-thumb"><Sparkles size={22} /></span>
      )}
      <span>
        <small>{custom ? `Custom · ${exercise.target}` : exercise.target}</small>
        <strong>{exercise.name}</strong>
        <em>{exercise.equipment}{exercise.secondary_muscles[0] ? ` · ${exercise.secondary_muscles[0]}` : ""}</em>
      </span>
      <i className="picker-add">
        {justAdded ? <Check size={18} /> : <Plus size={18} />}
      </i>
    </button>
  );
}
