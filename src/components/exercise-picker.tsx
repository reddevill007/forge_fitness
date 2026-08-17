"use client";

import Image from "next/image";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Exercise } from "@/src/types/fitness";
import { fetchExercises } from "@/src/lib/exercises-client";
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
}: {
  onClose: () => void;
  onSelect: (exercise: Exercise) => void | Promise<void>;
  stayOpen?: boolean;
  title?: string;
  added?: AddedExercise[];
}) {
  const { customExercises, addExerciseToCatalog } = useUserData();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [localAdded, setLocalAdded] = useState<AddedExercise[]>([]);

  const addedList = added.length ? added : localAdded;
  const addedCount = addedList.length;

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
    return customExercises.filter((exercise) =>
      !q || exercise.name.toLowerCase().includes(q) || exercise.target.toLowerCase().includes(q),
    );
  }, [customExercises, query]);

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
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalog or your custom exercises…" />
        </div>
        <div className="picker-toolbar">
          <p>Tap a card to add it. Keep stacking, then hit Done.</p>
          <button className="outline-button" type="button" onClick={() => setCreating(true)}>
            <Plus size={16} /> Custom exercise
          </button>
        </div>
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
          {items.map((exercise) => (
            <PickerCard
              key={exercise.id}
              exercise={exercise}
              pending={pendingId === exercise.id}
              justAdded={flashId === exercise.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
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
