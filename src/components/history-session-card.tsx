"use client";

import { Check, Eye, Flame, Minus, PencilLine, Plus, Timer, Trash2, Trophy, Weight, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { DumbbellDoodle, Scribble } from "@/src/components/doodles";
import { WorkoutDayPreview } from "@/src/components/workout-day-preview";
import type { StoredSession, StoredWorkout } from "@/src/lib/firebase/types";
import {
  elapsedSeconds,
  exerciseLabel,
  formatLoad,
  formatVolume,
  sessionDate,
  sessionDurationSeconds,
  sessionSetCount,
  sessionVolume,
  workingSet,
} from "@/src/lib/firebase/stats";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import type { ExerciseSession, SetLog } from "@/src/types/fitness";

const SET_KINDS: Array<SetLog["kind"]> = ["warmup", "working", "drop"];

function sessionStamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function clockLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateValue(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalParts(dateValue: string, timeValue: string) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;
  const date = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function formatDurationClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours <= 0) return { hours: 0, minutes, label: `${minutes}m` };
  return { hours, minutes, label: `${hours}h ${pad(minutes)}m` };
}

function applyWindow(startedAt: string, durationSeconds: number) {
  const duration = Math.max(60, durationSeconds);
  return {
    startedAt,
    durationSeconds: duration,
    completedAt: new Date(new Date(startedAt).getTime() + duration * 1000).toISOString(),
  };
}

function sessionDraft(session: StoredSession): StoredSession {
  const durationSeconds = sessionDurationSeconds(session) || session.durationSeconds || 60;
  const startedAt = session.startedAt;
  const completedAt = session.completedAt
    ?? new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString();
  return {
    ...session,
    startedAt,
    completedAt,
    durationSeconds: elapsedSeconds(startedAt, completedAt) || durationSeconds,
  };
}

function emptySet(setNumber: number, restSeconds = 90): SetLog {
  return {
    id: crypto.randomUUID(),
    setNumber,
    kind: "working",
    weight: 0,
    reps: 0,
    rir: 2,
    restSeconds,
    completed: true,
  };
}

function SessionDayStrip({ startedAt, completedAt }: { startedAt: string; completedAt: string }) {
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const startPct = Math.min(96, Math.max(1, ((start.getTime() - dayStart.getTime()) / dayMs) * 100));
  const rawWidth = ((end.getTime() - start.getTime()) / dayMs) * 100;
  const widthPct = Math.min(100 - startPct, Math.max(3, rawWidth));
  const wraps = end.getTime() - dayStart.getTime() > dayMs;

  return (
    <div className="session-day-strip" aria-hidden="true">
      <i className="session-day-range" style={{ left: `${startPct}%`, width: `${widthPct}%` }} />
      {wraps ? <i className="session-day-range is-wrap" /> : null}
      <span>12a</span>
      <span>6a</span>
      <span>12p</span>
      <span>6p</span>
      <span>12a</span>
    </div>
  );
}

