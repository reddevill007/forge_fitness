"use client";

import { useState } from "react";
import { CalendarDays, Dumbbell, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/src/components/confirm-dialog";
import { PageIntro } from "@/src/components/ui";
import { useCoachPage } from "@/src/lib/coach/context";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import type { StoredProgram, StoredWorkout } from "@/src/lib/firebase/types";

type PendingPurge =
  | { kind: "workout"; item: StoredWorkout }
  | { kind: "program"; item: StoredProgram }
  | { kind: "empty" };

function formatTrashedAt(iso?: string) {
  if (!iso) return "Recently";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrashPage() {
  const {
    trashedWorkouts,
    trashedPrograms,
    restoreWorkout,
    restoreProgram,
    purgeWorkout,
    purgeProgram,
    emptyTrash,
  } = useUserData();
  const [pending, setPending] = useState<PendingPurge | null>(null);
  const [busy, setBusy] = useState(false);
  useCoachPage({ currentPage: "trash" });

  const total = trashedWorkouts.length + trashedPrograms.length;

  async function run(task: Promise<void>) {
    setBusy(true);
    try {
      await task;
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageIntro
        eyebrow="Trash"
        title="Nothing is gone yet."
        copy="Deleted workouts and programs land here. Restore them, or delete forever."
        action={
          total > 0 ? (
            <button className="danger-text" type="button" onClick={() => setPending({ kind: "empty" })}>
              <Trash2 size={17} /> Empty trash
            </button>
          ) : undefined
        }
      />

      {total === 0 && (
        <div className="empty-state reveal delay-1">
          <Trash2 size={40} />
          <h3>Trash is empty</h3>
          <p>When you delete a workout or program, it stays here until you restore it or delete it forever.</p>
        </div>
      )}

      {trashedWorkouts.length > 0 && (
        <section className="trash-section reveal delay-1">
          <h2>Workouts</h2>
          <div className="trash-list">
            {trashedWorkouts.map((workout) => (
              <article className="paper-panel trash-card" key={workout.id}>
                <div className="trash-card-copy">
                  <span className="eyebrow"><Dumbbell size={14} /> Workout</span>
                  <h3>{workout.name}</h3>
                  <p>
                    {workout.exercises.length} exercises · {workout.focus || "No focus"} · Deleted {formatTrashedAt(workout.deletedAt)}
                  </p>
                </div>
                <div className="builder-title-actions">
                  <button className="outline-button" type="button" onClick={() => void restoreWorkout(workout.id)}>
                    <RotateCcw size={15} /> Restore
                  </button>
                  <button className="danger-text" type="button" onClick={() => setPending({ kind: "workout", item: workout })}>
                    <Trash2 size={16} /> Delete forever
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {trashedPrograms.length > 0 && (
        <section className="trash-section reveal delay-1">
          <h2>Programs</h2>
          <div className="trash-list">
            {trashedPrograms.map((program) => (
              <article className="paper-panel trash-card" key={program.id}>
                <div className="trash-card-copy">
                  <span className="eyebrow"><CalendarDays size={14} /> Program</span>
                  <h3>{program.name}</h3>
                  <p>
                    {program.schedule.filter((slot) => slot.workoutDayId).length} scheduled days · Deleted {formatTrashedAt(program.deletedAt)}
                  </p>
                </div>
                <div className="builder-title-actions">
                  <button className="outline-button" type="button" onClick={() => void restoreProgram(program.id)}>
                    <RotateCcw size={15} /> Restore
                  </button>
                  <button className="danger-text" type="button" onClick={() => setPending({ kind: "program", item: program })}>
                    <Trash2 size={16} /> Delete forever
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {pending?.kind === "workout" && (
        <ConfirmDialog
          title={`Delete ${pending.item.name} forever?`}
          copy="This cannot be undone. Logged sessions stay in History, but this workout template will be gone."
          confirmLabel="Delete forever"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(purgeWorkout(pending.item.id))}
        />
      )}
      {pending?.kind === "program" && (
        <ConfirmDialog
          title={`Delete ${pending.item.name} forever?`}
          copy="This cannot be undone. The weekly schedule will be removed."
          confirmLabel="Delete forever"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(purgeProgram(pending.item.id))}
        />
      )}
      {pending?.kind === "empty" && (
        <ConfirmDialog
          title="Empty trash?"
          copy={`Permanently delete ${total} item${total === 1 ? "" : "s"}. Logged sessions stay in History.`}
          confirmLabel="Empty trash"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(emptyTrash())}
        />
      )}
    </div>
  );
}
