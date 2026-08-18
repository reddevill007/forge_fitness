"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  Dumbbell,
  Flame,
  GripVertical,
  History,
  ListFilter,
  LogOut,
  Moon,
  MoreHorizontal,
  Pause,
  PencilLine,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Trophy,
  Video,
  Weight,
  X,
  Zap,
  Eye,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/src/lib/firebase/auth-context";
import {
  defaultSets,
  exerciseLabel,
  exerciseStats,
  exerciseWeightTrend,
  exerciseProgressTrend,
  formatDuration,
  formatVolume,
  greetingName,
  loggedSessions,
  mergeRecords,
  recordsFromTraining,
  sessionDate,
  sessionSetCount,
  sessionVolume,
  stampExerciseSessions,
  todayLabel,
  trainedDaysInMonth,
  weeklyStats,
  weeklyVolumeSeries,
  weeklySetsSeries,
  weeklyDurationSeries,
  weekdaySessionCounts,
  currentStreak,
  workingSet,
  workoutCompletedToday,
  displayRecordValue,
  formatLoad,
  formatLoggedValue,
  isBodyweightRecordValue,
  setsByMuscle,
  setsByLoadKind,
  plannedSetsByMuscle,
} from "@/src/lib/firebase/stats";
import { getExerciseMedia, workoutAlternativeFromCatalog } from "@/src/lib/firebase/firestore";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import type { PendingSession } from "@/src/lib/firebase/firestore";
import type { ActiveSessionProgress, StoredSession, StoredWorkout, UserProfile } from "@/src/lib/firebase/types";
import { storeSessionSummary } from "@/src/lib/session-summary";
import { useDebouncedCallback } from "@/src/lib/use-debounced-callback";
import type { Exercise, ExerciseSession, SetLog, WorkoutExercise } from "@/src/types/fitness";
import { CustomExerciseForm, CustomExerciseMediaEditor } from "@/src/components/custom-exercise-form";
import { ContextualAiActions } from "@/src/components/coach/contextual-actions";
import { ExerciseStill } from "@/src/components/exercise-still";
import { ExerciseDemoPlayer } from "@/src/components/exercise-demo-player";
import { WorkoutDayPreview } from "@/src/components/workout-day-preview";
import { ExercisePicker } from "@/src/components/exercise-picker";
import { SaveToast } from "@/src/components/save-toast";
import { youtubePoster } from "@/src/lib/video-embed";
import { workoutStillUrl } from "@/src/lib/workout-exercise-media";
import { useCatalogMedia } from "@/src/lib/use-catalog-media";
import { useCoach, useCoachPage } from "@/src/lib/coach/context";
import {
  DumbbellDoodle,
  MiniChart,
  RunnerDoodle,
  Scribble,
} from "@/src/components/doodles";
import { exerciseMediaProvider } from "@/src/lib/exercise-media";
import { AnatomeMuscleImpact } from "@/src/components/anatome-muscle-impact";
import { AreaChart, DonutChart, VolumeBars, WeekActivity } from "@/src/components/training-charts";
import { AnatomeExerciseMuscleThumb, AnatomeExerciseMuscles } from "@/src/components/anatome-exercise-muscles";
import { anatomeResolveExercise } from "@/src/lib/anatome";
import { fetchExercise, fetchExercises } from "@/src/lib/exercises-client";
import { useTheme } from "@/src/lib/theme";
import { PageIntro, SectionTitle } from "@/src/components/ui";
import { ConfirmDialog } from "@/src/components/confirm-dialog";
import { MuscleFocusSelect } from "@/src/components/muscle-focus-select";
import { FocusMuscleMap } from "@/src/components/focus-muscle-map";
import { parseFocusMuscles } from "@/src/lib/focus-muscles";
import { useOnlineStatus } from "@/src/lib/offline";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function sessionsForWorkout(
  workout: StoredWorkout,
  saved: ActiveSessionProgress | null,
  defaultRest: number,
): ExerciseSession[] {
  return workout.exercises.map((item) => {
    const existing = saved?.exerciseSessions.find((session) => session.workoutExerciseId === item.id);
    if (existing?.sets.length) return existing;
    return {
      id: existing?.id ?? crypto.randomUUID(),
      workoutExerciseId: item.id,
      sets: defaultSets(3, item.restSeconds || defaultRest),
    };
  });
}

function withCurrentSets(sessions: ExerciseSession[], index: number, currentSets: SetLog[]) {
  return sessions.map((session, sessionIndex) =>
    sessionIndex === index ? { ...session, sets: currentSets } : session,
  );
}

function AutosaveTextInput({
  label,
  value,
  type = "text",
  onCommit,
}: {
  label: string;
  value: string;
  type?: "text" | "number";
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const commit = useDebouncedCallback((next: string) => onCommit(next), 1000);

  return (
    <label>
      {label}
      <input
        type={type}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          commit(next);
        }}
        onBlur={() => commit.flush()}
      />
    </label>
  );
}

function AutosaveExerciseFields({
  exercise,
  onCommit,
}: {
  exercise: WorkoutExercise;
  onCommit: (patch: { prescription: string; restSeconds: number; videoUrl: string }) => void;
}) {
  const { videoUrlForExercise } = useUserData();
  const remembered = videoUrlForExercise(exercise.exerciseId, exercise.name) ?? "";
  const [prescription, setPrescription] = useState(exercise.prescription);
  const [restSeconds, setRestSeconds] = useState(String(exercise.restSeconds));
  const [videoUrl, setVideoUrl] = useState(exercise.videoUrl ?? remembered);
  const [videoTouched, setVideoTouched] = useState(false);
  const commit = useDebouncedCallback((patch: { prescription: string; restSeconds: number; videoUrl: string }) => onCommit(patch), 1000);

  useEffect(() => {
    setPrescription(exercise.prescription);
    setRestSeconds(String(exercise.restSeconds));
    setVideoTouched(false);
    setVideoUrl(exercise.videoUrl || videoUrlForExercise(exercise.exerciseId, exercise.name) || "");
  }, [exercise.id]);

  useEffect(() => {
    if (videoTouched || exercise.videoUrl?.trim()) return;
    if (remembered && !videoUrl.trim()) setVideoUrl(remembered);
  }, [exercise.videoUrl, remembered, videoTouched, videoUrl]);

  return (
    <div className="builder-exercise-meta">
      <label>
        Sets / reps
        <input
          value={prescription}
          onChange={(event) => {
            const next = event.target.value;
            setPrescription(next);
            commit({ prescription: next, restSeconds: Number(restSeconds) || 0, videoUrl });
          }}
          onBlur={() => commit.flush()}
        />
      </label>
      <label>
        Rest
        <input
          type="number"
          value={restSeconds}
          onChange={(event) => {
            const next = event.target.value;
            setRestSeconds(next);
            commit({ prescription, restSeconds: Number(next) || 0, videoUrl });
          }}
          onBlur={() => commit.flush()}
        />
      </label>
      <label className="builder-video-field">
        YouTube / video URL
        <input
          value={videoUrl}
          onChange={(event) => {
            const next = event.target.value;
            setVideoTouched(true);
            setVideoUrl(next);
            commit({ prescription, restSeconds: Number(restSeconds) || 0, videoUrl: next });
          }}
          onBlur={() => commit.flush()}
          placeholder="https://youtu.be/… loops in the workout"
        />
      </label>
    </div>
  );
}

function ExerciseProgressGraph({ values, latest }: { values: number[]; latest: number }) {
  return (
    <div className="exercise-progress">
      {values.length > 0 ? (
        <>
          <div className="exercise-progress-chart"><MiniChart values={values} /></div>
          <span>{formatLoad(latest)}</span>
        </>
      ) : (
        <em>Log a set to start this graph</em>
      )}
    </div>
  );
}

