"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Link2, Plus, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { AnatomySpread } from "@/src/components/anatomy-plate";
import { AnatomeExerciseMuscles } from "@/src/components/anatome-exercise-muscles";
import { ContextualAiActions } from "@/src/components/coach/contextual-actions";
import { CustomExerciseMediaEditor } from "@/src/components/custom-exercise-form";
import { ExerciseDemoPlayer } from "@/src/components/exercise-demo-player";
import { ExerciseStill } from "@/src/components/exercise-still";
import { anatomeClipFits, anatomeResolveExercise } from "@/src/lib/anatome";
import { resolveAnatomyPlate } from "@/src/lib/body-anatomy";
import { useCoachPage } from "@/src/lib/coach/context";
import { exerciseMediaProvider } from "@/src/lib/exercise-media";
import { fetchAlternativeSuggestions } from "@/src/lib/exercise-suggestions";
import { useAuth } from "@/src/lib/firebase/auth-context";
import { getExerciseMedia } from "@/src/lib/firebase/firestore";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import { SectionTitle } from "@/src/components/ui";
import type { Exercise } from "@/src/types/fitness";

function RelatedLiftCard({ exercise }: { exercise: Exercise }) {
  const media = exerciseMediaProvider.resolve(exercise);
  return (
    <Link className="related-lift" href={`/exercises/${exercise.id}`}>
      <span className="related-lift-media">
        {media.src ? (
          <ExerciseStill className="exercise-gif" src={media.src} alt="" width={280} height={180} />
        ) : (
          <span className="custom-media-fallback">Custom</span>
        )}
      </span>
      <span className="muscle-tag">{exercise.target}</span>
      <strong>{exercise.name}</strong>
      <small>{exercise.equipment}</small>
      <i><ArrowUpRight size={16} /></i>
    </Link>
  );
}