export function HistorySessionCard({
  session,
  workouts,
}: {
  session: StoredSession;
  workouts: StoredWorkout[];
}) {
  const { videoUrlForExercise, saveVideoUrl, patchWorkout, patchSession } = useUserData();
  const inProgress = session.id.startsWith("in-progress:");
  const workout = workouts.find((item) => item.id === session.workoutDayId);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => sessionDraft(session));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(sessionDraft(session));
    setEditing(false);
    setError("");
  }, [session.id]);

  const live = editing ? draft : session;
  const duration = sessionDurationSeconds(live);
  const clock = formatDurationClock(duration);
  const endedAt = live.completedAt ?? applyWindow(live.startedAt, duration).completedAt;

  const lifts = live.exerciseSessions.flatMap((exerciseSession) => {
    const sets = exerciseSession.sets.filter((set) => workingSet(set));
    if (sets.length === 0) return [];
    const planned = workout?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId);
    const best = sets.reduce((lead, set) => (
      set.weight > lead.weight || (set.weight > 0 && set.weight === lead.weight && set.reps > lead.reps) ? set : lead
    ));
    return [{
      id: exerciseSession.id,
      name: exerciseLabel(live, exerciseSession, workouts),
      target: planned?.target,
      sets,
      best,
      volume: sets.reduce((total, set) => total + set.weight * set.reps, 0),
      planned,
    }];
  });
  const previewExercises = (workout?.exercises.length
    ? workout.exercises.map((item) => {
        const logged = live.exerciseSessions.find((row) => row.workoutExerciseId === item.id);
        return {
          ...item,
          videoUrl: item.videoUrl || videoUrlForExercise(item.exerciseId, item.name),
          loggedSets: logged?.sets.filter((set) => workingSet(set)).map((set) => ({
            id: set.id,
            weight: set.weight,
            reps: set.reps,
            rir: set.rir,
          })),
        };
      })
    : lifts.map((lift) => ({
        id: lift.id,
        exerciseId: lift.planned?.exerciseId ?? lift.id,
        name: lift.name,
        target: lift.target ?? "other",
        secondary: lift.planned?.secondary ?? [],
        prescription: lift.planned?.prescription ?? `${lift.sets.length} × ${lift.best.reps}`,
        restSeconds: lift.planned?.restSeconds ?? 90,
        videoUrl: lift.planned?.videoUrl || videoUrlForExercise(lift.planned?.exerciseId ?? lift.id, lift.name),
        gifUrl: lift.planned?.gifUrl,
        imageUrl: lift.planned?.imageUrl,
        loggedSets: lift.sets.map((set) => ({ id: set.id, weight: set.weight, reps: set.reps, rir: set.rir })),
      }))
  );

  const volume = sessionVolume(live);

  function updateExercise(index: number, patch: Partial<ExerciseSession>) {
    setDraft((current) => ({
      ...current,
      exerciseSessions: current.exerciseSessions.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function updateSet(exerciseIndex: number, setId: string, patch: Partial<SetLog>) {
    const exercise = draft.exerciseSessions[exerciseIndex];
    if (!exercise) return;
    updateExercise(exerciseIndex, {
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
    });
  }

  function setDuration(nextSeconds: number) {
    setDraft((current) => ({ ...current, ...applyWindow(current.startedAt, nextSeconds) }));
  }

  function setStart(nextIso: string | null) {
    if (!nextIso) return;
    setDraft((current) => ({
      ...current,
      ...applyWindow(nextIso, current.durationSeconds || duration),
    }));
  }

  function setEnd(nextIso: string | null) {
    if (!nextIso) return;
    setDraft((current) => {
      const start = new Date(current.startedAt).getTime();
      let end = new Date(nextIso).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return current;
      if (end <= start) end += 24 * 60 * 60 * 1000;
      return {
        ...current,
        completedAt: new Date(end).toISOString(),
        durationSeconds: Math.max(60, Math.round((end - start) / 1000)),
      };
    });
  }

  async function saveEdits() {
    setSaving(true);
    setError("");
    try {
      const window = applyWindow(draft.startedAt, draft.durationSeconds);
      if (!Number.isFinite(new Date(window.startedAt).getTime()) || !Number.isFinite(new Date(window.completedAt).getTime())) {
        throw new Error("That start or end time is invalid.");
      }
      await patchSession({ ...draft, ...window });
      setDraft({ ...draft, ...window });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <article className={`session-detail reveal delay-2 ${inProgress ? "is-live" : ""} ${editing ? "is-editing" : ""}`}>
      <DumbbellDoodle className="session-doodle" />
      <div className="session-detail-top">
        <span className={`session-status ${inProgress ? "live" : ""} ${editing ? "editing" : ""}`}>
          {inProgress ? <Zap size={13} fill="currentColor" /> : editing ? <PencilLine size={13} /> : <Check size={13} />}
          {inProgress ? "In progress" : editing ? "Editing log" : sessionStamp(sessionDate(live))}
        </span>
        <div className="session-detail-actions">
          {!inProgress && (
            <button
              type="button"
              className="session-view-day"
              onClick={() => {
                setDraft(sessionDraft(session));
                setEditing((current) => !current);
                setError("");
              }}
            >
              {editing ? <X size={15} /> : <PencilLine size={15} />}
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
          {previewExercises.length > 0 && (
            <button type="button" className="session-view-day" onClick={() => setPreviewIndex(0)}>
              <Eye size={15} /> View day
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <form
          className="session-edit"
          onSubmit={(event) => {
            event.preventDefault();
            void saveEdits();
          }}
        >
          <div className="session-edit-identity">
            <label>
              Workout
              <input value={draft.workoutName} onChange={(event) => setDraft((current) => ({ ...current, workoutName: event.target.value }))} />
            </label>
            <label>
              Focus
              <input value={draft.focus} onChange={(event) => setDraft((current) => ({ ...current, focus: event.target.value }))} />
            </label>
          </div>

          <section className="session-timeboard">
            <div className="session-timeboard-readout">
              <span>On the clock</span>
              <strong>{clock.label}</strong>
              <small>{clockLabel(draft.startedAt)} → {clockLabel(endedAt)}</small>
            </div>
            <SessionDayStrip startedAt={draft.startedAt} completedAt={endedAt} />
            <div className="session-timeboard-fields">
              <label>
                Day
                <input
                  type="date"
                  value={localDateValue(draft.startedAt)}
                  onChange={(event) => setStart(fromLocalParts(event.target.value, localTimeValue(draft.startedAt)))}
                />
              </label>
              <label>
                Start
                <input
                  type="time"
                  value={localTimeValue(draft.startedAt)}
                  onChange={(event) => setStart(fromLocalParts(localDateValue(draft.startedAt), event.target.value))}
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  value={localTimeValue(endedAt)}
                  onChange={(event) => setEnd(fromLocalParts(localDateValue(draft.startedAt), event.target.value))}
                />
              </label>
            </div>
            <div className="session-time-steppers">
              <div className="session-stepper">
                <button type="button" aria-label="Minus one hour" onClick={() => setDuration(duration - 3600)}>
                  <Minus size={14} />
                </button>
                <b>{clock.hours}</b>
                <em>hr</em>
                <button type="button" aria-label="Plus one hour" onClick={() => setDuration(duration + 3600)}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="session-stepper">
                <button type="button" aria-label="Minus five minutes" onClick={() => setDuration(duration - 300)}>
                  <Minus size={14} />
                </button>
                <b>{pad(clock.minutes)}</b>
                <em>min</em>
                <button type="button" aria-label="Plus five minutes" onClick={() => setDuration(duration + 300)}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </section>

          <label className="session-edit-notes">
            Notes
            <textarea
              rows={2}
              placeholder="How did it feel?"
              value={draft.notes ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          {draft.exerciseSessions.map((exerciseSession, exerciseIndex) => (
            <div className="session-edit-lift" key={exerciseSession.id}>
              <header>
                <em>{String(exerciseIndex + 1).padStart(2, "0")}</em>
                <input
                  className="session-edit-name"
                  value={exerciseSession.exerciseName ?? exerciseLabel(draft, exerciseSession, workouts)}
                  onChange={(event) => updateExercise(exerciseIndex, { exerciseName: event.target.value })}
                />
                <input
                  className="session-edit-lift-notes"
                  placeholder="Cue or note"
                  value={exerciseSession.notes ?? ""}
                  onChange={(event) => updateExercise(exerciseIndex, { notes: event.target.value })}
                />
              </header>
              <div className="session-log-sets">
                {exerciseSession.sets.map((set) => (
                  <div className={`session-log-set ${set.kind}`} key={set.id}>
                    <b>{set.setNumber}</b>
                    <div className="session-kind-pills" role="group" aria-label="Set kind">
                      {SET_KINDS.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={set.kind === kind ? "on" : ""}
                          onClick={() => updateSet(exerciseIndex, set.id, { kind })}
                        >
                          {kind}
                        </button>
                      ))}
                    </div>
                    <label>
                      kg
                      <input
                        type="number"
                        step="2.5"
                        min={0}
                        value={set.weight > 0 ? String(set.weight) : ""}
                        onChange={(event) => updateSet(exerciseIndex, set.id, { weight: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <label>
                      reps
                      <input
                        type="number"
                        min={0}
                        value={set.reps || ""}
                        onChange={(event) => updateSet(exerciseIndex, set.id, { reps: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <label>
                      RIR
                      <input
                        type="number"
                        min={0}
                        value={set.rir}
                        onChange={(event) => updateSet(exerciseIndex, set.id, { rir: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <button
                      type="button"
                      className="session-log-remove"
                      aria-label="Remove set"
                      onClick={() => updateExercise(exerciseIndex, {
                        sets: exerciseSession.sets
                          .filter((item) => item.id !== set.id)
                          .map((item, index) => ({ ...item, setNumber: index + 1 })),
                      })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="session-add-set"
                onClick={() => updateExercise(exerciseIndex, {
                  sets: [...exerciseSession.sets, emptySet(exerciseSession.sets.length + 1)],
                })}
              >
                <Plus size={16} /> Add set
              </button>
            </div>
          ))}
          {error ? <p className="session-edit-error" role="alert">{error}</p> : null}
          <button className="primary-button session-save" type="submit" disabled={saving}>
            <Check size={16} />
            {saving ? "Saving log…" : "Save session"}
          </button>
        </form>
      ) : (
        <>
          <h2>{session.workoutName}</h2>
          <p>{session.focus || "Logged session"}</p>
          <p className="session-clock-range">
            {clockLabel(session.startedAt)} → {clockLabel(endedAt)}
            <span>{clock.label}</span>
          </p>
          {session.notes ? <p className="session-notes">{session.notes}</p> : null}
          <Scribble className="session-scribble" />
          <SessionDayStrip startedAt={session.startedAt} completedAt={endedAt} />
          <div className="session-stats">
            <span>
              <Timer size={16} />
              <strong>{Math.max(1, Math.round(duration / 60))}</strong>
              min
            </span>
            <span>
              <Weight size={16} />
              <strong>{formatVolume(volume)}</strong>
              kg volume
            </span>
            <span>
              <Flame size={16} />
              <strong>{sessionSetCount(live)}</strong>
              sets
            </span>
          </div>
          <div className="session-lifts">
            {lifts.length === 0 && (
              <p className="session-empty-lifts">No working sets logged in this session yet.</p>
            )}
            {lifts.map((lift, index) => {
              const previewAt = previewExercises.findIndex((item) => item.id === lift.planned?.id || item.name === lift.name);
              return (
              <div key={lift.id}>
                <header>
                  <em>{String(index + 1).padStart(2, "0")}</em>
                  <div>
                    <strong>{lift.name}</strong>
                    <small>
                      {lift.target ? <span>{lift.target}</span> : null}
                      <span>{formatVolume(lift.volume)} kg</span>
                    </small>
                  </div>
                  <button
                    type="button"
                    className="session-view-lift"
                    onClick={() => setPreviewIndex(previewAt >= 0 ? previewAt : index)}
                  >
                    <Eye size={14} /> View
                  </button>
                </header>
                <div className="session-set-chips">
                  {lift.sets.map((set) => {
                    const isBest = set.id === lift.best.id;
                    return (
                      <b key={set.id} className={isBest ? "best" : ""}>
                        {isBest && <Trophy size={11} />}
                        {formatLoad(set.weight, set.reps)}
                      </b>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </article>
    {previewIndex !== null && previewExercises.length > 0 && (
      <WorkoutDayPreview
        workoutName={live.workoutName}
        focus={live.focus}
        exercises={previewExercises}
        startIndex={previewIndex}
        onClose={() => setPreviewIndex(null)}
        onSaveVideo={(exerciseId, url) => {
          if (url) void saveVideoUrl(exerciseId, url);
        }}
        onUpdateExercise={workout ? async (workoutExerciseId, patch) => {
          await patchWorkout(workout.id, {
            exercises: workout.exercises.map((item) => (
              item.id === workoutExerciseId ? { ...item, ...patch } : item
            )),
          });
        } : undefined}
      />
    )}
    </>
  );
}