export function Dashboard({ onStart }: { onStart: () => void }) {
  const { profile, todaysWorkout, sessions, records, workouts, activeSession } = useUserData();
  const [mapView, setMapView] = useState<"front" | "back" | "dual">("front");
  const training = loggedSessions(sessions, activeSession);
  const week = weeklyStats(training);
  const volumeSeries = weeklyVolumeSeries(training, 8);
  const setsSeries = weeklySetsSeries(training, 8);
  const durationSeries = weeklyDurationSeries(training, 8);
  const weekdayCounts = weekdaySessionCounts(training);
  const streak = currentStreak(training);
  const lifts = exerciseStats(training, workouts).slice(0, 4);
  const muscleSplit = setsByMuscle(training, workouts);
  const plannedSplit = plannedSetsByMuscle(todaysWorkout);
  const loadSplit = setsByLoadKind(training);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const weekSoFar = weekdayCounts.slice(0, todayIndex + 1);
  const consistencySplit = [
    { label: "Trained", value: weekSoFar.filter((point) => point.value > 0).length },
    { label: "Rest", value: weekSoFar.filter((point) => point.value === 0).length },
  ].filter((item) => item.value > 0);
  const allRecords = mergeRecords(records, recordsFromTraining(training, workouts));
  const latestRecord = allRecords[0];
  const latestRecordValue = latestRecord ? formatLoggedValue(latestRecord.value) : "";
  const name = greetingName(profile?.displayName ?? "there");
  const activeWorkout = todaysWorkout;
  const thisWeekVolume = volumeSeries.at(-1)?.value ?? 0;
  const lastWeekVolume = volumeSeries.at(-2)?.value ?? 0;
  const volumeDelta = lastWeekVolume > 0 ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100) : null;
  const recent = training.slice(0, 4);
  const todayDone = workoutCompletedToday(training, activeWorkout);
  useCoachPage({
    currentPage: "dashboard",
    currentWorkout: activeWorkout ? { id: activeWorkout.id, name: activeWorkout.name, focus: activeWorkout.focus } : null,
  });

  if (!activeWorkout && training.length === 0) {
    return (
      <div className="dashboard">
        <section className="greeting reveal">
          <div>
            <span className="eyebrow">{todayLabel()}</span>
            <h1>Welcome, {name}.</h1>
            <p>Create your first workout to start training with Forge.</p>
          </div>
        </section>
        <div className="empty-state reveal delay-1">
          <DumbbellDoodle />
          <h3>No active workout yet</h3>
          <p>Build a session from the exercise catalog—nothing is pre-loaded for you.</p>
          <Link className="primary-button" href="/workouts"><Plus size={17} /> Create workout</Link>
        </div>
      </div>
    );
  }

  const exerciseNames = activeWorkout?.exercises.map((e) => e.name) ?? [];
  const firstName = activeWorkout?.name.split(" ").slice(0, -1).join(" ") || activeWorkout?.name || "Train";
  const lastName = activeWorkout?.name.split(" ").slice(-1)[0] ?? "";

  return (
    <div className="dashboard">
      <section className="greeting reveal">
        <div>
          <span className="eyebrow">{todayLabel()}</span>
          <h1>Welcome back, {name}.</h1>
          <p>
            {activeWorkout
              ? todayDone
                ? `You finished ${activeWorkout.name} today.`
                : (activeWorkout.exercises.length > 0 ? `Ready for ${activeWorkout.name}.` : "Add exercises to your active workout.")
              : "No session is scheduled today — your recent training is below."}
          </p>
          <ContextualAiActions
            actions={[
              { label: "Explain my progress", prompt: "Explain my progress using my actual training data." },
              { label: "What should I train today?", prompt: "What should I train today based on my recent volume and current workout?" },
            ]}
          />
        </div>
        <div className="readiness">
          <span>{streak > 0 ? "Streak" : "This week"}</span>
          <strong>{streak > 0 ? streak : week.sessions}</strong>
          <small>{streak > 0 ? "day streak" : "sessions logged"}</small>
        </div>
      </section>

      {activeWorkout && (
        <section className="dashboard-grid">
          <article className="workout-hero reveal delay-1">
            <div className="hero-copy">
              <span className={`paper-tag ${todayDone ? "is-complete" : ""}`}>
                {todayDone ? <Check size={14} /> : <Zap size={14} fill="currentColor" />}
                {todayDone ? "Completed today" : "Active workout"}
              </span>
              <h2>{firstName} {lastName !== firstName ? <em>{lastName}</em> : null}</h2>
              <p>{activeWorkout.focus || "Your session"}</p>
              <div className="hero-meta">
                <span><Dumbbell size={17} /> {activeWorkout.exercises.length} exercises</span>
                <span><Clock3 size={17} /> ~{activeWorkout.duration} min</span>
              </div>
              {todayDone ? (
                <Link className="primary-button dark-button is-complete" href="/history">
                  <Check size={17} /> Completed
                </Link>
              ) : (
                <button
                  className="primary-button dark-button"
                  type="button"
                  onClick={onStart}
                  disabled={activeWorkout.exercises.length === 0}
                >
                  <Play size={17} fill="currentColor" /> Start workout <ArrowRight size={17} />
                </button>
              )}
            </div>
            <DumbbellDoodle className="hero-dumbbell float-doodle" />
            <div className="hero-noise" />
          </article>

          <article className="week-card reveal delay-2">
            <div className="card-topline">
              <div>
                <span className="eyebrow">This week</span>
                <h3>{week.sessions} session{week.sessions === 1 ? "" : "s"}</h3>
              </div>
              {volumeDelta !== null && (
                <small className={`week-delta ${volumeDelta >= 0 ? "up" : "down"}`}>
                  {volumeDelta >= 0 ? "+" : ""}{volumeDelta}% vs last week
                </small>
              )}
            </div>
            <WeekActivity points={weekdayCounts} />
            <div className="week-footer">
              <span>{week.sets} sets</span>
              <span>{formatVolume(week.volume)} kg</span>
              <span>{formatDuration(week.trainingSeconds)}</span>
            </div>
          </article>
        </section>
      )}

      <section className="stats-strip reveal delay-2" aria-label="Training statistics">
        {[
          { label: "Sessions", value: String(week.sessions).padStart(2, "0"), detail: "this week", icon: Dumbbell },
          { label: "Volume", value: formatVolume(week.volume), detail: "kilograms", icon: BarChart3 },
          { label: "Training", value: formatDuration(week.trainingSeconds), detail: "focused time", icon: Timer },
          { label: "Sets", value: String(week.sets), detail: "completed", icon: Flame },
        ].map(({ label, value, detail, icon: Icon }) => (
          <article key={label}>
            <Icon size={20} />
            <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
          </article>
        ))}
      </section>

      <section className="dash-charts">
        <article className="paper-panel reveal">
          <SectionTitle
            eyebrow="Load"
            title="Weekly volume"
            action={<Link className="text-button" href="/analytics">Full analytics <ArrowUpRight size={15} /></Link>}
          />
          {training.length > 0 ? (
            <AreaChart points={volumeSeries} />
          ) : (
            <p className="chart-empty">Log a session to see volume over the last 8 weeks.</p>
          )}
        </article>
        <article className="paper-panel reveal delay-1">
          <SectionTitle eyebrow="Top lifts" title="Best recent loads" />
          {lifts.length > 0 ? (
            <div className="dash-lifts">
              {lifts.map((lift) => {
                const trend = exerciseWeightTrend(training, workouts, lift.exerciseId);
                return (
                  <div key={lift.exerciseId} className="dash-lift">
                    <div>
                      <strong>{lift.name}</strong>
                      <small>{lift.sets} sets · {formatVolume(lift.volume)} kg</small>
                    </div>
                    <div className="dash-lift-chart">
                      <MiniChart values={trend.values} />
                    </div>
                    <span>{formatLoad(lift.bestWeight)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="chart-empty">Your heaviest lifts show up here after you log sets.</p>
          )}
        </article>
      </section>

      <section className="dash-mix">
        <article className="paper-panel reveal">
          <SectionTitle eyebrow="Split" title={muscleSplit.length ? "Sets by muscle" : "Planned muscles"} />
          {(muscleSplit.length ? muscleSplit : plannedSplit).length > 0 ? (
            <DonutChart points={muscleSplit.length ? muscleSplit : plannedSplit} unit="sets" />
          ) : (
            <p className="chart-empty">Log sets to see how work is split across muscles.</p>
          )}
        </article>
        <article className="paper-panel reveal delay-1">
          <SectionTitle eyebrow="Style" title="Weighted vs bodyweight" />
          {loadSplit.length > 0 ? (
            <DonutChart points={loadSplit} unit="sets" />
          ) : (
            <p className="chart-empty">Weighted and bodyweight sets show up here.</p>
          )}
        </article>
        <article className="paper-panel reveal delay-2">
          <SectionTitle eyebrow="Density" title="Sets per week" />
          {training.length > 0 ? (
            <VolumeBars points={setsSeries} color="var(--orange)" />
          ) : (
            <p className="chart-empty">Weekly set counts land here after you train.</p>
          )}
        </article>
      </section>

      <section className="dash-charts dash-duration">
        <article className="paper-panel reveal">
          <SectionTitle eyebrow="Time" title="Minutes trained" />
          {training.length > 0 ? (
            <AreaChart points={durationSeries} color="var(--blue)" unit="min" />
          ) : (
            <p className="chart-empty">Session duration builds this curve.</p>
          )}
        </article>
        <article className="paper-panel reveal delay-1">
          <SectionTitle eyebrow="Rhythm" title="Week consistency" />
          {consistencySplit.length > 0 ? (
            <DonutChart points={consistencySplit} unit="days" />
          ) : (
            <p className="chart-empty">Train this week to fill the consistency ring.</p>
          )}
        </article>
      </section>

      <section className="lower-grid">
        {exerciseNames.length > 0 && (
          <article className="muscle-card dash-muscle-card reveal">
            <SectionTitle
              eyebrow="Muscle map"
              title="Planned impact"
              action={<Link className="text-button" href="/muscles">Explore map <ArrowUpRight size={15} /></Link>}
            />
            <div className="view-toggle compact-toggle dash-map-toggle">
              <button type="button" className={mapView === "front" ? "active" : ""} onClick={() => setMapView("front")}>Front</button>
              <button type="button" className={mapView === "back" ? "active" : ""} onClick={() => setMapView("back")}>Back</button>
              <button type="button" className={mapView === "dual" ? "active" : ""} onClick={() => setMapView("dual")}>Both</button>
            </div>
            <div className="muscle-content">
              <AnatomeMuscleImpact exerciseNames={exerciseNames} view={mapView} gender="male" />
            </div>
          </article>
        )}

        {latestRecord && (
          <article className="pr-card reveal delay-1">
            <div className="pr-burst"><Sparkles size={20} /></div>
            <span className="eyebrow">Recent PR</span>
            <h3>{latestRecord.exercise}</h3>
            <strong className="pr-number">
              {latestRecordValue.startsWith("Bodyweight")
                ? latestRecordValue.replace(/^Bodyweight/, "BW")
                : (latestRecordValue.split(" ")[0] ?? latestRecordValue)}
            </strong>
            <p>{latestRecordValue}</p>
            <Link className="text-button" href="/records">All records <ChevronRight size={15} /></Link>
          </article>
        )}
      </section>

      {recent.length > 0 && (
        <section className="paper-panel dash-recent reveal">
          <SectionTitle eyebrow="Journal" title="Recent sessions" action={<Link className="text-button" href="/history">History <ArrowUpRight size={15} /></Link>} />
          <div className="dash-recent-list">
            {recent.map((session) => (
              <Link className="dash-recent-row" href="/history" key={session.id}>
                <span>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(sessionDate(session)))}</span>
                <strong>{session.workoutName}</strong>
                <small>{sessionSetCount(session)} sets · {formatVolume(sessionVolume(session))} kg · {formatDuration(session.durationSeconds)}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activeWorkout && activeWorkout.exercises.length > 0 && (
        <section className="today-list reveal">
          <SectionTitle eyebrow={todayDone ? "Completed" : "On deck"} title={activeWorkout.name} action={<Link className="outline-button" href="/workouts">Edit workout <PencilLine size={15} /></Link>} />
          <div className="exercise-rows">
            {activeWorkout.exercises.slice(0, 5).map((exercise, index) => (
              <div className="exercise-row" key={exercise.id}>
                <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="exercise-icon"><Dumbbell size={20} /></span>
                <span className="exercise-name"><strong>{exercise.name}</strong><small>{exercise.target} · {exercise.secondary[0] ?? "—"}</small></span>
                <span className="prescription">{exercise.prescription}</span>
                <span className="rest"><Timer size={14} /> {exercise.restSeconds}s</span>
              </div>
            ))}
          </div>
          {todayDone ? (
            <Link className="primary-button workout-start-mobile is-complete" href="/history">
              <Check size={17} /> Completed
            </Link>
          ) : (
            <button className="primary-button workout-start-mobile" type="button" onClick={onStart}>
              <Play size={17} fill="currentColor" /> Start {activeWorkout.name}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

export function WorkoutsPage({ onStart }: { onStart: () => void }) {
  const {
    workouts,
    activeWorkout,
    saveWorkout,
    patchWorkout,
    trashWorkout,
    activateWorkout,
    duplicateWorkout,
    profile,
    addExerciseFromCatalog,
    saveVideoUrl,
    videoUrlForExercise,
    sessions,
    activeSession,
    trashedWorkouts,
  } = useUserData();
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [altForId, setAltForId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("w");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pendingTrash, setPendingTrash] = useState<{ id: string; name: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const selected = workouts.find((w) => w.id === (selectedId ?? requestedId ?? activeWorkout?.id)) ?? activeWorkout ?? workouts[0] ?? null;
  const catalogMedia = useCatalogMedia(selected?.exercises ?? []);
  const training = loggedSessions(sessions, activeSession);
  const coach = useCoach();
  useCoachPage({
    currentPage: "workouts",
    currentWorkout: selected ? { id: selected.id, name: selected.name, focus: selected.focus } : null,
  });

  async function markSaved(task: Promise<void>) {
    setSaveStatus("saving");
    await task;
    setSaveStatus("saved");
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const workout = await saveWorkout({
      name: name.trim(),
      focus: focus.trim() || "Custom session",
      duration: 45,
      exercises: [],
    });
    setSelectedId(workout.id);
    setCreating(false);
    setName("");
    setFocus("");
  }

  async function updateExercises(next: StoredWorkout["exercises"]) {
    if (!selected) return;
    await markSaved(patchWorkout(selected.id, { exercises: next }));
  }

  async function removeExercise(exerciseId: string) {
    if (!selected) return;
    await updateExercises(selected.exercises.filter((item) => item.id !== exerciseId));
  }

  async function moveExercise(index: number, direction: -1 | 1) {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.exercises.length) return;
    const next = [...selected.exercises];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    await updateExercises(next);
  }

  async function dropExercise(toIndex: number) {
    if (!selected || dragIndex === null || dragIndex === toIndex) return;
    const next = [...selected.exercises];
    const [item] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, item);
    setDragIndex(null);
    await updateExercises(next);
  }

  async function startSelected() {
    if (!selected || selected.exercises.length === 0) return;
    if (!selected.active) await activateWorkout(selected.id);
    onStart();
  }

  return (
    <div>
      <PageIntro
        eyebrow="Workout builder"
        title="Build the work."
        copy="Create as many sessions as you need, reorder exercises, then add them to a program."
        action={
          <div className="page-actions">
            <button className="outline-button" type="button" onClick={() => setCreating(true)}><Plus size={17} /> New workout</button>
            <Link className="outline-button" href="/trash">
              <Trash2 size={17} /> Trash{trashedWorkouts.length > 0 ? ` (${trashedWorkouts.length})` : ""}
            </Link>
            <button
              className="outline-button"
              type="button"
              onClick={() => void coach?.ask("Create a workout for me. Infer from my profile and history when you can. Ask only if you still need equipment, duration, or target muscles.")}
            >
              <Sparkles size={17} /> Create Workout with AI
            </button>
            {selected && selected.exercises.length > 0 && (
              <>
                <button className="outline-button" type="button" onClick={() => setPreviewIndex(0)}>
                  <Eye size={17} /> View day
                </button>
                <button className="primary-button" onClick={startSelected}><Play size={17} fill="currentColor" /> Start {selected.name}</button>
              </>
            )}
          </div>
        }
      />

      {creating && (
        <form className="paper-panel workout-create-form reveal" onSubmit={handleCreate}>
          <h3>New workout</h3>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push A" required /></label>
          <MuscleFocusSelect value={focus} onChange={setFocus} />
          <div className="form-actions">
            <button type="button" className="outline-button" onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" className="primary-button">Create workout</button>
          </div>
        </form>
      )}

      {workouts.length === 0 && !creating && (
        <div className="empty-state reveal delay-1">
          <DumbbellDoodle />
          <h3>Create your first workout</h3>
          <p>Name it, set a focus, then add movements from the catalog or a custom exercise.</p>
          <button className="primary-button" type="button" onClick={() => setCreating(true)}><Plus size={17} /> New workout</button>
        </div>
      )}

      {workouts.length > 0 && (
        <div className="workout-tabs reveal delay-1">
          {workouts.map((workout) => (
            <button
              key={workout.id}
              type="button"
              className={selected?.id === workout.id ? "active" : ""}
              onClick={() => setSelectedId(workout.id)}
            >
              {workout.name}{workout.active ? " · active" : ""}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="builder-grid">
          <section className="builder-main paper-panel reveal delay-1">
            <div className="builder-title">
              <div><span className="status-dot" /> {selected.active ? "Active workout" : "Saved workout"}</div>
              <div className="builder-title-actions">
                {!selected.active && (
                  <button className="outline-button" type="button" onClick={() => activateWorkout(selected.id)}>Set active</button>
                )}
                <button className="outline-button" type="button" onClick={() => duplicateWorkout(selected.id)}><Copy size={15} /> Duplicate</button>
                <button className="danger-text" type="button" onClick={() => setPendingTrash({ id: selected.id, name: selected.name })}><Trash2 size={16} /> Delete</button>
              </div>
            </div>
            <div className="workout-name-row">
              <div className="workout-edit-fields">
                <AutosaveTextInput
                  key={`${selected.id}-name`}
                  label="Name"
                  value={selected.name}
                  onCommit={(value) => void markSaved(patchWorkout(selected.id, { name: value }))}
                />
                <MuscleFocusSelect
                  key={`${selected.id}-focus`}
                  value={selected.focus}
                  showMap={false}
                  onChange={(value) => void markSaved(patchWorkout(selected.id, { focus: value }))}
                />
              </div>
              <div className="builder-stats">
                <span><strong>{selected.exercises.length}</strong> exercises</span>
                <span><strong>{selected.duration}</strong> min</span>
              </div>
            </div>
            <div className="builder-exercises">
              {selected.exercises.length === 0 && (
                <div className="empty-inline"><p>No exercises yet. Add from the catalog or create a custom one.</p></div>
              )}
              {selected.exercises.map((exercise, index) => {
                const thumb = workoutStillUrl(exercise, catalogMedia[exercise.exerciseId]) || youtubePoster(exercise.videoUrl || videoUrlForExercise(exercise.exerciseId, exercise.name) || "");
                return (
                <article
                  key={exercise.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropExercise(index)}
                  className={`${exercise.supersetId ? "superset" : ""} ${dragIndex === index ? "dragging" : ""}`}
                >
                  <GripVertical className="drag-handle" size={20} />
                  <span className="builder-exercise-thumb">
                    {thumb ? (
                      <ExerciseStill src={thumb} alt="" width={72} height={72} />
                    ) : (
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    )}
                  </span>
                  <div className="builder-exercise-info">
                    <strong>{exercise.name}</strong>
                    <small>{exercise.target} · {exercise.secondary[0] ?? "—"}</small>
                    <AutosaveExerciseFields
                      key={exercise.id}
                      exercise={exercise}
                      onCommit={(patch) => {
                        void updateExercises(selected.exercises.map((item) =>
                          item.id === exercise.id ? { ...item, ...patch } : item,
                        ));
                        const url = patch.videoUrl.trim();
                        if (url) void saveVideoUrl(exercise.exerciseId, url);
                      }}
                    />
                    {exercise.alternatives && exercise.alternatives.length > 0 && (
                      <small>Alts: {exercise.alternatives.map((alt) => alt.name).join(" · ")}</small>
                    )}
                  </div>
                  <div className="builder-exercise-actions">
                    <div className="reorder-buttons">
                      <button type="button" className="icon-button" aria-label="Move up" disabled={index === 0} onClick={() => moveExercise(index, -1)}><ChevronUp size={16} /></button>
                      <button type="button" className="icon-button" aria-label="Move down" disabled={index === selected.exercises.length - 1} onClick={() => moveExercise(index, 1)}><ChevronDown size={16} /></button>
                    </div>
                    <button
                      type="button"
                      className="outline-button view-day-button"
                      onClick={() => setPreviewIndex(index)}
                    >
                      <Eye size={15} /> View
                    </button>
                    <button
                      type="button"
                      className="outline-button alt-button"
                      disabled={(exercise.alternatives?.length ?? 0) >= 2}
                      onClick={() => setAltForId(exercise.id)}
                    >
                      Alt {(exercise.alternatives?.length ?? 0)}/2
                    </button>
                    <button type="button" className="icon-button" aria-label={`Remove ${exercise.name}`} onClick={() => setPendingRemove({ id: exercise.id, name: exercise.name })}><Trash2 size={17} /></button>
                  </div>
                </article>
                );
              })}
            </div>
            <button className="add-exercise-button" type="button" onClick={() => setPickerOpen(true)}>
              <Plus size={20} /> Add exercises
            </button>
            {selected.exercises.length > 0 && (
              <ContextualAiActions
                actions={[
                  { label: "Rate this workout", prompt: `Rate my current workout ${selected.name}. Use the actual exercise list and my weekly muscle volume.` },
                  { label: "Optimize workout", prompt: `Optimize ${selected.name} without making it generic. Suggest substitutions and wait for confirmation.` },
                  { label: "Add an exercise", prompt: `Suggest one exercise to add to ${selected.name} and wait for confirmation.` },
                  { label: "Reduce workout duration", prompt: `Shorten ${selected.name} while keeping the main stimulus. Wait for confirmation before changing it.` },
                ]}
              />
            )}
          </section>
          <aside className="builder-side reveal delay-2">
            <article className="paper-panel compact-panel">
              <h3>Focus map</h3>
              <FocusMuscleMap muscles={parseFocusMuscles(selected.focus)} />
            </article>
            <article className="paper-panel compact-panel workout-graphs">
              <h3>Exercise graphs</h3>
              {selected.exercises.length === 0 && <p>Add movements to see load over sessions.</p>}
              {selected.exercises.map((exercise) => {
                const trend = exerciseWeightTrend(training, workouts, exercise.exerciseId);
                return (
                  <div className="workout-graph-row" key={exercise.id}>
                    <strong>{exercise.name}</strong>
                    <ExerciseProgressGraph values={trend.values} latest={trend.latest} />
                  </div>
                );
              })}
            </article>
            <article className="paper-panel compact-panel">
              <h3>Session defaults</h3>
              <p>Default rest: {profile?.defaultRest ?? 90} sec</p>
              <Link className="text-button" href="/settings">Change in settings</Link>
            </article>
          </aside>
        </div>
      )}

      {pickerOpen && selected && (
        <ExercisePicker
          stayOpen
          added={selected.exercises.map((item) => ({ id: item.exerciseId, name: item.name }))}
          onClose={() => setPickerOpen(false)}
          onSelect={(exercise) => addExerciseFromCatalog(selected.id, exercise, profile?.defaultRest ?? 90)}
        />
      )}

      {altForId && selected && (() => {
        const altExercise = selected.exercises.find((item) => item.id === altForId);
        if (!altExercise) return null;
        return (
        <ExercisePicker
          title="Add an alternative"
          suggestFor={{
            exerciseId: altExercise.exerciseId,
            name: altExercise.name,
            target: altExercise.target,
            secondary: altExercise.secondary,
          }}
          excludeIds={[
            altExercise.exerciseId,
            ...(altExercise.alternatives ?? []).map((alt) => alt.exerciseId),
          ]}
          onClose={() => setAltForId(null)}
          onSelect={async (exercise) => {
            const current = selected.exercises.find((item) => item.id === altForId);
            if (!current || (current.alternatives?.length ?? 0) >= 2) return;
            const already = new Set([current.exerciseId, ...(current.alternatives ?? []).map((alt) => alt.exerciseId)]);
            if (already.has(exercise.id)) return;
            await updateExercises(selected.exercises.map((item) => (
              item.id === altForId
                ? {
                    ...item,
                    alternatives: [
                      ...(item.alternatives ?? []),
                      workoutAlternativeFromCatalog(exercise, videoUrlForExercise(exercise.id, exercise.name)),
                    ].slice(0, 2),
                  }
                : item
            )));
            setAltForId(null);
          }}
        />
        );
      })()}
      {previewIndex !== null && selected && selected.exercises.length > 0 && (
        <WorkoutDayPreview
          workoutName={selected.name}
          focus={selected.focus}
          exercises={selected.exercises}
          startIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onSaveVideo={(exerciseId, url) => {
            if (url) void saveVideoUrl(exerciseId, url);
          }}
          onUpdateExercise={async (workoutExerciseId, patch) => {
            await markSaved(patchWorkout(selected.id, {
              exercises: selected.exercises.map((item) => (
                item.id === workoutExerciseId ? { ...item, ...patch } : item
              )),
            }));
          }}
        />
      )}
      {pendingTrash && (
        <ConfirmDialog
          title={`Move ${pendingTrash.name} to trash?`}
          copy="You can restore it from Trash. Logged sessions stay in History."
          confirmLabel="Move to trash"
          busy={confirmBusy}
          onCancel={() => setPendingTrash(null)}
          onConfirm={async () => {
            setConfirmBusy(true);
            try {
              await trashWorkout(pendingTrash.id);
              setSelectedId(null);
              setPendingTrash(null);
            } finally {
              setConfirmBusy(false);
            }
          }}
        />
      )}
      {pendingRemove && (
        <ConfirmDialog
          title={`Remove ${pendingRemove.name}?`}
          copy="This takes the exercise out of this workout. You can add it back from the catalog."
          confirmLabel="Remove"
          busy={confirmBusy}
          onCancel={() => setPendingRemove(null)}
          onConfirm={async () => {
            setConfirmBusy(true);
            try {
              await removeExercise(pendingRemove.id);
              setPendingRemove(null);
            } finally {
              setConfirmBusy(false);
            }
          }}
        />
      )}
      <SaveToast status={saveStatus} />
    </div>
  );
}

export function ExercisesPage() {
  const router = useRouter();
  const { customExercises, addExerciseToCatalog } = useUserData();
  useCoachPage({ currentPage: "exercises" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1324);
  const [items, setItems] = useState<Exercise[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const filters = ["All", "Chest", "Back", "Shoulders", "Legs", "Arms"];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchExercises({ q: query, group: filter, page, limit: 24 })
        .then((data) => {
          setItems(data.items);
          setTotal(data.total);
          setStatus("ready");
        })
        .catch(() => setStatus("error"));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query, filter, page]);

  return (
    <div>
      <PageIntro
        eyebrow={`${total.toLocaleString()} movements`}
        title="Know your movement."
        copy="The full exercises.json catalog, with dataset GIFs loaded from the exercise media files."
        action={<button className="outline-button" onClick={() => setCreating(true)}><Plus size={17} /> Custom exercise</button>}
      />
      <div className="catalog-toolbar reveal delay-1">
        <label className="catalog-search"><Search size={19} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search bench, squat, biceps…" /><kbd>⌘ K</kbd></label>
        <button className="filter-button"><ListFilter size={18} /> Filters <span>{filter === "All" ? 0 : 1}</span></button>
      </div>
      <div className="filter-pills reveal delay-1">
        {filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => { setFilter(item); setPage(1); }}>{item}</button>)}
      </div>
      <section className="catalog-section reveal delay-2">
        <div className="catalog-note"><span><Sparkles size={16} /> Dataset GIFs from exercises.json</span><small>© Gym visual · 180×180 animation media</small></div>
        <div className="exercise-grid">
          {customExercises
            .filter((exercise) => !query || exercise.name.toLowerCase().includes(query.toLowerCase()))
            .map((exercise, index) => (
              <ExerciseCard key={exercise.id} exercise={exercise} index={index} onSelect={(item) => router.push(`/exercises/${item.id}`)} />
            ))}
          {items.map((exercise, index) => (
            <ExerciseCard key={exercise.id} exercise={exercise} index={index} onSelect={(item) => router.push(`/exercises/${item.id}`)} />
          ))}
        </div>
        {creating && (
          <CustomExerciseForm
            onClose={() => setCreating(false)}
            onSave={async (input) => {
              const id = await addExerciseToCatalog(input);
              setCreating(false);
              router.push(`/exercises/${id}`);
            }}
          />
        )}
        {status === "loading" && items.length === 0 && <div className="empty-state"><h3>Loading catalog…</h3></div>}
        {status === "ready" && items.length === 0 && (
          <div className="empty-state"><DumbbellDoodle /><h3>No movement found.</h3><p>Try another muscle, equipment, or exercise name.</p><button className="outline-button" onClick={() => { setQuery(""); setFilter("All"); setPage(1); }}>Clear filters</button></div>
        )}
        {total > 24 && (
          <div className="catalog-pagination">
            <button className="outline-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <span>Page {page}</span>
            <button className="outline-button" disabled={page * 24 >= total} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}

function ExerciseCard({ exercise, index, onSelect }: { exercise: Exercise; index: number; onSelect: (exercise: Exercise) => void }) {
  const media = exerciseMediaProvider.resolve(exercise);
  const hasMedia = Boolean(media.src);
  return (
    <article className="exercise-card" style={{ animationDelay: `${index * 40}ms` }}>
      <button className="exercise-media" type="button" onClick={() => onSelect(exercise)} aria-label={`View ${exercise.name}`}>
        {hasMedia ? (
          <ExerciseStill className="exercise-gif" src={media.src} alt={`${exercise.name} demonstration`} width={360} height={270} />
        ) : (
          <span className="custom-media-fallback">Custom</span>
        )}
        <span className="media-play"><Play size={16} fill="currentColor" /></span>
        <small>{hasMedia ? (exercise.category === "custom" ? "Custom GIF" : "Dataset GIF") : "Custom"}</small>
      </button>
      <AnatomeExerciseMuscleThumb
        exerciseName={exercise.name}
        target={exercise.target}
        secondaryMuscles={exercise.secondary_muscles}
      />
      <div className="exercise-card-body">
        <span className="muscle-tag">{exercise.target}</span>
        <h3>{exercise.name}</h3>
        <p><strong>Target</strong> {exercise.target}</p>
        <p><strong>Also</strong> {exercise.secondary_muscles.join(" · ") || "Stabilizers"}</p>
        <div><span>{exercise.equipment}</span><button type="button" onClick={() => onSelect(exercise)} aria-label={`Open ${exercise.name}`}><ArrowUpRight size={17} /></button></div>
      </div>
    </article>
  );
}

export function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const { user } = useAuth();
  const { saveVideoUrl, videoUrlForExercise } = useUserData();
  const [showGif, setShowGif] = useState(true);
  const media = exerciseMediaProvider.resolve(exercise);
  const [anatomeVideoUrl, setAnatomeVideoUrl] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (user?.uid) {
      const remembered = videoUrlForExercise(exercise.id, exercise.name);
      getExerciseMedia(user.uid, exercise.id)
        .then((doc) => {
          if (cancelled) return;
          const saved = doc?.videoUrl?.trim() || remembered;
          if (saved) {
            setCustomVideoUrl(saved);
            setVideoInput(saved);
            setAnatomeVideoUrl(null);
            return;
          }
          return anatomeResolveExercise(exercise.name).then((result) => {
            if (!cancelled) setAnatomeVideoUrl(result.video_url ?? null);
          });
        })
        .catch(() => {
          if (!cancelled) setAnatomeVideoUrl(null);
        });
    } else {
      anatomeResolveExercise(exercise.name)
        .then((result) => {
          if (!cancelled) setAnatomeVideoUrl(result.video_url ?? null);
        })
        .catch(() => {
          if (!cancelled) setAnatomeVideoUrl(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.name, user?.uid, videoUrlForExercise]);

  const activeVideoUrl = customVideoUrl ?? exercise.videoUrl ?? videoUrlForExercise(exercise.id, exercise.name) ?? anatomeVideoUrl;
  useCoachPage({
    currentPage: "exercise",
    currentExercise: { id: exercise.id, name: exercise.name },
    hasFormVideo: Boolean(activeVideoUrl),
  });
  return (
    <div className="exercise-detail">
      <Link className="back-button" href="/exercises"><ArrowLeft size={17} /> Exercise library</Link>
      <section className="detail-hero reveal">
        <div className="detail-media">
          {media.src ? (
            <ExerciseStill
              src={showGif ? media.src : media.poster ?? media.src}
              alt={`${exercise.name} exercise demonstration`}
              width={640}
              height={520}
            />
          ) : (
            <div className="custom-media-fallback large">Custom exercise</div>
          )}
          <div className="media-tabs">
            <button className={showGif ? "active" : ""} onClick={() => setShowGif(true)}><Play size={14} /> {exercise.category === "custom" ? "GIF" : "Dataset GIF"}</button>
            <button className={!showGif ? "active" : ""} onClick={() => setShowGif(false)}><Camera size={14} /> Thumbnail</button>
          </div>
          <small>{exercise.attribution}</small>
          {exercise.category === "custom" && <CustomExerciseMediaEditor exercise={exercise} />}
        </div>
        <div className="detail-copy">
          <span className="paper-tag">{exercise.category}</span>
          <h1>{exercise.name}</h1>
          <p>{exercise.instructions.en}</p>
          <div className="detail-facts">
            <div><span>Target</span><strong>{exercise.target}</strong></div>
            <div><span>Secondary</span><strong>{exercise.secondary_muscles.join(", ") || "Stabilizers"}</strong></div>
            <div><span>Equipment</span><strong>{exercise.equipment}</strong></div>
          </div>
          <ContextualAiActions
            actions={[
              { label: "Analyze my progress", prompt: `How am I progressing on ${exercise.name}? Use my logged sets.` },
              { label: "Explain this exercise", prompt: `Explain ${exercise.name}: muscles, setup, and how it should feel. Use catalog data.` },
              { label: "Find alternatives", prompt: `Find alternatives to ${exercise.name} from the catalog.` },
              { label: "Improve my technique", prompt: `What technique mistakes should I avoid on ${exercise.name}? Do not claim you analyzed a video.` },
            ]}
          />
          <div className="detail-actions">
            <Link className="primary-button" href="/workouts"><Plus size={17} /> Add to workout</Link>
            <div className="video-url-editor">
              <label>
                <span className="sr-only">Form video URL</span>
                <input
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  placeholder="Paste YouTube URL"
                />
              </label>
              <button
                type="button"
                className="outline-button"
                onClick={async () => {
                  const next = videoInput.trim();
                  if (!next) return;
                  setSaving(true);
                  try {
                    await saveVideoUrl(exercise.id, next);
                    setCustomVideoUrl(next);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={!videoInput.trim() || saving}
              >
                <Video size={17} /> {saving ? "Saving…" : "Save URL"}
              </button>
            </div>
          </div>
          <p className="privacy-note"><ShieldCheck size={15} /> Your uploaded form videos stay private.</p>
          {activeVideoUrl && (
            <div className="video-preview">
              <small>Your form video · loops in workouts</small>
              <ExerciseDemoPlayer title={exercise.name} videoUrl={activeVideoUrl} label="Saved video" />
            </div>
          )}
        </div>
      </section>
      <section className="detail-grid">
        <article className="paper-panel">
          <SectionTitle
            eyebrow="Technique"
            title="How to perform"
            action={
              <ContextualAiActions
                actions={[
                  { label: "Ask AI about this exercise", prompt: `How should I perform ${exercise.name}? What mistakes should I avoid, and what should I feel?` },
                ]}
              />
            }
          />
          <ol className="instruction-list">
            {(exercise.instruction_steps.en ?? []).map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}
          </ol>
        </article>
        <article className="paper-panel history-snippet exercise-muscles-panel">
          <SectionTitle eyebrow="Muscles" title="Where it works" />
          <AnatomeExerciseMuscles
            exerciseName={exercise.name}
            target={exercise.target}
            secondaryMuscles={exercise.secondary_muscles}
          />
          <div><strong>Primary</strong><span>{exercise.target}</span></div>
          <div><strong>Secondary</strong><span>{exercise.secondary_muscles.join(" · ") || "None listed"}</span></div>
          <div><strong>Body part</strong><span>{exercise.body_part}</span></div>
        </article>
      </section>
    </div>
  );
}
export function ActiveWorkout({ onExit, onComplete }: { onExit: () => void; onComplete: () => void }) {
  const { todaysWorkout, activeWorkout, activeSession, activeSessionLoaded } = useUserData();
  const sessionWorkout = todaysWorkout ?? activeWorkout;

  if (!sessionWorkout || sessionWorkout.exercises.length === 0) {
    return (
      <div className="active-workout">
        <div className="empty-state">
          <DumbbellDoodle />
          <h3>No workout to start</h3>
          <p>Create a workout and add exercises before starting a session.</p>
          <Link className="primary-button" href="/workouts">Go to workouts</Link>
          <button className="outline-button" onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  if (!activeSessionLoaded) {
    return (
      <div className="active-workout">
        <div className="empty-state">
          <h3>Loading session…</h3>
          <p>Restoring any unsaved set progress.</p>
        </div>
      </div>
    );
  }

  const initialProgress = activeSession?.workoutId === sessionWorkout.id ? activeSession : null;
  return (
    <ActiveWorkoutSession
      key={sessionWorkout.id}
      workout={sessionWorkout}
      initialProgress={initialProgress}
      onExit={onExit}
      onComplete={onComplete}
    />
  );
}

function ActiveWorkoutSession({
  workout,
  initialProgress,
  onExit,
  onComplete,
}: {
  workout: StoredWorkout;
  initialProgress: ActiveSessionProgress | null;
  onExit: () => void;
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const { profile, completeSession, saveActiveSessionProgress, activeSessionPendingSync, syncing, customExercises, sessions, workouts, activeSession, videoUrlForExercise } = useUserData();
  const online = useOnlineStatus();
  const defaultRest = profile?.defaultRest ?? 90;
  const initialSessions = sessionsForWorkout(workout, initialProgress, defaultRest);
  const initialIndex = Math.min(initialProgress?.exerciseIndex ?? 0, Math.max(0, workout.exercises.length - 1));
  const [elapsed, setElapsed] = useState(initialProgress?.durationSeconds ?? 0);
  const [exerciseIndex, setExerciseIndex] = useState(initialIndex);
  const [exerciseSessions, setExerciseSessions] = useState<ExerciseSession[]>(initialSessions);
  const [sets, setSets] = useState<SetLog[]>(() =>
    initialSessions[initialIndex]?.sets?.length
      ? initialSessions[initialIndex].sets
      : defaultSets(3, workout.exercises[initialIndex]?.restSeconds || defaultRest),
  );
  const [rest, setRest] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [catalogExercise, setCatalogExercise] = useState<Exercise | null>(null);
  const [savedVideoUrl, setSavedVideoUrl] = useState<string | null>(null);
  const [anatomeVideoUrl, setAnatomeVideoUrl] = useState<string | null>(null);
  const [altSource, setAltSource] = useState<"primary" | number>("primary");
  const SKIP_REASONS = useMemo(
    () => [
      { value: "tired", label: "Tired" },
      { value: "burnout", label: "Burnout" },
      { value: "not_in_mood", label: "Not in mood" },
      { value: "time_constraint", label: "Time constraint" },
      { value: "other", label: "Other" },
    ],
    [],
  );
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [skipBusy, setSkipBusy] = useState(false);
  const [startedAt] = useState(() => initialProgress?.startedAt ?? new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const firstPersist = useRef(true);
  const elapsedRef = useRef(elapsed);
  const startedAtRef = useRef(startedAt);
  elapsedRef.current = elapsed;
  startedAtRef.current = startedAt;

  const exercise = workout.exercises[exerciseIndex];
  const alternatives = exercise?.alternatives ?? [];
  const viewed = useMemo(() => {
    if (altSource === "primary" || typeof altSource !== "number") {
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
    const alt = alternatives[altSource];
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
  }, [altSource, alternatives, exercise]);
  const viewingAlt = altSource !== "primary";
  const liveTrend = exerciseWeightTrend(loggedSessions(sessions, activeSession), workouts, exercise.exerciseId);
  useCoachPage({
    currentPage: "active_workout",
    currentWorkout: { id: workout.id, name: workout.name, focus: workout.focus },
    currentExercise: { id: exercise.exerciseId, name: exercise.name },
  });

  useEffect(() => {
    setAltSource("primary");
  }, [exerciseIndex]);

  useEffect(() => {
    let cancelled = false;
    const custom = customExercises.find((item) => item.id === viewed.exerciseId);
    if (custom) {
      setCatalogExercise(custom);
    } else {
      fetchExercise(viewed.exerciseId)
        .then((item) => {
          if (cancelled) return;
          if (item) {
            setCatalogExercise(item);
            return;
          }
          return fetchExercises({ q: viewed.name, limit: 1 }).then((data) => {
            if (!cancelled) setCatalogExercise(data.items[0] ?? null);
          });
        })
        .catch(() => {
          if (!cancelled) setCatalogExercise(null);
        });
    }

    if (!user?.uid) {
      setSavedVideoUrl(null);
      return () => {
        cancelled = true;
      };
    }

    getExerciseMedia(user.uid, viewed.exerciseId)
      .then((doc) => {
        if (!cancelled) setSavedVideoUrl(doc?.videoUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setSavedVideoUrl(null);
      });

    const knownVideo = viewed.videoUrl || videoUrlForExercise(viewed.exerciseId, viewed.name);
    if (!knownVideo) {
      anatomeResolveExercise(viewed.name)
        .then((result) => {
          if (!cancelled) setAnatomeVideoUrl(result.video_url ?? null);
        })
        .catch(() => {
          if (!cancelled) setAnatomeVideoUrl(null);
        });
    } else {
      setAnatomeVideoUrl(null);
    }

    return () => {
      cancelled = true;
    };
  }, [customExercises, user?.uid, videoUrlForExercise, viewed.exerciseId, viewed.name, viewed.videoUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (rest === null || paused || rest <= 0) return;
    const timer = window.setInterval(() => setRest((value) => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [rest, paused]);

  const persistSnapshot = useCallback(async (nextSessions: ExerciseSession[], index: number) => {
    const silent = firstPersist.current;
    if (!silent) setSaveStatus("saving");
    try {
      await saveActiveSessionProgress({
        workoutId: workout.id,
        workoutName: workout.name,
        focus: workout.focus,
        startedAt: startedAtRef.current,
        durationSeconds: elapsedRef.current,
        exerciseIndex: index,
        exerciseSessions: stampExerciseSessions(workout.exercises, nextSessions),
      });
      if (silent) {
        firstPersist.current = false;
        return;
      }
      setSaveStatus(typeof navigator !== "undefined" && navigator.onLine ? "saved" : "offline");
    } catch {
      firstPersist.current = false;
      if (!silent) setSaveStatus("idle");
    }
  }, [saveActiveSessionProgress, workout.focus, workout.id, workout.name]);

  const persistDebounced = useDebouncedCallback((sessions: ExerciseSession[], index: number) => {
    void persistSnapshot(sessions, index);
  }, 1000);

  useEffect(() => {
    void persistSnapshot(exerciseSessions, exerciseIndex);
    // Seed the draft once the logger mounts so End later / refresh can restore it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistSnapshot]);

  const applySets = (nextSets: SetLog[], immediate = false) => {
    const nextSessions = withCurrentSets(exerciseSessions, exerciseIndex, nextSets);
    setSets(nextSets);
    setExerciseSessions(nextSessions);
    if (immediate) {
      persistDebounced.cancel();
      void persistSnapshot(nextSessions, exerciseIndex);
      return;
    }
    persistDebounced(nextSessions, exerciseIndex);
  };

  const updateSet = (id: string, field: "weight" | "reps" | "rir", value: number) => {
    applySets(sets.map((set) => set.id === id ? { ...set, [field]: value } : set));
  };

  const toggleSet = (id: string) => {
    const nextCompleted = !sets.find((set) => set.id === id)?.completed;
    const nextSets = sets.map((set) => set.id === id ? { ...set, completed: nextCompleted ?? false } : set);
    applySets(nextSets, true);
    if (nextCompleted && profile?.autoStartRest !== false) {
      setRest(exercise.restSeconds || defaultRest);
      setPaused(false);
    }
  };

  const addSet = () => {
    const last = sets.at(-1);
    if (!last) return;
    applySets([
      ...sets,
      { ...last, id: crypto.randomUUID(), setNumber: sets.length + 1, completed: false },
    ], true);
  };

  const finishWorkout = async () => {
    persistDebounced.cancel();
    const pending: PendingSession = {
      workout,
      startedAt,
      durationSeconds: elapsed,
      exerciseSessions: stampExerciseSessions(
        workout.exercises,
        withCurrentSets(exerciseSessions, exerciseIndex, sets),
      ),
    };
    setSaving(true);
    try {
      await completeSession(pending);
      const tempSession = {
        id: "temp",
        workoutDayId: workout.id,
        workoutName: workout.name,
        focus: workout.focus,
        startedAt,
        completedAt: new Date().toISOString(),
        durationSeconds: elapsed,
        exerciseSessions: pending.exerciseSessions,
      };
      storeSessionSummary({
        workoutName: workout.name,
        focus: workout.focus,
        durationSeconds: elapsed,
        setCount: sessionSetCount(tempSession),
        volume: sessionVolume(tempSession),
        exerciseCount: workout.exercises.length,
        exerciseNames: workout.exercises.map((item) => item.name),
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const nextExercise = () => {
    persistDebounced.flush();
    const synced = withCurrentSets(exerciseSessions, exerciseIndex, sets);
    setExerciseSessions(synced);
    if (exerciseIndex >= workout.exercises.length - 1) {
      void finishWorkout();
      return;
    }
    const nextIndex = exerciseIndex + 1;
    const nextSession = synced[nextIndex];
    setExerciseIndex(nextIndex);
    setSets(
      nextSession?.sets?.length
        ? nextSession.sets
        : defaultSets(3, workout.exercises[nextIndex].restSeconds || defaultRest),
    );
    setRest(null);
    setAltSource("primary");
    void persistSnapshot(synced, nextIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const skipExercise = async (reason: string) => {
    setSkipBusy(true);
    try {
      persistDebounced.cancel();
      const skipSets = sets.map((set) => ({
        ...set,
        completed: false,
        weight: 0,
        reps: 0,
        rir: set.rir ?? 2,
        notes: undefined,
      }));
      const nextSessions = exerciseSessions.map((session, idx) => (
        idx === exerciseIndex
          ? { ...session, sets: skipSets, notes: `Skipped: ${reason}` }
          : session
      ));

      const nextIndex = exerciseIndex + 1;
      if (exerciseIndex >= workout.exercises.length - 1) {
        const pending: PendingSession = {
          workout,
          startedAt,
          durationSeconds: elapsed,
          exerciseSessions: stampExerciseSessions(workout.exercises, nextSessions),
        };
        setSaving(true);
        try {
          await completeSession(pending);
          const tempSession = {
            id: "temp",
            workoutDayId: workout.id,
            workoutName: workout.name,
            focus: workout.focus,
            startedAt,
            completedAt: new Date().toISOString(),
            durationSeconds: elapsed,
            exerciseSessions: pending.exerciseSessions,
          };
          storeSessionSummary({
            workoutName: workout.name,
            focus: workout.focus,
            durationSeconds: elapsed,
            setCount: sessionSetCount(tempSession),
            volume: sessionVolume(tempSession),
            exerciseCount: workout.exercises.length,
            exerciseNames: workout.exercises.map((item) => item.name),
          });
          onComplete();
        } finally {
          setSaving(false);
        }
        return;
      }

      const nextSession = nextSessions[nextIndex];
      setExerciseSessions(nextSessions);
      setExerciseIndex(nextIndex);
      setSets(
        nextSession?.sets?.length
          ? nextSession.sets
          : defaultSets(3, workout.exercises[nextIndex].restSeconds || defaultRest),
      );
      setRest(null);
      setAltSource("primary");
      await persistSnapshot(nextSessions, nextIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSkipOpen(false);
      setSkipReason(null);
      setSkipBusy(false);
    }
  };

  const previousExercise = () => {
    if (exerciseIndex <= 0) return;
    persistDebounced.flush();
    const synced = withCurrentSets(exerciseSessions, exerciseIndex, sets);
    setExerciseSessions(synced);
    const prevIndex = exerciseIndex - 1;
    const prevSession = synced[prevIndex];
    setExerciseIndex(prevIndex);
    setSets(
      prevSession?.sets?.length
        ? prevSession.sets
        : defaultSets(3, workout.exercises[prevIndex].restSeconds || defaultRest),
    );
    setRest(null);
    setAltSource("primary");
    void persistSnapshot(synced, prevIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const endLater = async () => {
    persistDebounced.flush();
    await persistSnapshot(withCurrentSets(exerciseSessions, exerciseIndex, sets), exerciseIndex);
    onExit();
  };

  return (
    <div className="active-workout">
      <header className="active-header">
        <button className="back-button" onClick={() => void endLater()}><X size={19} /> End later</button>
        <div>
          <span>{workout.name}</span>
          <strong>{formatTime(elapsed)}</strong>
        </div>
        <button className="icon-button"><MoreHorizontal size={20} /></button>
      </header>
      <div className="workout-progress">
        <div style={{ width: `${((exerciseIndex + 1) / workout.exercises.length) * 100}%` }} />
        <span>{exerciseIndex + 1} of {workout.exercises.length} exercises</span>
      </div>
      <main className="active-content">
        <section className="active-exercise-head">
          <div>
            <span className="eyebrow">
              Exercise {String(exerciseIndex + 1).padStart(2, "0")}
              {viewingAlt ? " · alternative" : ""}
            </span>
            <h1>{viewingAlt ? viewed.name : exercise.name}</h1>
            <p>
              {viewingAlt
                ? `Stand-in for ${exercise.name} · ${viewed.target}`
                : `${exercise.prescription} · ${exercise.target}`}
            </p>
            <ContextualAiActions
              actions={[
                { label: "Rate this workout", prompt: `Rate ${workout.name} using the actual exercise list.` },
                { label: "Ask AI about this exercise", prompt: `How should I perform ${exercise.name}, and what should I feel?` },
              ]}
            />
          </div>
        </section>
        <div className="preview-alts active-alts" role="tablist" aria-label="Exercise and alternatives">
          <button
            type="button"
            role="tab"
            className={altSource === "primary" ? "active" : ""}
            aria-selected={altSource === "primary"}
            onClick={() => setAltSource("primary")}
          >
            Main
          </button>
          {alternatives.map((alt, altIndex) => (
            <button
              key={`${alt.exerciseId}-${altIndex}`}
              type="button"
              role="tab"
              className={altSource === altIndex ? "active" : ""}
              aria-selected={altSource === altIndex}
              onClick={() => setAltSource(altIndex)}
            >
              Alt {altIndex + 1}
              <small>{alt.name}</small>
            </button>
          ))}
          {alternatives.length === 0 && (
            <span className="preview-no-alt">No alt</span>
          )}
        </div>
        <div className="active-grid">
          <aside className="active-media-card">
            <ExerciseDemoPlayer
              title={viewed.name}
              videoUrl={viewed.videoUrl || catalogExercise?.videoUrl || savedVideoUrl || videoUrlForExercise(viewed.exerciseId, viewed.name) || anatomeVideoUrl}
              gifUrl={workoutStillUrl(viewed) || viewed.gifUrl || catalogExercise?.gif_url}
              imageUrl={viewed.imageUrl || catalogExercise?.image}
            />
            <div className="target-row"><span><i className="primary-muscle" /> Primary<strong>{viewed.target}</strong></span><span><i className="secondary-muscle" /> Secondary<strong>{viewed.secondary[0] ?? "—"}</strong></span></div>
            <AnatomeExerciseMuscleThumb
              exerciseName={viewed.name}
              target={viewed.target}
              secondaryMuscles={viewed.secondary}
            />
            <Link className="text-button" href={`/exercises/${viewed.exerciseId}`}><Video size={16} /> Exercise details</Link>
            <small className="media-credit">{catalogExercise?.attribution ?? "Add a YouTube URL on this exercise to loop the exact demo."}</small>
          </aside>
          <section className="set-logger">
            <ExerciseProgressGraph values={liveTrend.values} latest={liveTrend.latest} />
            <div className="set-table">
              <div className="set-head"><span>Set</span><span>KG</span><span>Reps</span><span>RIR</span><span>Done</span></div>
              {sets.map((set) => (
                <div className={`set-row ${set.completed ? "completed" : ""}`} key={set.id}>
                  <span><b>{set.setNumber}</b><small>{set.kind}</small></span>
                  <label>
                    <span className="sr-only">Weight for set {set.setNumber}</span>
                    <input
                      type="number"
                      step="2.5"
                      min={0}
                      placeholder="BW"
                      value={set.weight > 0 ? String(set.weight) : ""}
                      onChange={(event) => updateSet(set.id, "weight", Number(event.target.value) || 0)}
                    />
                  </label>
                  <label><span className="sr-only">Reps for set {set.setNumber}</span><input type="number" value={set.reps || ""} onChange={(event) => updateSet(set.id, "reps", Number(event.target.value))} /></label>
                  <label><span className="sr-only">RIR for set {set.setNumber}</span><input type="number" value={set.rir} onChange={(event) => updateSet(set.id, "rir", Number(event.target.value))} /></label>
                  <button className="set-check" onClick={() => toggleSet(set.id)} aria-label={`${set.completed ? "Unmark" : "Complete"} set ${set.setNumber}`}><Check size={21} /></button>
                </div>
              ))}
            </div>
            <button className="add-set" onClick={addSet}><Plus size={18} /> Add set</button>
            <div className="workout-tools">
              <button onClick={() => setRest(exercise.restSeconds || defaultRest)}><Timer size={18} /> Rest timer</button>
              <button
                type="button"
                className="outline-button"
                onClick={() => setSkipOpen(true)}
                disabled={saving || skipBusy}
              >
                <SkipForward size={18} /> Skip exercise
              </button>
            </div>
            <div className="active-exercise-nav">
              <button
                type="button"
                className="outline-button"
                onClick={previousExercise}
                disabled={exerciseIndex === 0 || saving}
              >
                <ArrowLeft size={18} /> Previous
              </button>
              <button className="primary-button next-exercise" type="button" onClick={nextExercise} disabled={saving}>
                {exerciseIndex === workout.exercises.length - 1 ? (saving ? "Saving…" : "Finish workout") : "Next exercise"} <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      </main>
      {rest !== null && (
        <div className="rest-overlay" role="dialog" aria-modal="true" aria-label="Rest timer">
          <div className="rest-card">
            <button className="rest-close" onClick={() => setRest(null)} aria-label="Close timer"><X size={19} /></button>
            <span className="eyebrow">Rest · {exercise.name}</span>
            <div className="rest-ring" style={{ "--progress": `${(rest / (exercise.restSeconds || defaultRest)) * 360}deg` } as React.CSSProperties}>
              <div><strong>{formatTime(rest)}</strong><span>{paused ? "Paused" : rest === 0 ? "Ready" : "Breathe"}</span></div>
            </div>
            <DumbbellDoodle className="rest-doodle" />
            <div className="rest-actions">
              <button onClick={() => setPaused(!paused)}>{paused ? <Play size={18} /> : <Pause size={18} />} {paused ? "Resume" : "Pause"}</button>
              <button onClick={() => setRest((value) => (value ?? 0) + 30)}><Plus size={18} /> 30 sec</button>
              <button onClick={() => setRest(null)}><SkipForward size={18} /> Skip</button>
            </div>
          </div>
        </div>
      )}
      {skipOpen && (
        <div
          className="modal-layer"
          role="presentation"
          onClick={() => {
            if (!skipBusy) setSkipOpen(false);
          }}
        >
          <div
            className="confirm-card skip-card"
            role="dialog"
            aria-modal="true"
            aria-label="Skip exercise"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Skip this exercise?</h3>
            <p>Pick a reason so your training pattern stays honest.</p>
            <div className="skip-reasons">
              {SKIP_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`reason-chip${skipReason === r.value ? " active" : ""}`}
                  onClick={() => setSkipReason(r.value)}
                  disabled={skipBusy}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="outline-button" disabled={skipBusy} onClick={() => setSkipOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={!skipReason || skipBusy}
                onClick={() => void skipExercise(skipReason ?? "other")}
              >
                {skipBusy ? "Working…" : "Skip"}
              </button>
            </div>
          </div>
        </div>
      )}
      <SaveToast
        status={
          !online && saveStatus !== "idle"
            ? "offline"
            : (syncing || activeSessionPendingSync) && saveStatus === "saving"
              ? "syncing"
              : saveStatus
        }
      />
    </div>
  );
}

export function WorkoutSummary({ onDone }: { onDone: () => void }) {
  const summary = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("forge:last-session");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as {
        workoutName: string;
        focus: string;
        durationSeconds: number;
        setCount: number;
        volume: number;
        exerciseCount: number;
        exerciseNames: string[];
      };
    } catch {
      return null;
    }
  }, []);

  if (!summary) {
    return (
      <main className="summary-screen">
        <section className="summary-card reveal">
          <h1>Session saved.</h1>
          <p>Your workout was logged to Firebase.</p>
          <button className="primary-button" onClick={onDone}>Done <ArrowRight size={17} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="summary-screen">
      <section className="summary-card reveal">
        <span className="eyebrow">Workout complete</span>
        <h1>You showed up.<br /><em>That counts.</em></h1>
        <RunnerDoodle className="summary-runner" />
        <div className="summary-time">{formatTime(summary.durationSeconds)} <small>training time</small></div>
        <div className="summary-stats">
          <div><strong>{summary.setCount}</strong><span>sets</span></div>
          <div><strong>{formatVolume(summary.volume)}</strong><span>kg volume</span></div>
          <div><strong>{summary.exerciseCount}</strong><span>exercises</span></div>
        </div>
        <div className="summary-muscles">
          <span>{summary.workoutName}</span>
          <p>{summary.focus}</p>
        </div>
        <div className="summary-actions">
          <Link className="outline-button" href="/history">View history</Link>
          <button className="primary-button" onClick={onDone}>Done <ArrowRight size={17} /></button>
        </div>
      </section>
    </main>
  );
}

export function MusclesPage() {
  const { activeWorkout } = useUserData();
  const [view, setView] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState("—");
  const exerciseNames = activeWorkout?.exercises.map((item) => item.name) ?? [];
  useCoachPage({
    currentPage: "muscles",
    currentWorkout: activeWorkout ? { id: activeWorkout.id, name: activeWorkout.name, focus: activeWorkout.focus } : null,
    selectedMuscle: selected === "—" ? null : selected,
  });

  if (exerciseNames.length === 0) {
    return (
      <div>
      <PageIntro
        eyebrow="Muscle intelligence"
        title="See the work."
        copy="Anatome maps muscles from your active workout exercises."
        action={
          <ContextualAiActions
            actions={[
              { label: "Analyze muscle balance", prompt: "Which muscle am I neglecting? Use my last 4 weeks of volume." },
              { label: "What should I train next?", prompt: "What should I train next based on muscle volume and recovery?" },
            ]}
          />
        }
      />
        <div className="empty-state reveal delay-1">
          <DumbbellDoodle />
          <h3>No exercises to map</h3>
          <p>Add exercises to your active workout to see muscle impact.</p>
          <Link className="primary-button" href="/workouts">Edit workout</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageIntro
        eyebrow="Muscle intelligence"
        title="See the work."
        copy="Anatome renders your active workout onto a real anatomical map."
        action={
          <ContextualAiActions
            actions={[
              { label: "Analyze muscle balance", prompt: "Which muscle am I neglecting? Use my last 4 weeks of volume." },
              { label: "What should I train next?", prompt: "What should I train next based on muscle volume and recovery?" },
            ]}
          />
        }
      />
      <section className="muscle-page-grid">
        <article className="body-stage reveal delay-1">
          <div className="view-toggle"><button className={view === "front" ? "active" : ""} onClick={() => setView("front")}>Front</button><button className={view === "back" ? "active" : ""} onClick={() => setView("back")}>Back</button></div>
          <AnatomeMuscleImpact
            exerciseNames={exerciseNames}
            view={view}
            gender="male"
            variant="stage"
            onSelectMuscle={(_slug, label) => setSelected(label)}
          />
          <span className="body-annotation">powered by<br />api.anatome.dev ↘</span>
        </article>
        <aside className="muscle-panel reveal delay-2">
          <span className="eyebrow">Selected muscle</span>
          <h2>{selected}</h2>
          <p>From {activeWorkout?.name ?? "your workout"} via Anatome.</p>
          <AnatomeMuscleImpact
            exerciseNames={exerciseNames}
            view={view}
            gender="male"
            variant="card"
            onSelectMuscle={(_slug, label) => setSelected(label)}
          />
        </aside>
      </section>
    </div>
  );
}

function sessionStamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function HistorySessionCard({
  session,
  workouts,
}: {
  session: StoredSession;
  workouts: StoredWorkout[];
}) {
  const { videoUrlForExercise, saveVideoUrl, patchWorkout } = useUserData();
  const inProgress = session.id.startsWith("in-progress:");
  const workout = workouts.find((item) => item.id === session.workoutDayId);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const lifts = session.exerciseSessions.flatMap((exerciseSession) => {
    const sets = exerciseSession.sets.filter((set) => workingSet(set));
    if (sets.length === 0) return [];
    const planned = workout?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId);
    const best = sets.reduce((lead, set) => (
      set.weight > lead.weight || (set.weight === lead.weight && set.reps > lead.reps) ? set : lead
    ));
    return [{
      id: exerciseSession.id,
      name: exerciseLabel(session, exerciseSession, workouts),
      target: planned?.target,
      sets,
      best,
      volume: sets.reduce((total, set) => total + set.weight * set.reps, 0),
      planned,
    }];
  });
  const previewExercises = (workout?.exercises.length
    ? workout.exercises.map((item) => {
        const logged = session.exerciseSessions.find((row) => row.workoutExerciseId === item.id);
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

  return (
    <>
    <article className={`session-detail reveal delay-2 ${inProgress ? "is-live" : ""}`}>
      <DumbbellDoodle className="session-doodle" />
      <div className="session-detail-top">
        <span className={`session-status ${inProgress ? "live" : ""}`}>
          {inProgress ? <Zap size={13} fill="currentColor" /> : <Check size={13} />}
          {inProgress ? "In progress" : sessionStamp(sessionDate(session))}
        </span>
        {previewExercises.length > 0 && (
          <button type="button" className="session-view-day" onClick={() => setPreviewIndex(0)}>
            <Eye size={15} /> View day
          </button>
        )}
      </div>
      <h2>{session.workoutName}</h2>
      <p>{session.focus || "Logged session"}</p>
      <Scribble className="session-scribble" />
      <div className="session-stats">
        <span>
          <Timer size={16} />
          <strong>{Math.max(1, Math.round(session.durationSeconds / 60))}</strong>
          min
        </span>
        <span>
          <Weight size={16} />
          <strong>{formatVolume(sessionVolume(session))}</strong>
          kg volume
        </span>
        <span>
          <Flame size={16} />
          <strong>{sessionSetCount(session)}</strong>
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
    </article>
    {previewIndex !== null && previewExercises.length > 0 && (
      <WorkoutDayPreview
        workoutName={session.workoutName}
        focus={session.focus}
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

export function HistoryPage() {
  const { sessions, workouts, activeSession } = useUserData();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pickedSessionId, setPickedSessionId] = useState<string | null>(null);
  useCoachPage({ currentPage: "history" });

  const completed = loggedSessions(sessions, activeSession);
  const monthSessions = completed.filter((session) => {
    const date = new Date(sessionDate(session));
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const trained = trainedDaysInMonth(completed, year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const daySessions = selectedDay
    ? monthSessions.filter((session) => new Date(sessionDate(session)).getDate() === selectedDay)
    : monthSessions.slice(0, 1);
  const selectedSession = daySessions.find((session) => session.id === pickedSessionId) ?? daySessions[0];
  const highlightDay = selectedDay ?? (selectedSession ? new Date(sessionDate(selectedSession)).getDate() : null);

  if (completed.length === 0) {
    return (
      <div>
        <PageIntro
          eyebrow="Training journal"
          title="Proof of work."
          copy="Logged sets from your workouts show up here automatically."
          action={
            <ContextualAiActions
              actions={[
                { label: "Summarize my history", prompt: "Summarize my recent workout history from logged sessions." },
                { label: "Am I consistent?", prompt: "How consistent has my training been? Use actual session dates." },
              ]}
            />
          }
        />
        <div className="empty-state reveal delay-1">
          <History size={40} />
          <h3>No sessions yet</h3>
          <p>Start a workout and enter weight and reps. That data is saved to history even if you finish later.</p>
          <Link className="primary-button" href="/workouts">Create workout</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageIntro
        eyebrow="Training journal"
        title="Proof of work."
        copy="Finished sessions and in-progress logs both count."
        action={
          <ContextualAiActions
            actions={[
              { label: "Summarize my history", prompt: "Summarize my recent workout history from logged sessions." },
              { label: "Am I consistent?", prompt: "How consistent has my training been? Use actual session dates." },
            ]}
          />
        }
      />
      <section className="history-grid">
        <article className="calendar-card paper-panel reveal delay-1">
          <div className="calendar-header">
            <button type="button" aria-label="Previous month" onClick={() => {
              if (month === 0) {
                setYear((y) => y - 1);
                setMonth(11);
              } else {
                setMonth(month - 1);
              }
            }}><ArrowLeft size={17} /></button>
            <h2>
              <CalendarDays size={18} />
              {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month, 1))}
            </h2>
            <button type="button" aria-label="Next month" onClick={() => {
              if (month === 11) {
                setYear((y) => y + 1);
                setMonth(0);
              } else {
                setMonth(month + 1);
              }
            }}><ArrowRight size={17} /></button>
          </div>
          <div className="calendar-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="calendar-days">
            {Array.from({ length: firstWeekday }).map((_, index) => <i key={`pad-${index}`} />)}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={`${trained.has(day) ? "trained" : ""} ${highlightDay === day ? "selected" : ""}`}
                onClick={() => {
                  setSelectedDay(day);
                  setPickedSessionId(null);
                }}
              >
                <span>{day}</span>
                {trained.has(day) && <Dumbbell size={12} />}
              </button>
            ))}
          </div>
          <div className="calendar-key">
            <span><i /> Trained</span>
            <span><i /> Selected</span>
            <strong><Dumbbell size={13} /> {monthSessions.length} sessions this month</strong>
          </div>
        </article>
        {selectedSession && (
          <div className="history-session-stack">
            {daySessions.length > 1 && (
              <div className="history-session-switch">
                {daySessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={session.id === selectedSession.id ? "active" : ""}
                    onClick={() => setPickedSessionId(session.id)}
                  >
                    {session.workoutName}
                  </button>
                ))}
              </div>
            )}
            <HistorySessionCard session={selectedSession} workouts={workouts} />
          </div>
        )}
      </section>
    </div>
  );
}

export function AnalyticsPage() {
  const { sessions, workouts, activeSession } = useUserData();
  const completed = loggedSessions(sessions, activeSession);
  const week = weeklyStats(completed);
  const volumeSeries = weeklyVolumeSeries(completed, 8);
  const totalVolume = completed.reduce((total, session) => total + sessionVolume(session), 0);
  const avgDuration = completed.length
    ? Math.round(completed.reduce((total, session) => total + session.durationSeconds, 0) / completed.length / 60)
    : 0;
  const lifts = exerciseStats(completed, workouts);
  useCoachPage({ currentPage: "analytics" });

  if (completed.length === 0) {
    return (
      <div>
        <PageIntro
          eyebrow="Progress"
          title="Momentum, measured."
          copy="Analytics appear as soon as you log sets on an exercise."
          action={
            <ContextualAiActions
              actions={[
                { label: "Explain my progress", prompt: "Explain my progress using logged sessions." },
                { label: "Find plateaus", prompt: "Where am I plateauing? Use my last 8 weeks." },
                { label: "What should I focus on?", prompt: "What should I focus on next based on volume, PRs, and muscle balance?" },
              ]}
            />
          }
        />
        <div className="empty-state reveal delay-1">
          <BarChart3 size={40} />
          <h3>No training data yet</h3>
          <p>Enter weight and reps in a workout to see volume, sets, and per-exercise stats.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageIntro
        eyebrow="Your data"
        title="Momentum, measured."
        copy="Built from every set you log, including work still in progress."
        action={
          <ContextualAiActions
            actions={[
              { label: "Explain my progress", prompt: "Explain my progress using logged sessions." },
              { label: "Find plateaus", prompt: "Where am I plateauing? Use my last 8 weeks." },
              { label: "What should I focus on?", prompt: "What should I focus on next based on volume, PRs, and muscle balance?" },
            ]}
          />
        }
      />
      <section className="analytics-highlights reveal delay-1">
        <article><span>Workouts</span><strong>{completed.length}</strong><small>logged sessions</small></article>
        <article><span>Total volume</span><strong>{formatVolume(totalVolume)} <i>kg</i></strong><small>all time</small></article>
        <article><span>Avg. duration</span><strong>{avgDuration} <i>min</i></strong><small>per session</small></article>
        <article><span>This week</span><strong>{week.sessions}</strong><small>{formatVolume(week.volume)} kg volume</small></article>
      </section>
      <section className="analytics-grid">
        <article className="volume-card paper-panel reveal">
          <SectionTitle eyebrow="Training load" title="Weekly volume" />
          <AreaChart points={volumeSeries} />
        </article>
        <article className="consistency-card reveal delay-1">
          <span className="eyebrow">This week</span><strong>{week.sets}</strong><h3>sets logged</h3><p>{formatDuration(week.trainingSeconds)} of training time.</p><Flame size={80} fill="currentColor" />
        </article>
      </section>
      {lifts.length > 0 && (
        <section className="exercise-stats paper-panel reveal delay-2">
          <SectionTitle eyebrow="By exercise" title="Where the work went" />
          <div className="exercise-stats-list">
            {lifts.slice(0, 12).map((lift) => (
              <div key={lift.exerciseId}>
                <strong>{lift.name}</strong>
                <span>{lift.sets} sets</span>
                <span>{formatVolume(lift.volume)} kg</span>
                <span>best {formatLoad(lift.bestWeight, lift.bestReps)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type RecordKind = "all" | "weighted" | "bodyweight";

function recordsByKind(records: ReturnType<typeof mergeRecords>, kind: RecordKind) {
  if (kind === "all") return records;
  return records.filter((record) => (
    kind === "bodyweight"
      ? isBodyweightRecordValue(record.value)
      : !isBodyweightRecordValue(record.value)
  ));
}

export function RecordsPage() {
  const { records, saveRecord, sessions, workouts, activeSession, customExercises, videoUrlForExercise } = useUserData();
  const [exercise, setExercise] = useState("");
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState("");
  const [recordKind, setRecordKind] = useState<RecordKind>("all");
  const [logging, setLogging] = useState(false);
  const [saving, setSaving] = useState(false);
  const training = loggedSessions(sessions, activeSession);
  const allRecords = mergeRecords(records, recordsFromTraining(training, workouts));
  const kindCounts = {
    all: allRecords.length,
    weighted: recordsByKind(allRecords, "weighted").length,
    bodyweight: recordsByKind(allRecords, "bodyweight").length,
  };
  const byKind = recordsByKind(allRecords, recordKind);
  const filtered = filter.trim()
    ? byKind.filter((r) => r.exercise.toLowerCase().includes(filter.trim().toLowerCase()))
    : byKind;
  const latest = filtered[0];
  const mediaSources = useMemo(() => {
    const items: WorkoutExercise[] = [];
    for (const workout of workouts) {
      for (const item of workout.exercises) {
        items.push(item);
        for (const alt of item.alternatives ?? []) {
          items.push({
            id: alt.exerciseId,
            exerciseId: alt.exerciseId,
            name: alt.name,
            target: alt.target ?? "",
            secondary: alt.secondary ?? [],
            prescription: "",
            restSeconds: 0,
            gifUrl: alt.gifUrl,
            imageUrl: alt.imageUrl,
            videoUrl: alt.videoUrl,
          });
        }
      }
    }
    for (const item of customExercises) {
      items.push({
        id: item.id,
        exerciseId: item.id,
        name: item.name,
        target: item.target,
        secondary: item.secondary_muscles,
        prescription: "",
        restSeconds: 0,
        gifUrl: item.gif_url,
        imageUrl: item.image,
        videoUrl: item.videoUrl,
      });
    }
    return items;
  }, [customExercises, workouts]);
  const recordExercises = useMemo(() => (
    allRecords.map((record) => {
      const match = mediaSources.find((item) => (
        item.exerciseId === record.exerciseId
        || item.name.trim().toLowerCase() === record.exercise.trim().toLowerCase()
      ));
      return {
        id: record.id,
        exerciseId: match?.exerciseId || record.exerciseId,
        name: record.exercise,
        target: "",
        secondary: [] as string[],
        prescription: "",
        restSeconds: 0,
        gifUrl: match?.gifUrl,
        imageUrl: match?.imageUrl,
        videoUrl: match?.videoUrl,
      };
    })
  ), [allRecords, mediaSources]);
  const catalogMedia = useCatalogMedia(recordExercises);
  useCoachPage({ currentPage: "records" });

  function closeLogForm() {
    if (saving) return;
    setLogging(false);
    setExercise("");
    setValue("");
  }

  useEffect(() => {
    if (!logging) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setLogging(false);
        setExercise("");
        setValue("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logging, saving]);

  const coachActions = (
    <ContextualAiActions
      actions={[
        { label: "Analyze my strength", prompt: "What's my best PR? Show a PR card from my training history." },
        { label: "What PR should I chase next?", prompt: "What PR should I chase next based on my recent lifts?" },
      ]}
    />
  );

  const logButton = (
    <button className="primary-button records-log-button" type="button" onClick={() => setLogging(true)}>
      <Plus size={17} /> Log record
    </button>
  );

  const recordsToolbar = (
    <section className="records-toolbar reveal delay-1">
      {allRecords.length > 0 && (
        <div className="records-kind-toggle view-toggle compact-toggle" role="tablist" aria-label="Record type">
          {([
            ["all", "All"],
            ["weighted", "Weighted"],
            ["bodyweight", "Bodyweight"],
          ] as const).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={recordKind === kind}
              className={recordKind === kind ? "active" : ""}
              onClick={() => setRecordKind(kind)}
            >
              {label} ({kindCounts[kind]})
            </button>
          ))}
        </div>
      )}
      <div className="records-toolbar-row">
        {allRecords.length > 0 && (
          <label className="catalog-search">
            <Search size={19} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search PR by exercise name…"
            />
            {filter.trim() ? (
              <button type="button" className="clear-search" onClick={() => setFilter("")} aria-label="Clear filter">
                <X size={16} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </label>
        )}
        {logButton}
      </div>
    </section>
  );

  const logSheet = logging ? (
    <div
      className="modal-layer"
      role="presentation"
      onClick={closeLogForm}
    >
      <form
        className="confirm-card log-record-card workout-create-form"
        aria-labelledby="log-record-title"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!exercise.trim() || !value.trim() || saving) return;
          setSaving(true);
          try {
            await saveRecord({
              exerciseId: crypto.randomUUID(),
              exercise: exercise.trim(),
              type: "strength",
              value: value.trim(),
              achievedAt: new Date().toISOString(),
            });
            setExercise("");
            setValue("");
            setLogging(false);
          } finally {
            setSaving(false);
          }
        }}
      >
        <button type="button" className="rest-close" onClick={closeLogForm} aria-label="Close">
          <X size={16} />
        </button>
        <span className="log-record-mark"><Trophy size={22} /></span>
        <h3 id="log-record-title">Log a record</h3>
        <p>Add a PR by hand. Logged sets still create records automatically.</p>
        <label>Exercise<input autoFocus value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Bench press" required /></label>
        <label>Result<input value={value} onChange={(e) => setValue(e.target.value)} placeholder="100 kg × 5" required /></label>
        <div className="form-actions">
          <button type="button" className="outline-button" disabled={saving} onClick={closeLogForm}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save record"}</button>
        </div>
      </form>
    </div>
  ) : null;

  if (allRecords.length === 0) {
    return (
      <div>
        <PageIntro
          eyebrow="Personal records"
          title="Your strongest moments."
          copy="PRs are picked up from logged sets. You can also add one by hand."
          action={coachActions}
        />
        {recordsToolbar}
        <div className="empty-state">
          <Trophy size={40} />
          <h3>No records yet</h3>
          <p>Log weight on an exercise to create a PR, or add one by hand.</p>
        </div>
        {logSheet}
      </div>
    );
  }

  return (
    <div>
      <PageIntro
        eyebrow="Personal records"
        title="Your strongest moments."
        copy="Heaviest logged sets become PRs automatically."
        action={coachActions}
      />
      {latest && (
        <section className="records-hero reveal delay-1">
          <div>
            <Sparkles size={24} />
            <span>Latest record</span>
            <h2>{latest.exercise}</h2>
            <strong>{displayRecordValue(latest.value)}</strong>
            <p>{new Date(latest.achievedAt).toLocaleDateString()} · {latest.type} PR</p>
          </div>
          <DumbbellDoodle />
        </section>
      )}
      {recordsToolbar}
      {filtered.length === 0 ? (
        <div className="empty-state reveal delay-2">
          <Trophy size={40} />
          <h3>No matching records</h3>
          <p>Try another type or clear your search.</p>
        </div>
      ) : (
        <section className="records-grid">
          {filtered.map((record, index) => {
            const source = recordExercises.find((item) => item.id === record.id);
            const catalog = source
              ? catalogMedia[source.exerciseId] ?? catalogMedia[`name:${source.name.trim().toLowerCase()}`]
              : undefined;
            const gif = source
              ? workoutStillUrl(source, catalog) || youtubePoster(source.videoUrl || videoUrlForExercise(source.exerciseId, source.name) || "")
              : "";
            const bodyweightRecord = isBodyweightRecordValue(record.value);
            const trend = exerciseProgressTrend(training, workouts, {
              exerciseId: source?.exerciseId || record.exerciseId,
              exercise: record.exercise,
              value: record.value,
            });
            const trendLabel = bodyweightRecord ? "Best reps" : "Best load";
            return (
              <article key={record.id} className="paper-panel record-card">
                <span className="record-gif">
                  {gif ? (
                    <ExerciseStill src={gif} alt={`${record.exercise} demonstration`} width={180} height={180} />
                  ) : (
                    <Trophy size={26} />
                  )}
                  <span className="record-index">{String(index + 1).padStart(2, "0")}</span>
                </span>
                <div className="record-card-body">
                  <h3>{record.exercise}</h3>
                  <strong>{displayRecordValue(record.value)}</strong>
                  <small>
                    {new Date(record.achievedAt).toLocaleDateString()} ·{" "}
                    {bodyweightRecord ? "bodyweight" : record.type} PR
                  </small>
                </div>
                <div className="record-card-chart" aria-hidden="true">
                  <div className="record-chart-meta">
                    <span>{trendLabel}</span>
                    <b>{trend.length > 1 ? `${trend.length} logs` : "Fresh"}</b>
                  </div>
                  {trend.length > 1 ? (
                    <MiniChart
                      values={trend}
                      color={bodyweightRecord ? "var(--orange)" : "var(--lime)"}
                    />
                  ) : (
                    <span className="record-chart-empty">No trend yet</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
      {logSheet}
    </div>
  );
}

export { BodyPage } from "@/src/components/body-page";

export function ProgramsPage() {
  const { programs, workouts, saveProgram, trashProgram, patchProgram, activateProgram, trashedPrograms } = useUserData();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pendingTrash, setPendingTrash] = useState<{ id: string; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const coach = useCoach();
  const active = programs.find((item) => item.active) ?? programs[0];
  useCoachPage({
    currentPage: "programs",
    selectedProgram: active ? { id: active.id, name: active.name } : null,
  });

  const emptySchedule = [
    { day: "Mon", label: "Rest" },
    { day: "Tue", label: "Rest" },
    { day: "Wed", label: "Rest" },
    { day: "Thu", label: "Rest" },
    { day: "Fri", label: "Rest" },
    { day: "Sat", label: "Rest" },
    { day: "Sun", label: "Rest" },
  ];

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await saveProgram({
      name: name.trim(),
      schedule: emptySchedule,
    });
    setName("");
    setCreating(false);
  }

  async function assignDay(programId: string, day: string, workoutId: string) {
    const program = programs.find((item) => item.id === programId);
    if (!program) return;
    const workout = workouts.find((item) => item.id === workoutId);
    await patchProgram(programId, {
      schedule: program.schedule.map((slot) =>
        slot.day === day
          ? { day, workoutDayId: workoutId || "", label: workout?.name ?? "Rest" }
          : slot,
      ),
    });
  }

  return (
    <div>
      <PageIntro
        eyebrow="Training programs"
        title="Structure the season."
        copy="Create workouts first, then place them on the week. No pre-made plans."
        action={
          <div className="page-actions">
            <button className="primary-button" type="button" onClick={() => setCreating(true)}><Plus size={17} /> Create program</button>
            <Link className="outline-button" href="/trash">
              <Trash2 size={17} /> Trash{trashedPrograms.length > 0 ? ` (${trashedPrograms.length})` : ""}
            </Link>
            <button
              className="outline-button"
              type="button"
              onClick={() => void coach?.ask("Create a weekly program from my existing workouts. Wait for confirmation before saving.")}
            >
              <Sparkles size={17} /> Create with AI
            </button>
          </div>
        }
      />
      {creating && (
        <form className="paper-panel workout-create-form reveal" onSubmit={handleCreate}>
          <h3>New program</h3>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hypertrophy block" required /></label>
          <div className="form-actions">
            <button type="button" className="outline-button" onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" className="primary-button">Create program</button>
          </div>
        </form>
      )}

      {programs.length === 0 && !creating && (
        <div className="empty-state reveal delay-1">
          <CalendarDays size={40} />
          <h3>No programs yet</h3>
          <p>Create one or more workouts, then assign them to days of the week.</p>
          {workouts.length === 0 && <Link className="outline-button" href="/workouts">Create a workout first</Link>}
        </div>
      )}

      {programs.map((program) => (
        <section className="program-card reveal delay-1" key={program.id}>
          <div className="program-header">
            <div>
              <span className="active-label"><i /> {program.active ? "Active program" : "Saved program"}</span>
              <label className="program-name-field">
                <span className="sr-only">Program name</span>
                <input value={program.name} onChange={(e) => patchProgram(program.id, { name: e.target.value })} />
              </label>
            </div>
            <div className="builder-title-actions">
              {!program.active && (
                <button className="outline-button" type="button" onClick={() => activateProgram(program.id)}>Set active</button>
              )}
              <button className="danger-text" type="button" onClick={() => setPendingTrash({ id: program.id, name: program.name })}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
          <div className="program-week">
            {program.schedule.map((item) => {
              const assigned = workouts.find((workout) => workout.id === item.workoutDayId);
              const missing = Boolean(item.workoutDayId && !assigned);
              const todayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
              const isToday = item.day === todayKey;
              return (
                <article
                  className={`${assigned || missing ? "" : "rest-day"} ${isToday ? "today" : ""}`}
                  key={item.day}
                >
                  <span>{item.day}{isToday ? " · today" : ""}</span>
                  <i>{assigned || missing ? <Dumbbell size={18} /> : <Moon size={18} />}</i>
                  <strong>{assigned?.name ?? (missing ? item.label : "Rest")}</strong>
                  <small>{assigned ? `${assigned.exercises.length} exercises` : missing ? "In trash" : "Recovery"}</small>
                  <label className="program-day-select">
                    <span className="sr-only">{item.day} workout</span>
                    <select
                      value={item.workoutDayId ?? ""}
                      onChange={(event) => assignDay(program.id, item.day, event.target.value)}
                    >
                      <option value="">Rest</option>
                      {missing && <option value={item.workoutDayId}>{item.label} (in trash)</option>}
                      {workouts.map((workout) => (
                        <option key={workout.id} value={workout.id}>{workout.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                  {assigned && (
                    <Link className="text-button program-day-link" href={`/workouts?w=${assigned.id}`}>
                      Edit
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
          {workouts.length === 0 && (
            <p className="program-empty-hint">Create a workout first, then assign it to a day.</p>
          )}
        </section>
      ))}
      {pendingTrash && (
        <ConfirmDialog
          title={`Move ${pendingTrash.name} to trash?`}
          copy="You can restore it from Trash. Assigned days will come back with it."
          confirmLabel="Move to trash"
          busy={confirmBusy}
          onCancel={() => setPendingTrash(null)}
          onConfirm={async () => {
            setConfirmBusy(true);
            try {
              await trashProgram(pendingTrash.id);
              setPendingTrash(null);
            } finally {
              setConfirmBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

export function SettingsPage() {
  const { dark, setDark } = useTheme();
  const { user, logout } = useAuth();
  const { profile, updateUserProfile, trashedWorkouts, trashedPrograms } = useUserData();
  const coach = useCoach();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [goal, setGoal] = useState<UserProfile["goal"]>("hypertrophy");
  const [defaultRest, setDefaultRest] = useState("90");
  const [saving, setSaving] = useState(false);
  useCoachPage({ currentPage: "settings" });

  const avatar = (displayName || profile?.displayName || user?.email || "FF")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "FF";

  return (
    <div>
      <PageIntro eyebrow="Preferences" title="Make it yours." copy="Profile and defaults sync to Firebase." />
      <section className="settings-grid">
        <div className="settings-content paper-panel">
          <div className="settings-section">
            <h2>Profile</h2>
            <p>Signed in as {user?.email}</p>
            <div className="profile-editor"><span className="avatar large">{avatar}</span></div>
            <div className="form-grid">
              <label>Display name<input value={displayName || profile?.displayName || ""} onChange={(e) => setDisplayName(e.target.value)} /></label>
              <label>Fitness goal
                <select value={goal || profile?.goal || "hypertrophy"} onChange={(e) => setGoal(e.target.value as UserProfile["goal"])}>
                  <option value="hypertrophy">Build muscle</option>
                  <option value="strength">Get stronger</option>
                  <option value="general">General fitness</option>
                </select>
              </label>
              <label>Default rest (sec)<input value={defaultRest || String(profile?.defaultRest ?? 90)} onChange={(e) => setDefaultRest(e.target.value)} type="number" /></label>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await updateUserProfile({
                    displayName: (displayName || profile?.displayName || "Athlete").trim(),
                    goal: goal || profile?.goal || "hypertrophy",
                    defaultRest: Number(defaultRest || profile?.defaultRest || 90) || 90,
                  });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
          <div className="settings-section"><h2>Appearance</h2><div className="theme-options"><button className={!dark ? "active" : ""} onClick={() => setDark(false)}><Sun size={20} /> Light</button><button className={dark ? "active" : ""} onClick={() => setDark(true)}><Moon size={20} /> Dark</button></div></div>
          {coach && (
            <div className="settings-section">
              <h2>Coach</h2>
              <p>Write actions like creating workouts still show a confirmation unless you turn on automatic apply.</p>
              <div className="theme-options">
                <button className={!coach.autoApply ? "active" : ""} type="button" onClick={() => coach.setAutoApply(false)}>Ask first</button>
                <button className={coach.autoApply ? "active" : ""} type="button" onClick={() => coach.setAutoApply(true)}>Apply automatically</button>
              </div>
            </div>
          )}
          <div className="settings-section">
            <h2>Offline</h2>
            <p>Forge keeps your account, workouts, programs, and session logs on this device. Open the app once while online so pages, exercises, and GIFs can cache. First sign-in still needs a network connection.</p>
          </div>
          <div className="settings-section">
            <h2>Trash</h2>
            <p>Deleted workouts and programs stay here until you restore them or delete them forever.</p>
            <Link className="outline-button" href="/trash">
              <Trash2 size={17} /> Open trash{trashedWorkouts.length + trashedPrograms.length > 0 ? ` (${trashedWorkouts.length + trashedPrograms.length})` : ""}
            </Link>
          </div>
          <div className="settings-section data-section">
            <h2>Account</h2>
            <button type="button" onClick={async () => { await logout(); router.push("/login"); }}>
              <LogOut size={17} />
              <span><strong>Sign out</strong><small>You will stay signed in until you sign out on this device.</small></span>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

