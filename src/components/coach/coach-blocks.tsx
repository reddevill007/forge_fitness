"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Check,
  Dumbbell,
  Star,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { AnatomeExerciseMuscleThumb } from "@/src/components/anatome-exercise-muscles";
import { AnatomeMuscleImpact } from "@/src/components/anatome-muscle-impact";
import { ExerciseDemoPlayer } from "@/src/components/exercise-demo-player";
import { ExerciseStill } from "@/src/components/exercise-still";
import { FocusMuscleMap } from "@/src/components/focus-muscle-map";
import { anatomeResolveExercise } from "@/src/lib/anatome";
import { compositionDateLabel, compositionSummary } from "@/src/lib/body-composition";
import type { BodyCompositionWrite } from "@/src/lib/body-composition";
import { resolveDatasetMedia } from "@/src/lib/dataset-media";
import { fetchExercise } from "@/src/lib/exercises-client";
import { useCoach } from "@/src/lib/coach/context";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import type { CoachAction, CoachBlock, PendingWrite, WorkoutPreviewExercise } from "@/src/lib/coach/types";

function LineChart({ points, color = "var(--lime)" }: { points: Array<{ label: string; value: number }>; color?: string }) {
  const id = useId().replace(/:/g, "");
  if (points.length === 0) return null;
  const width = 320;
  const height = 128;
  const padX = 8;
  const padY = 14;
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const span = max - min || 1;
  const coords = points.map((point, index) => ({
    x: padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2),
    y: height - padY - ((point.value - min) / span) * (height - padY * 2),
    label: point.label,
    value: point.value,
  }));
  const last = coords.at(-1) ?? coords[0];
  const peak = coords.reduce((best, point) => (point.value > best.value ? point : best), coords[0]);
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const area = `${line} L${last.x} ${height - padY} L${coords[0].x} ${height - padY} Z`;

  return (
    <div className="coach-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Progress chart">
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#fill-${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={peak.x} cy={peak.y} r="4.2" fill={color} stroke="var(--paper-2)" strokeWidth="2" />
      </svg>
      <div className="coach-chart-axis">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

function chipIcon(label: string) {
  const key = label.toLowerCase();
  if (key.includes("workout") || key.includes("session") || key.includes("create")) return Dumbbell;
  if (key.includes("progress") || key.includes("pr") || key.includes("strong")) return TrendingUp;
  if (key.includes("muscle") || key.includes("gap")) return Activity;
  if (key.includes("eat") || key.includes("nutrition") || key.includes("calorie")) return Utensils;
  if (key.includes("open") || key.includes("view") || key.includes("start")) return ArrowUpRight;
  return Activity;
}

export function CoachChipRow({
  items,
  onPrompt,
}: {
  items: CoachAction[];
  onPrompt?: (prompt: string) => void;
}) {
  const coach = useCoach();
  const router = useRouter();
  if (!items.length) return null;
  return (
    <div className="coach-actions">
      {items.map((item) => {
        const Icon = chipIcon(item.label);
        const className = "coach-chip";
        if (item.kind === "navigate" && item.href) {
          return (
            <Link key={item.id} className={className} href={item.href}>
              <span className="coach-chip-icon"><Icon size={14} /></span>
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={className}
            onClick={() => {
              if (item.kind === "prompt" && item.prompt) {
                if (onPrompt) onPrompt(item.prompt);
                else void coach?.ask(item.prompt);
              }
              if (item.kind === "navigate" && item.href) router.push(item.href);
            }}
          >
            <span className="coach-chip-icon"><Icon size={14} /></span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ActionRow({ items }: { items: CoachAction[] }) {
  return <CoachChipRow items={items} />;
}

function Stars({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.round((score / 10) * 10) / 2));
  return (
    <span className="coach-stars" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={16}
          fill={index + 1 <= filled ? "var(--lime)" : "transparent"}
          color={index + 0.5 <= filled ? "var(--lime-dark)" : "var(--line-strong)"}
        />
      ))}
    </span>
  );
}

function ExerciseThumb({ exerciseId, name }: { exerciseId?: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    fetchExercise(exerciseId)
      .then((exercise) => {
        if (cancelled || !exercise) return;
        const next = resolveDatasetMedia(exercise.gif_url) || resolveDatasetMedia(exercise.image);
        if (next) setSrc(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (!src) return <span className="coach-ex-thumb is-fallback">{name.slice(0, 1).toUpperCase()}</span>;
  return <ExerciseStill className="coach-ex-thumb" src={src} alt="" width={52} height={52} />;
}

function ExerciseList({ exercises }: { exercises: WorkoutPreviewExercise[] }) {
  return (
    <ol className="coach-exercise-list">
      {exercises.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`}>
          <ExerciseThumb exerciseId={exercise.exerciseId} name={exercise.name} />
          <div>
            <strong>{index + 1}. {exercise.name}</strong>
            {exercise.target ? <small>{exercise.target}</small> : null}
          </div>
          <em>{exercise.prescription}</em>
        </li>
      ))}
    </ol>
  );
}

function compositionRows(payload: BodyCompositionWrite) {
  const rows: Array<[string, string]> = [];
  const push = (label: string, value?: number | string, unit = "") => {
    if (value == null || value === "") return;
    rows.push([label, typeof value === "number" ? `${value}${unit ? ` ${unit}` : ""}` : value]);
  };
  push("Weight", payload.weightKg, "kg");
  push("Body fat", payload.bodyFatPercent, "%");
  push("Skeletal muscle", payload.skeletalMuscleKg, "kg");
  push("BMI", payload.bmi);
  push("Visceral fat", payload.visceralFatIndex);
  push("Body age", payload.bodyAge);
  push("Health score", payload.healthScore);
  push("Type", payload.obesityType);
  push("Target weight", payload.targetWeightKg, "kg");
  push("Fat to lose", payload.fatControlKg, "kg");
  return rows;
}

function Confirmation({ write, title, summary }: { write: PendingWrite; title: string; summary: string }) {
  const coach = useCoach();
  const exercises = write.payload && "exercises" in write.payload ? write.payload.exercises : undefined;
  const scanReports = write.tool === "save_body_composition" ? write.payload.reports : [];
  return (
    <article className="coach-card coach-confirm">
      <span className="eyebrow">Needs your OK</span>
      <h3>{title}</h3>
      <p>{summary}</p>
      {exercises && exercises.length > 0 && (
        <ExerciseList exercises={exercises} />
      )}
      {scanReports.length > 0 && (
        <div className="coach-scan-reports">
          {scanReports.map((report, index) => {
            const rows = compositionRows(report);
            return (
              <div key={`${report.measuredAt ?? "scan"}-${index}`} className="coach-scan-report">
                <strong>{compositionDateLabel(report.measuredAt)}</strong>
                {rows.length > 0 && (
                  <ul className="body-scan-preview">
                    {rows.map(([label, value]) => (
                      <li key={label}><span>{label}</span><strong>{value}</strong></li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="coach-actions">
        <button type="button" className="outline-button" onClick={() => coach?.dismissWrite(write)}>
          <X size={16} /> Cancel
        </button>
        <button type="button" className="primary-button" onClick={() => void coach?.confirmWrite(write)}>
          <Check size={16} /> Confirm
        </button>
      </div>
    </article>
  );
}

function CoachExerciseCard({ block }: { block: Extract<CoachBlock, { type: "exercise_card" }> }) {
  const { videoUrlForExercise } = useUserData();
  const [videoUrl, setVideoUrl] = useState(block.videoUrl);
  const [gifUrl, setGifUrl] = useState(block.gifUrl);
  const [imageUrl, setImageUrl] = useState(block.imageUrl);
  const [instructions, setInstructions] = useState(block.instructions ?? []);
  const [target, setTarget] = useState(block.target ?? "");
  const [secondary, setSecondary] = useState(block.secondary ?? []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let nextVideo = block.videoUrl || (block.exerciseId ? videoUrlForExercise(block.exerciseId, block.name) : undefined);
      let nextGif = block.gifUrl;
      let nextImage = block.imageUrl;
      let nextInstructions = block.instructions ?? [];
      let nextTarget = block.target ?? "";
      let nextSecondary = block.secondary ?? [];
      if (block.exerciseId) {
        const catalog = await fetchExercise(block.exerciseId);
        if (catalog) {
          nextVideo = nextVideo || catalog.videoUrl;
          nextGif = nextGif || catalog.gif_url;
          nextImage = nextImage || catalog.image;
          if (!nextInstructions.length) nextInstructions = catalog.instruction_steps.en ?? [];
          nextTarget = nextTarget || catalog.target;
          nextSecondary = nextSecondary.length ? nextSecondary : catalog.secondary_muscles;
        }
      }
      if (!nextVideo) {
        const resolved = await anatomeResolveExercise(block.name).catch(() => null);
        nextVideo = resolved?.video_url ?? nextVideo;
      }
      if (cancelled) return;
      setVideoUrl(nextVideo);
      setGifUrl(nextGif);
      setImageUrl(nextImage);
      setInstructions(nextInstructions.slice(0, 6));
      setTarget(nextTarget);
      setSecondary(nextSecondary);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [block.exerciseId, block.gifUrl, block.imageUrl, block.instructions, block.name, block.secondary, block.target, block.videoUrl, videoUrlForExercise]);

  return (
    <article className="coach-card coach-exercise">
      <span className="muscle-tag">{target || block.bodyPart || "Exercise"}</span>
      <h3>{block.name}</h3>
      <p>{[block.equipment, secondary.slice(0, 3).join(" · "), block.prescription].filter(Boolean).join(" · ")}</p>
      <div className="coach-exercise-stage">
        <ExerciseDemoPlayer
          title={block.name}
          videoUrl={videoUrl}
          gifUrl={gifUrl}
          imageUrl={imageUrl}
          label=""
          alt=""
        />
        {target ? (
          <AnatomeExerciseMuscleThumb
            exerciseName={block.name}
            target={target}
            secondaryMuscles={secondary}
            alt=""
          />
        ) : null}
      </div>
      {instructions.length > 0 && (
        <ol className="instruction-list compact">
          {instructions.map((step, index) => (
            <li key={`${index}-${step.slice(0, 24)}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      )}
      {block.exerciseId ? (
        <ActionRow items={[{ id: "open-ex", label: "Open exercise", kind: "navigate", href: `/exercises/${block.exerciseId}` }]} />
      ) : null}
    </article>
  );
}

export function CoachBlockView({ block }: { block: CoachBlock }) {
  switch (block.type) {
    case "text":
      return <p className="coach-text">{block.text}</p>;
    case "pr_card": {
      const headline = block.estimated1RM ?? block.weight;
      return (
        <article className="coach-card coach-pr">
          <header className="coach-card-head">
            <h3>{block.exercise} progress</h3>
            {block.estimated1RM ? <span className="coach-badge">1RM estimate</span> : <span className="coach-badge">Personal best</span>}
          </header>
          <strong>
            {headline != null ? <>{headline} <i>kg</i></> : block.value}
          </strong>
          <p>{block.delta || (block.reps ? `${block.reps} reps` : "Personal record")}</p>
          <ActionRow items={[{ id: "pr-progress", label: "View Progress", kind: "navigate", href: "/records" }]} />
        </article>
      );
    }
    case "workout_preview":
      return (
        <article className="coach-card coach-workout">
          <header className="coach-card-head">
            <h3>{block.name}</h3>
            {block.score ? <span className="coach-badge">{block.score}/10</span> : null}
          </header>
          <p>{block.duration ? `Estimated ${block.duration} min` : "Structured session"}</p>
          <ExerciseList exercises={block.exercises} />
          {block.focus ? <p className="coach-focus">Focus: <b>{block.focus}</b></p> : null}
          <ActionRow
            items={[
              { id: "edit", label: "Edit", kind: "prompt", prompt: `Edit this ${block.name} workout. Ask me what to change.` },
              { id: "regen", label: "Regenerate", kind: "prompt", prompt: `Regenerate ${block.name} with a different exercise selection.` },
              { id: "start", label: "Start Workout", kind: "navigate", href: "/workout" },
            ]}
          />
        </article>
      );
    case "workout_card":
      return (
        <article className="coach-card">
          <span className="eyebrow">Workout</span>
          <h3>{block.name}</h3>
          <p>{[block.focus, block.duration ? `${block.duration} min` : null, block.exerciseCount ? `${block.exerciseCount} exercises` : null].filter(Boolean).join(" · ")}</p>
          {block.workoutId ? (
            <ActionRow items={[{ id: "open", label: "Open workout", kind: "navigate", href: `/workouts?w=${block.workoutId}` }]} />
          ) : null}
        </article>
      );
    case "exercise_card":
      return <CoachExerciseCard block={block} />;
    case "muscle_map": {
      const bodyParts = block.bodyParts?.length
        ? block.bodyParts
        : (block.muscles ?? []).map((muscle) => muscle.name).filter(Boolean);
      return (
        <article className="coach-card coach-muscle">
          <span className="eyebrow">{block.title || "Muscle map"}</span>
          {block.exerciseNames.length > 0 ? (
            <AnatomeMuscleImpact exerciseNames={block.exerciseNames} view="front" gender="male" />
          ) : bodyParts.length > 0 ? (
            <FocusMuscleMap muscles={bodyParts} compact />
          ) : (
            <p>No mapped muscles yet.</p>
          )}
          {block.muscles && block.muscles.length > 0 && (
            <ul className="coach-muscle-list">
              {block.muscles.map((muscle) => (
                <li key={muscle.name}>
                  <strong>{muscle.name}</strong>
                  <span>{muscle.sets} sets</span>
                  {muscle.status ? <small>{muscle.status}</small> : null}
                </li>
              ))}
            </ul>
          )}
          <ActionRow items={[{ id: "map", label: "View Muscle Map", kind: "navigate", href: "/muscles" }]} />
        </article>
      );
    }
    case "progress_chart":
    case "volume_chart": {
      const last = block.points.at(-1);
      const unit = block.type === "volume_chart" ? "" : (block.unit ?? "");
      return (
        <article className="coach-card coach-progress">
          <header className="coach-card-head">
            <h3>{block.title}</h3>
            <span className="coach-badge">{block.type === "volume_chart" ? "Volume" : "Progress"}</span>
          </header>
          {last ? (
            <>
              <strong>{last.value}{unit ? ` ${unit}` : ""}</strong>
              <p>{block.summary || "Latest logged value"}</p>
            </>
          ) : null}
          <LineChart points={block.points} color={block.type === "volume_chart" ? "var(--orange)" : "var(--lime)"} />
        </article>
      );
    }
    case "recommendation_card":
      return (
        <article className="coach-card coach-rate">
          <header className="coach-card-head">
            <h3>Overall rating</h3>
          </header>
          {typeof block.score === "number" && (
            <div className="coach-score-row">
              <strong className="coach-score">{block.score.toFixed(1)} <i>/ 10</i></strong>
              <Stars score={block.score} />
            </div>
          )}
          {block.good && block.good.length > 0 && (
            <div className="coach-note-list is-good">
              <span>Great plan. Here&apos;s why:</span>
              <ul>
                {block.good.map((item) => (
                  <li key={item}><Check size={13} /> {item}</li>
                ))}
              </ul>
            </div>
          )}
          {block.improve && block.improve.length > 0 && (
            <div className="coach-note-list is-warn">
              <span>Suggestions to improve</span>
              <ul>
                {block.improve.map((item) => (
                  <li key={item}><AlertCircle size={13} /> {item}</li>
                ))}
              </ul>
            </div>
          )}
          {block.suggestion ? <p>{block.suggestion}</p> : null}
        </article>
      );
    case "confirmation_card":
      if (!block.write?.payload) return null;
      return <Confirmation write={block.write} title={block.title} summary={block.summary} />;
    case "exercise_preview":
      return (
        <article className="coach-card">
          <span className="eyebrow">Exercise draft</span>
          <h3>{block.name}</h3>
          <p>{block.target} · {block.equipment} · {block.bodyPart}</p>
          {block.secondaryMuscles.length > 0 && <small>{block.secondaryMuscles.join(" · ")}</small>}
          <ol className="instruction-list compact">
            {block.instructions.map((step, index) => (
              <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>
            ))}
          </ol>
        </article>
      );
    case "body_scan_card": {
      const payload: BodyCompositionWrite = {
        weightKg: block.weightKg,
        bodyFatPercent: block.bodyFatPercent,
        skeletalMuscleKg: block.skeletalMuscleKg,
        bmi: block.bmi,
        visceralFatIndex: block.visceralFatIndex,
        bodyAge: block.bodyAge,
        healthScore: block.healthScore,
        obesityType: block.obesityType,
        targetWeightKg: block.targetWeightKg,
      };
      const rows = compositionRows(payload);
      return (
        <article className="coach-card coach-scan">
          <span className="eyebrow">Body scan</span>
          <h3>{block.measuredAt ? compositionDateLabel(block.measuredAt) : compositionSummary(payload)}</h3>
          {block.obesityType ? <p>{block.obesityType}</p> : <p>{compositionSummary(payload)}</p>}
          {rows.length > 0 && (
            <ul className="body-scan-preview">
              {rows.map(([label, value]) => (
                <li key={label}><span>{label}</span><strong>{value}</strong></li>
              ))}
            </ul>
          )}
          <ActionRow items={[{ id: "open-body", label: "Open body analysis", kind: "navigate", href: "/body" }]} />
        </article>
      );
    }
    case "actions":
      return <ActionRow items={block.items} />;
    default:
      return null;
  }
}
