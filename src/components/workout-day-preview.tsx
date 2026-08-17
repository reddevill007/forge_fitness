"use client";

import { ArrowLeft, ArrowRight, Eye, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnatomeExerciseMuscleThumb } from "@/src/components/anatome-exercise-muscles";
import { ExerciseDemoPlayer } from "@/src/components/exercise-demo-player";
import { fetchExercise } from "@/src/lib/exercises-client";
import { anatomeResolveExercise } from "@/src/lib/anatome";
import { isBodyweightLoad } from "@/src/lib/firebase/stats";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import { workoutStillUrl } from "@/src/lib/workout-exercise-media";
import type { WorkoutExercise } from "@/src/types/fitness";

export type DayPreviewExercise = WorkoutExercise & {
  loggedSets?: Array<{ id: string; weight: number; reps: number; rir?: number }>;
};

export function WorkoutDayPreview({
  workoutName,
  focus,
  exercises,
  startIndex = 0,
  onClose,
}: {
  workoutName: string;
  focus?: string;
  exercises: DayPreviewExercise[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, exercises.length - 1)));
  const { videoUrlForExercise } = useUserData();
  const [videoUrl, setVideoUrl] = useState<string | undefined>(exercises[index]?.videoUrl);
  const [gifUrl, setGifUrl] = useState<string | undefined>(exercises[index]?.gifUrl);
  const [imageUrl, setImageUrl] = useState<string | undefined>(exercises[index]?.imageUrl);
  const exercise = exercises[index];

  useEffect(() => {
    setIndex(Math.min(startIndex, Math.max(0, exercises.length - 1)));
  }, [startIndex, exercises.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((value) => Math.min(exercises.length - 1, value + 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exercises.length, onClose]);

  useEffect(() => {
    const current = exercises[index];
    if (!current) return;
    setVideoUrl(current.videoUrl || videoUrlForExercise(current.exerciseId, current.name));
    setGifUrl(workoutStillUrl(current) || current.gifUrl);
    setImageUrl(current.imageUrl);
    if (!current.exerciseId) return;
    let cancelled = false;
    const knownVideo = current.videoUrl || videoUrlForExercise(current.exerciseId, current.name);
    fetchExercise(current.exerciseId).then(async (item) => {
      if (cancelled || !item) {
        if (!knownVideo) {
          try {
            const resolved = await anatomeResolveExercise(current.name);
            if (!cancelled) setVideoUrl((value) => value || resolved.video_url);
          } catch {
            return;
          }
        }
        return;
      }
      setVideoUrl((value) => value || item.videoUrl);
      setGifUrl((value) => value || item.gif_url);
      setImageUrl((value) => value || item.image);
      if (knownVideo || item.videoUrl) return;
      try {
        const resolved = await anatomeResolveExercise(current.name);
        if (!cancelled) setVideoUrl((value) => value || resolved.video_url);
      } catch {
        return;
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [exercises, index, videoUrlForExercise]);

  if (!exercise) return null;

  return (
    <div className="modal-layer day-preview-layer" role="dialog" aria-modal="true" aria-label={`${workoutName} preview`}>
      <div className="day-preview">
        <header className="day-preview-bar">
          <button className="back-button" type="button" onClick={onClose}><X size={18} /> Close preview</button>
          <div>
            <span className="eyebrow"><Eye size={13} /> Exercise day</span>
            <strong>{workoutName}</strong>
            {focus ? <small>{focus}</small> : null}
          </div>
          <span>{index + 1} / {exercises.length}</span>
        </header>
        <div className="day-preview-progress">
          <div style={{ width: `${((index + 1) / exercises.length) * 100}%` }} />
        </div>
        <div className="day-preview-body">
          <section className="active-exercise-head">
            <div>
              <span className="eyebrow">Exercise {String(index + 1).padStart(2, "0")}</span>
              <h1>{exercise.name}</h1>
              <p>{exercise.prescription} · {exercise.target}</p>
            </div>
          </section>
          <div className="active-grid">
            <aside className="active-media-card">
              <ExerciseDemoPlayer
                title={exercise.name}
                videoUrl={videoUrl}
                gifUrl={gifUrl}
                imageUrl={imageUrl}
              />
              <div className="target-row">
                <span><i className="primary-muscle" /> Primary<strong>{exercise.target}</strong></span>
                <span><i className="secondary-muscle" /> Secondary<strong>{exercise.secondary[0] ?? "—"}</strong></span>
              </div>
              <AnatomeExerciseMuscleThumb
                exerciseName={exercise.name}
                target={exercise.target}
                secondaryMuscles={exercise.secondary}
              />
            </aside>
            <section className="set-logger">
              <p className="day-preview-note">This is the day layout. Sets stay read-only in preview.</p>
              <div className="set-table">
                <div className="set-head"><span>Set</span><span>KG</span><span>Reps</span><span>RIR</span></div>
                {(exercise.loggedSets?.length
                  ? exercise.loggedSets
                  : Array.from({ length: 3 }, (_, setIndex) => ({
                      id: `preview-${setIndex}`,
                      weight: exercise.targetWeight ?? 0,
                      reps: 0,
                      rir: 2,
                    }))
                ).map((set, setIndex) => (
                  <div className="set-row preview-set" key={set.id}>
                    <span><b>{setIndex + 1}</b><small>working</small></span>
                    <strong className={exercise.loggedSets?.length && isBodyweightLoad(set.weight) ? "bw-load" : ""}>
                      {exercise.loggedSets?.length
                        ? (isBodyweightLoad(set.weight) ? "Bodyweight" : set.weight)
                        : (set.weight || "—")}
                    </strong>
                    <strong>{set.reps || "—"}</strong>
                    <strong>{set.rir ?? "—"}</strong>
                  </div>
                ))}
              </div>
              {exercise.restSeconds ? (
                <p className="day-preview-rest"><Timer size={15} /> Rest {exercise.restSeconds}s between sets</p>
              ) : null}
              <div className="day-preview-nav">
                <button type="button" className="outline-button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
                  <ArrowLeft size={16} /> Previous
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={index >= exercises.length - 1}
                  onClick={() => setIndex((value) => value + 1)}
                >
                  Next exercise <ArrowRight size={16} />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