export function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const { user } = useAuth();
  const { saveVideoUrl, videoUrlForExercise } = useUserData();
  const remembered = videoUrlForExercise(exercise.id, exercise.name);
  const [anatomeVideoUrl, setAnatomeVideoUrl] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [related, setRelated] = useState<Exercise[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAnatomeVideoUrl(null);
    setCustomVideoUrl(null);
    setVideoInput("");
    setSavedNote(false);

    if (user?.uid) {
      getExerciseMedia(user.uid, exercise.id)
        .then((doc) => {
          if (cancelled) return;
          const saved = doc?.videoUrl?.trim() || remembered;
          if (saved) {
            setCustomVideoUrl(saved);
            setVideoInput(saved);
            return;
          }
          return anatomeResolveExercise(exercise.name).then((result) => {
            if (!cancelled && anatomeClipFits(exercise.name, result)) {
              setAnatomeVideoUrl(result.video_url ?? null);
            }
          });
        })
        .catch(() => undefined);
    } else {
      anatomeResolveExercise(exercise.name)
        .then((result) => {
          if (!cancelled && anatomeClipFits(exercise.name, result)) {
            setAnatomeVideoUrl(result.video_url ?? null);
          }
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.name, remembered, user?.uid]);

  useEffect(() => {
    let cancelled = false;
    setRelated([]);
    fetchAlternativeSuggestions({
      exerciseId: exercise.id,
      name: exercise.name,
      target: exercise.target,
      secondary: exercise.secondary_muscles,
    })
      .then((items) => {
        if (!cancelled) setRelated(items.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.name, exercise.secondary_muscles, exercise.target]);

  const savedClip = customVideoUrl ?? exercise.videoUrl ?? remembered;
  const activeVideoUrl = savedClip || anatomeVideoUrl;
  const steps = exercise.instruction_steps.en ?? [];
  const secondary = exercise.secondary_muscles.filter(Boolean);
  const notebook = resolveAnatomyPlate(exercise.target) ?? resolveAnatomyPlate(exercise.body_part);

  useCoachPage({
    currentPage: "exercise",
    currentExercise: { id: exercise.id, name: exercise.name },
    hasFormVideo: Boolean(activeVideoUrl),
  });

  async function saveClip() {
    const next = videoInput.trim();
    if (!next) return;
    setSaving(true);
    setSavedNote(false);
    try {
      await saveVideoUrl(exercise.id, next);
      setCustomVideoUrl(next);
      setSavedNote(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="exercise-detail">
      <Link className="back-button" href="/exercises">
        <ArrowLeft size={17} /> Exercise library
      </Link>

      <header className="lift-head">
        <div>
          <div className="lift-kicker">
            <span className="paper-tag">{exercise.body_part || exercise.category}</span>
            <em>{exercise.equipment}</em>
            {exercise.category === "custom" ? <em>Custom</em> : null}
          </div>
          <h1>{exercise.name}</h1>
          <p>
            Hits <strong>{exercise.target}</strong>
            {secondary.length ? <> · also {secondary.slice(0, 4).join(" · ")}</> : null}
          </p>
        </div>
        <div className="lift-head-actions">
          <ContextualAiActions
            actions={[
              { label: "How am I progressing?", prompt: `How am I progressing on ${exercise.name}? Use my logged sets.` },
              { label: "Find alternatives", prompt: `Find alternatives to ${exercise.name} from the catalog.` },
            ]}
          />
          <Link className="outline-button" href="/workouts">
            <Plus size={16} /> Add to a workout
          </Link>
        </div>
      </header>

      <section className="lift-stage">
        <div className="lift-demo">
          <span className="eyebrow">Demonstration</span>
          <ExerciseDemoPlayer
            title={exercise.name}
            videoUrl={activeVideoUrl}
            gifUrl={exercise.gif_url}
            imageUrl={exercise.image}
            preferGif={Boolean(exercise.gif_url || exercise.image)}
          />
          {exercise.attribution ? <small className="media-credit">{exercise.attribution}</small> : null}
          {exercise.category === "custom" && <CustomExerciseMediaEditor exercise={exercise} />}
          <details className="lift-clip">
            <summary>
              <Link2 size={15} />
              {savedClip ? "Replace form clip" : "Attach a form clip"}
            </summary>
            <div className="video-url-editor">
              <label>
                <span className="sr-only">Form video URL</span>
                <input
                  value={videoInput}
                  onChange={(event) => {
                    setVideoInput(event.target.value);
                    setSavedNote(false);
                  }}
                  placeholder="Paste a YouTube Shorts URL"
                />
              </label>
              <button
                type="button"
                className="outline-button"
                onClick={() => void saveClip()}
                disabled={!videoInput.trim() || saving}
              >
                <Video size={16} /> {saving ? "Saving…" : savedNote ? "Saved" : "Save"}
              </button>
            </div>
            <p>Your clip loops in workouts. Catalog GIF stays as the default demo.</p>
          </details>
        </div>

        <aside className="lift-anatomy">
          <span className="eyebrow">Physique notebook</span>
          <h2>{notebook?.label ?? "Where it works"}</h2>
          {notebook ? (
            <>
              <p className="lift-anatomy-copy">{notebook.blurb}</p>
              <AnatomySpread plate={notebook} />
            </>
          ) : (
            <AnatomeExerciseMuscles
              exerciseName={exercise.name}
              target={exercise.target}
              secondaryMuscles={exercise.secondary_muscles}
            />
          )}
        </aside>
      </section>

      {steps.length > 0 && (
        <section className="lift-howto paper-panel">
          <SectionTitle
            eyebrow="Technique"
            title="How to perform"
            action={
              <ContextualAiActions
                actions={[
                  { label: "Cue me through it", prompt: `How should I perform ${exercise.name}? What should I feel, and which mistakes should I avoid?` },
                ]}
              />
            }
          />
          <ol className="instruction-list">
            {steps.map((step, index) => (
              <li key={`${index}-${step.slice(0, 24)}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {related.length > 0 && (
        <section className="lift-related">
          <SectionTitle
            eyebrow="Same muscle"
            title="Related movements"
            action={
              <Link className="text-button" href={`/exercises?muscle=${encodeURIComponent(exercise.target)}`}>
                Browse {exercise.target}
              </Link>
            }
          />
          <div className="related-lifts">
            {related.map((item) => (
              <RelatedLiftCard key={item.id} exercise={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
