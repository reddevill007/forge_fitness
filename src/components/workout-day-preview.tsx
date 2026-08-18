"use client";

import { ArrowLeft, ArrowRight, Eye, PencilLine, Plus, Repeat2, Timer, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnatomeExerciseMuscleThumb } from "@/src/components/anatome-exercise-muscles";
import { ExerciseDemoPlayer } from "@/src/components/exercise-demo-player";
import { ExercisePicker } from "@/src/components/exercise-picker";
import { fetchExercise } from "@/src/lib/exercises-client";
import { anatomeResolveExercise } from "@/src/lib/anatome";
import { isBodyweightLoad } from "@/src/lib/firebase/stats";
import { workoutAlternativeFromCatalog } from "@/src/lib/firebase/firestore";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import { useDebouncedCallback } from "@/src/lib/use-debounced-callback";
import { workoutStillUrl } from "@/src/lib/workout-exercise-media";
import type { WorkoutExercise } from "@/src/types/fitness";

export type DayPreviewExercise = WorkoutExercise & {
  loggedSets?: Array<{ id: string; weight: number; reps: number; rir?: number }>;
};

type Source = "primary" | number;

export function WorkoutDayPreview({
  workoutName,
  focus,
  exercises,
  startIndex = 0,
  onClose,
  onSaveVideo,
  onUpdateExercise,
}: {
  workoutName: string;
  focus?: string;
  exercises: DayPreviewExercise[];
  startIndex?: number;
  onClose: () => void;
  onSaveVideo?: (exerciseId: string, videoUrl: string) => void | Promise<void>;
  onUpdateExercise?: (workoutExerciseId: string, patch: Partial<WorkoutExercise>) => void | Promise<void>;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, exercises.length - 1)));
  const [source, setSource] = useState<Source>("primary");
  const [picker, setPicker] = useState<"add" | number | null>(null);
  const { videoUrlForExercise } = useUserData();
  const [videoUrl, setVideoUrl] = useState<string | undefined>(exercises[index]?.videoUrl);
  const [gifUrl, setGifUrl] = useState<string | undefined>(exercises[index]?.gifUrl);
  const [imageUrl, setImageUrl] = useState<string | undefined>(exercises[index]?.imageUrl);
  const [videoDraft, setVideoDraft] = useState("");
  const exercise = exercises[index];
  const alternatives = exercise?.alternatives ?? [];
  const canEditAlts = Boolean(onUpdateExercise);
  const canEditVideo = Boolean(onSaveVideo || onUpdateExercise);

  const viewed = useMemo(() => {
    if (!exercise) return null;
    if (source === "primary") {
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        target: exercise.target,
        secondary: exercise.secondary,
        videoUrl: exercise.videoUrl,
        gifUrl: exercise.gifUrl,
        imageUrl: exercise.imageUrl,
      };
    }
    const alt = alternatives[source];
    if (!alt) {
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        target: exercise.target,
        secondary: exercise.secondary,
        videoUrl: exercise.videoUrl,
        gifUrl: exercise.gifUrl,
        imageUrl: exercise.imageUrl,
      };
    }
    return {
      exerciseId: alt.exerciseId,
      name: alt.name,
      target: alt.target || exercise.target,
      secondary: alt.secondary ?? exercise.secondary,
      videoUrl: alt.videoUrl,
      gifUrl: alt.gifUrl,
      imageUrl: alt.imageUrl,
    };
  }, [alternatives, exercise, source]);

  useEffect(() => {
    setIndex(Math.min(startIndex, Math.max(0, exercises.length - 1)));
    setSource("primary");
  }, [startIndex, exercises.length]);

  useEffect(() => {
    setSource("primary");
  }, [exercise?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (picker) {
        if (event.key === "Escape") setPicker(null);
        return;
      }
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((value) => Math.min(exercises.length - 1, value + 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exercises.length, onClose, picker]);

  useEffect(() => {
    if (!viewed) return;
    const remembered = viewed.videoUrl || videoUrlForExercise(viewed.exerciseId, viewed.name);
    setVideoUrl(remembered);
    setGifUrl(workoutStillUrl(viewed) || viewed.gifUrl);
    setImageUrl(viewed.imageUrl);
    setVideoDraft(remembered ?? "");
    if (!viewed.exerciseId) return;
    let cancelled = false;
    fetchExercise(viewed.exerciseId).then(async (item) => {
      if (cancelled) return;
      if (item) {
        setVideoUrl((value) => value || item.videoUrl);
        setGifUrl((value) => value || item.gif_url);
        setImageUrl((value) => value || item.image);
        setVideoDraft((value) => value || item.videoUrl || "");
        if (remembered || item.videoUrl) return;
      }
      if (remembered) return;
      try {
        const resolved = await anatomeResolveExercise(viewed.name);
        if (!cancelled) {
          setVideoUrl((value) => value || resolved.video_url);
          setVideoDraft((value) => value || resolved.video_url || "");
        }
      } catch {
        return;
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [videoUrlForExercise, viewed]);

  const commitVideo = useDebouncedCallback((url: string) => {
    if (!exercise || !viewed) return;
    void onSaveVideo?.(viewed.exerciseId, url);
    if (source === "primary") {
      void onUpdateExercise?.(exercise.id, { videoUrl: url });
      return;
    }
    const next = alternatives.map((alt, altIndex) => (
      altIndex === source ? { ...alt, videoUrl: url } : alt
    ));
    void onUpdateExercise?.(exercise.id, { alternatives: next });
  }, 600);

  async function applyAlternative(nextExercise: Parameters<typeof workoutAlternativeFromCatalog>[0], replaceIndex?: number) {
    if (!exercise || !onUpdateExercise) return;
    const used = new Set([exercise.exerciseId, ...alternatives.map((alt) => alt.exerciseId)]);
    if (replaceIndex === undefined && used.has(nextExercise.id)) return;
    if (replaceIndex !== undefined) used.delete(alternatives[replaceIndex]?.exerciseId);
    if (used.has(nextExercise.id)) return;
    const alt = workoutAlternativeFromCatalog(
      nextExercise,
      videoUrlForExercise(nextExercise.id, nextExercise.name),
    );
    const next = replaceIndex === undefined
      ? [...alternatives, alt].slice(0, 2)
      : alternatives.map((item, altIndex) => (altIndex === replaceIndex ? alt : item));
    await onUpdateExercise(exercise.id, { alternatives: next });
    setSource(replaceIndex ?? next.length - 1);
    setPicker(null);
  }

  async function removeAlternative(altIndex: number) {
    if (!exercise || !onUpdateExercise) return;
    const next = alternatives.filter((_, itemIndex) => itemIndex !== altIndex);
    await onUpdateExercise(exercise.id, { alternatives: next });
    setSource("primary");
  }

  if (!exercise || !viewed) return null;
  const viewingAlt = source !== "primary";

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
              <span className="eyebrow">
                Exercise {String(index + 1).padStart(2, "0")}
                {viewingAlt ? " · alternative" : ""}
              </span>
              <h1>{viewed.name}</h1>
              <p>
                {viewingAlt
                  ? `Stand-in for ${exercise.name} · ${viewed.target}`
                  : `${exercise.prescription} · ${exercise.target}`}
              </p>
            </div>
          </section>
          <div className="preview-alts" role="tablist" aria-label="Exercise and alternatives">
            <button
              type="button"
              role="tab"
              className={source === "primary" ? "active" : ""}
              aria-selected={source === "primary"}
              onClick={() => setSource("primary")}
            >
              Main
            </button>
            {alternatives.map((alt, altIndex) => (
              <button
                key={`${alt.exerciseId}-${altIndex}`}
                type="button"
                role="tab"
                className={source === altIndex ? "active" : ""}
                aria-selected={source === altIndex}
                onClick={() => setSource(altIndex)}
              >
                Alt {altIndex + 1}
                <small>{alt.name}</small>
              </button>
            ))}
            {canEditAlts && alternatives.length < 2 && (
              <button type="button" className="is-add" onClick={() => setPicker("add")}>
                <Plus size={14} /> Alternative
              </button>
            )}
          </div>
          <div className="active-grid">
            <aside className="active-media-card">
              <ExerciseDemoPlayer
                title={viewed.name}
                videoUrl={videoUrl}
                gifUrl={gifUrl}
                imageUrl={imageUrl}
              />
              <div className="target-row">
                <span><i className="primary-muscle" /> Primary<strong>{viewed.target}</strong></span>
                <span><i className="secondary-muscle" /> Secondary<strong>{viewed.secondary[0] ?? "—"}</strong></span>
              </div>
              <AnatomeExerciseMuscleThumb
                exerciseName={viewed.name}
                target={viewed.target}
                secondaryMuscles={viewed.secondary}
              />
              {canEditVideo && (
                <label className="preview-video-field">
                  YouTube / video URL
                  <input
                    value={videoDraft}
                    onChange={(event) => {
                      const next = event.target.value;
                      setVideoDraft(next);
                      setVideoUrl(next.trim() || videoUrl);
                      commitVideo(next.trim());
                    }}
                    onBlur={() => commitVideo.flush()}
                    placeholder="https://youtube.com/shorts/…"
                  />
                </label>
              )}
              {viewingAlt && canEditAlts && typeof source === "number" && (
                <div className="preview-alt-tools">
                  <button type="button" className="outline-button" onClick={() => setPicker(source)}>
                    <Repeat2 size={15} /> Replace
                  </button>
                  <button type="button" className="danger-text" onClick={() => void removeAlternative(source)}>
                    <Trash2 size={15} /> Remove alt
                  </button>
                </div>
              )}
              {canEditAlts && !viewingAlt && alternatives.length === 0 && (
                <p className="day-preview-note"><PencilLine size={15} /> Add an alternative to swap this movement in view.</p>
              )}
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
      {picker !== null && (
        <ExercisePicker
          title={picker === "add" ? "Add an alternative" : "Replace alternative"}
          suggestFor={{
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            target: exercise.target,
            secondary: exercise.secondary,
          }}
          excludeIds={[
            exercise.exerciseId,
            ...alternatives.map((alt) => alt.exerciseId),
          ]}
          onClose={() => setPicker(null)}
          onSelect={(item) => applyAlternative(item, picker === "add" ? undefined : picker)}
        />
      )}
    </div>
  );
}
