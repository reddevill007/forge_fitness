"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Trophy, X } from "lucide-react";
import { AnatomeMuscleImpact } from "@/src/components/anatome-muscle-impact";
import { MiniChart } from "@/src/components/doodles";
import { useCoach } from "@/src/lib/coach/context";
import type { CoachAction, CoachBlock, PendingWrite, WorkoutPreviewExercise } from "@/src/lib/coach/types";

function Chart({ points, color = "var(--lime)" }: { points: Array<{ label: string; value: number }>; color?: string }) {
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  return (
    <div className="coach-chart">
      <MiniChart values={values} color={color} />
      <div className="coach-chart-bars">
        {points.map((point) => (
          <div key={point.label}>
            <i style={{ height: `${Math.max(8, Math.round((point.value / max) * 100))}%` }} />
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionRow({ items }: { items: CoachAction[] }) {
  const coach = useCoach();
  const router = useRouter();
  if (!items.length) return null;
  return (
    <div className="coach-actions">
      {items.map((item) => {
        if (item.kind === "navigate" && item.href) {
          return (
            <Link key={item.id} className="outline-button" href={item.href}>
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className="outline-button"
            onClick={() => {
              if (item.kind === "prompt" && item.prompt) void coach?.ask(item.prompt);
              if (item.kind === "navigate" && item.href) router.push(item.href);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ExerciseList({ exercises }: { exercises: WorkoutPreviewExercise[] }) {
  return (
    <ol className="coach-exercise-list">
      {exercises.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{exercise.name}</strong>
            <small>
              {exercise.prescription}
              {exercise.restSeconds ? ` · rest ${exercise.restSeconds >= 60 ? `${Math.round(exercise.restSeconds / 60)} min` : `${exercise.restSeconds}s`}` : ""}
              {exercise.target ? ` · ${exercise.target}` : ""}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Confirmation({ write, title, summary }: { write: PendingWrite; title: string; summary: string }) {
  const coach = useCoach();
  const exercises = write.payload && "exercises" in write.payload ? write.payload.exercises : undefined;
  return (
    <article className="coach-card coach-confirm">
      <span className="eyebrow">Needs your OK</span>
      <h3>{title}</h3>
      <p>{summary}</p>
      {exercises && exercises.length > 0 && (
        <ExerciseList exercises={exercises} />
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

export function CoachBlockView({ block }: { block: CoachBlock }) {
  switch (block.type) {
    case "text":
      return <p className="coach-text">{block.text}</p>;
    case "pr_card":
      return (
        <article className="coach-card coach-pr">
          <span className="coach-pr-burst"><Trophy size={18} /></span>
          <span className="eyebrow">Personal best</span>
          <h3>{block.exercise}</h3>
          <strong>{block.weight && block.reps ? `${block.weight} kg × ${block.reps}` : block.value}</strong>
          {block.estimated1RM ? (
            <p>Estimated 1RM <b>{block.estimated1RM} kg</b></p>
          ) : null}
          {block.delta ? <small>{block.delta}</small> : null}
          <ActionRow items={[{ id: "pr-progress", label: "View Progress", kind: "navigate", href: "/records" }]} />
        </article>
      );
    case "workout_preview":
      return (
        <article className="coach-card coach-workout">
          <span className="eyebrow">{block.focus || "Session"}</span>
          <h3>{block.name}</h3>
          <p>
            {block.duration ? `Estimated ${block.duration} min` : "Structured session"}
            {block.score ? ` · ${block.score}/10` : ""}
          </p>
          <ExerciseList exercises={block.exercises} />
          <ActionRow
            items={[
              { id: "edit", label: "Edit", kind: "prompt", prompt: `Edit this ${block.name} workout. Ask me what to change.` },
              { id: "regen", label: "Regenerate", kind: "prompt", prompt: `Regenerate ${block.name} with a different exercise selection.` },
              { id: "program", label: "Add to Program", kind: "navigate", href: "/programs" },
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
      return (
        <article className="coach-card">
          <span className="muscle-tag">{block.target || "Exercise"}</span>
          <h3>{block.name}</h3>
          <p>{[block.equipment, block.secondary?.join(" · "), block.prescription].filter(Boolean).join(" · ")}</p>
          {block.exerciseId ? (
            <ActionRow items={[{ id: "open-ex", label: "Open exercise", kind: "navigate", href: `/exercises/${block.exerciseId}` }]} />
          ) : null}
        </article>
      );
    case "muscle_map":
      return (
        <article className="coach-card coach-muscle">
          <span className="eyebrow">{block.title || "Muscle map"}</span>
          {block.exerciseNames.length > 0 ? (
            <AnatomeMuscleImpact exerciseNames={block.exerciseNames} view="front" gender="male" />
          ) : (
            <p>No mapped exercises yet.</p>
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
    case "progress_chart":
    case "volume_chart":
      return (
        <article className="coach-card">
          <span className="eyebrow">{block.type === "volume_chart" ? "Volume" : "Progress"}</span>
          <h3>{block.title}</h3>
          <Chart points={block.points} color={block.type === "volume_chart" ? "var(--orange)" : "var(--lime)"} />
          {block.summary ? <p>{block.summary}</p> : null}
        </article>
      );
    case "recommendation_card":
      return (
        <article className="coach-card coach-rate">
          <span className="eyebrow">Workout review</span>
          <h3>{block.title}</h3>
          {typeof block.score === "number" && (
            <strong className="coach-score">{block.score.toFixed(1)} <i>/ 10</i></strong>
          )}
          {block.good && block.good.length > 0 && (
            <div>
              <span className="eyebrow">What&apos;s good</span>
              <ul>{block.good.map((item) => <li key={item}>✓ {item}</li>)}</ul>
            </div>
          )}
          {block.improve && block.improve.length > 0 && (
            <div>
              <span className="eyebrow">Could improve</span>
              <ul>{block.improve.map((item) => <li key={item}>→ {item}</li>)}</ul>
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
    case "actions":
      return <ActionRow items={block.items} />;
    default:
      return null;
  }
}
