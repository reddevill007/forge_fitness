import type { ActiveSessionProgress, StoredSession, StoredWorkout } from "@/src/lib/firebase/types";
import type { ExerciseSession, PersonalRecord, SetLog, WorkoutExercise } from "@/src/types/fitness";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function workingSet(set: SetLog) {
  return set.completed || set.reps > 0;
}

export function isBodyweightLoad(weight: number) {
  return !Number.isFinite(weight) || weight <= 0;
}

export function formatLoad(weight: number, reps?: number) {
  const load = isBodyweightLoad(weight) ? "Bodyweight" : `${weight} kg`;
  if (reps === undefined) return load;
  return `${load} × ${reps}`;
}

export function formatLoggedValue(value: string) {
  return value.replace(/^0+(?:\.0+)?\s*kg/i, "Bodyweight");
}

export function isBodyweightRecordValue(value: string) {
  return formatLoggedValue(value).startsWith("Bodyweight");
}

export function displayRecordValue(value: string) {
  const formatted = formatLoggedValue(value);
  return formatted.startsWith("Bodyweight")
    ? formatted.replace(/^Bodyweight/, "BW")
    : formatted;
}

export function sessionDate(session: StoredSession) {
  return session.startedAt;
}

export function elapsedSeconds(startedAt: string, endedAt?: string | number | Date) {
  const start = new Date(startedAt).getTime();
  const end = endedAt == null
    ? Date.now()
    : typeof endedAt === "number"
      ? endedAt
      : new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function sessionDurationSeconds(session: {
  id?: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
}) {
  if (session.completedAt) {
    return elapsedSeconds(session.startedAt, session.completedAt) || session.durationSeconds;
  }
  if (session.id?.startsWith("in-progress:")) {
    return elapsedSeconds(session.startedAt) || session.durationSeconds;
  }
  return session.durationSeconds;
}

export function sessionsThisWeek(sessions: StoredSession[]) {
  const weekStart = startOfWeek(new Date());
  return sessions.filter((session) => new Date(sessionDate(session)) >= weekStart);
}

export function sessionVolume(session: StoredSession) {
  return session.exerciseSessions.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((setTotal, set) => {
        if (!workingSet(set)) return setTotal;
        return setTotal + set.weight * set.reps;
      }, 0)
    );
  }, 0);
}

export function sessionSetCount(session: StoredSession) {
  return session.exerciseSessions.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => workingSet(set)).length,
    0,
  );
}

export function hasLoggedWork(session: StoredSession) {
  return sessionSetCount(session) > 0;
}

function calendarDayKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function activeSessionLoggedSetCount(progress: ActiveSessionProgress) {
  return progress.exerciseSessions.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => workingSet(set)).length,
    0,
  );
}

export function activeSessionHasLoggedWork(progress: ActiveSessionProgress) {
  return activeSessionLoggedSetCount(progress) > 0;
}

/** True when the session was started on a previous calendar day (local time). */
export function activeSessionIsStale(progress: ActiveSessionProgress, now: Date = new Date()) {
  const startedKey = calendarDayKey(progress.startedAt);
  const todayKey = calendarDayKey(now);
  return Boolean(startedKey) && startedKey < todayKey;
}

export function stampExerciseSessions(
  exercises: WorkoutExercise[],
  sessions: ExerciseSession[],
): ExerciseSession[] {
  return sessions.map((session) => {
    const item = exercises.find((exercise) => exercise.id === session.workoutExerciseId);
    if (!item) return session;
    return {
      ...session,
      exerciseName: item.name,
      exerciseId: item.exerciseId,
    };
  });
}

export function sessionFromProgress(progress: ActiveSessionProgress): StoredSession {
  return {
    id: `in-progress:${progress.workoutId}`,
    workoutDayId: progress.workoutId,
    workoutName: progress.workoutName,
    focus: progress.focus,
    startedAt: progress.startedAt,
    durationSeconds: progress.durationSeconds,
    exerciseSessions: progress.exerciseSessions,
  };
}

export function loggedSessions(
  sessions: StoredSession[],
  activeSession: ActiveSessionProgress | null,
): StoredSession[] {
  const visible = sessions.filter((session) => session.completedAt || hasLoggedWork(session));
  if (!activeSession) return visible;
  const live = sessionFromProgress(activeSession);
  if (!hasLoggedWork(live)) return visible;
  const duplicate = visible.some((session) => (
    session.workoutDayId === live.workoutDayId && session.startedAt === live.startedAt
  ));
  return duplicate ? visible : [live, ...visible];
}

export function exerciseLabel(
  session: StoredSession,
  exerciseSession: ExerciseSession,
  workouts: StoredWorkout[],
) {
  if (exerciseSession.exerciseName) return exerciseSession.exerciseName;
  const workout = workouts.find((item) => item.id === session.workoutDayId);
  return workout?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId)?.name ?? "Exercise";
}

export function catalogExerciseId(
  session: StoredSession,
  exerciseSession: ExerciseSession,
  workouts: StoredWorkout[],
) {
  if (exerciseSession.exerciseId) return exerciseSession.exerciseId;
  const workout = workouts.find((item) => item.id === session.workoutDayId);
  return workout?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId)?.exerciseId
    ?? exerciseSession.workoutExerciseId;
}

export type ExerciseStat = {
  exerciseId: string;
  name: string;
  sets: number;
  volume: number;
  bestWeight: number;
  bestReps: number;
};

export function exerciseStats(sessions: StoredSession[], workouts: StoredWorkout[]): ExerciseStat[] {
  const byId = new Map<string, ExerciseStat>();
  for (const session of sessions) {
    for (const exerciseSession of session.exerciseSessions) {
      const name = exerciseLabel(session, exerciseSession, workouts);
      const exerciseId = catalogExerciseId(session, exerciseSession, workouts);
      const current = byId.get(exerciseId) ?? {
        exerciseId,
        name,
        sets: 0,
        volume: 0,
        bestWeight: 0,
        bestReps: 0,
      };
      for (const set of exerciseSession.sets) {
        if (!workingSet(set)) continue;
        current.sets += 1;
        current.volume += set.weight * set.reps;
        current.bestWeight = Math.max(current.bestWeight, set.weight);
        current.bestReps = Math.max(current.bestReps, set.reps);
      }
      byId.set(exerciseId, current);
    }
  }
  return [...byId.values()]
    .filter((item) => item.sets > 0)
    .sort((a, b) => b.volume - a.volume);
}

function recordNumeric(record: PersonalRecord) {
  const value = Number.parseFloat(record.value);
  return Number.isFinite(value) ? value : 0;
}

export function recordsFromTraining(sessions: StoredSession[], workouts: StoredWorkout[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord & { weight: number; reps: number }>();
  for (const session of sessions) {
    for (const exerciseSession of session.exerciseSessions) {
      const name = exerciseLabel(session, exerciseSession, workouts);
      const exerciseId = catalogExerciseId(session, exerciseSession, workouts);
      for (const set of exerciseSession.sets) {
        if (!workingSet(set)) continue;
        const key = exerciseId;
        const current = best.get(key);
        const better = !current
          || set.weight > current.weight
          || (set.weight === current.weight && set.reps > current.reps);
        if (!better) continue;
        best.set(key, {
          id: `derived:${exerciseId}:strength`,
          exerciseId,
          exercise: name,
          type: "strength",
          value: formatLoad(set.weight, set.reps),
          achievedAt: sessionDate(session),
          weight: set.weight,
          reps: set.reps,
        });
      }
    }
  }
  return [...best.values()]
    .map(({ weight: _weight, reps: _reps, ...record }) => record)
    .sort((a, b) => (a.achievedAt < b.achievedAt ? 1 : -1));
}

export function mergeRecords(manual: PersonalRecord[], derived: PersonalRecord[]): PersonalRecord[] {
  const byKey = new Map<string, PersonalRecord>();
  const keyFor = (record: PersonalRecord) => `${record.type}:${record.exercise.trim().toLowerCase()}`;
  for (const record of derived) byKey.set(keyFor(record), record);
  for (const record of manual) {
    const key = keyFor(record);
    const existing = byKey.get(key);
    if (!existing || recordNumeric(record) >= recordNumeric(existing)) {
      byKey.set(key, record);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.achievedAt < b.achievedAt ? 1 : -1));
}

export function newRecordsToSave(existing: PersonalRecord[], derived: PersonalRecord[]): Omit<PersonalRecord, "id">[] {
  const merged = mergeRecords(existing, []);
  return derived
    .filter((record) => {
      const current = merged.find((item) => (
        item.type === record.type && item.exercise.trim().toLowerCase() === record.exercise.trim().toLowerCase()
      ));
      return !current || recordNumeric(record) > recordNumeric(current);
    })
    .map(({ id: _id, ...record }) => record);
}

export function weeklyStats(sessions: StoredSession[]) {
  const weekSessions = sessionsThisWeek(sessions);
  const volume = weekSessions.reduce((total, session) => total + sessionVolume(session), 0);
  const sets = weekSessions.reduce((total, session) => total + sessionSetCount(session), 0);
  const trainingSeconds = weekSessions.reduce((total, session) => total + sessionDurationSeconds(session), 0);
  return {
    sessions: weekSessions.length,
    volume,
    sets,
    trainingSeconds,
  };
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatVolume(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return kg.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function greetingName(displayName: string) {
  const first = displayName.trim().split(/\s+/)[0];
  return first || "there";
}

export function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function sessionsForMonth(sessions: StoredSession[], year: number, month: number) {
  return sessions.filter((session) => {
    const date = new Date(sessionDate(session));
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

export function trainedDaysInMonth(sessions: StoredSession[], year: number, month: number) {
  const days = new Set<number>();
  sessionsForMonth(sessions, year, month).forEach((session) => {
    days.add(new Date(sessionDate(session)).getDate());
  });
  return days;
}

export function exerciseWeightTrend(
  sessions: StoredSession[],
  workouts: StoredWorkout[],
  exerciseId: string,
  limit = 8,
) {
  const points: Array<{ at: string; weight: number }> = [];
  for (const session of sessions) {
    let best = 0;
    for (const exerciseSession of session.exerciseSessions) {
      const id = catalogExerciseId(session, exerciseSession, workouts);
      if (id !== exerciseId) continue;
      for (const set of exerciseSession.sets) {
        if (!workingSet(set) || set.weight <= 0) continue;
        best = Math.max(best, set.weight);
      }
    }
    if (best > 0) points.push({ at: sessionDate(session), weight: best });
  }
  points.sort((a, b) => a.at.localeCompare(b.at));
  const sliced = points.slice(-limit);
  return {
    values: sliced.map((point) => point.weight),
    latest: sliced.at(-1)?.weight ?? 0,
    count: points.length,
  };
}

export function exerciseProgressTrend(
  sessions: StoredSession[],
  workouts: StoredWorkout[],
  record: { exerciseId: string; exercise: string; value: string },
  limit = 8,
) {
  const bodyweight = isBodyweightRecordValue(record.value);
  const name = record.exercise.trim().toLowerCase();
  const points: Array<{ at: string; value: number }> = [];
  for (const session of sessions) {
    let best = 0;
    for (const exerciseSession of session.exerciseSessions) {
      const id = catalogExerciseId(session, exerciseSession, workouts);
      const label = exerciseLabel(session, exerciseSession, workouts).trim().toLowerCase();
      if (id !== record.exerciseId && label !== name) continue;
      for (const set of exerciseSession.sets) {
        if (!workingSet(set)) continue;
        if (bodyweight) {
          if (isBodyweightLoad(set.weight)) best = Math.max(best, set.reps);
        } else if (!isBodyweightLoad(set.weight)) {
          best = Math.max(best, set.weight);
        }
      }
    }
    if (best > 0) points.push({ at: sessionDate(session), value: best });
  }
  points.sort((a, b) => a.at.localeCompare(b.at));
  return points.slice(-limit).map((point) => point.value);
}

export function weeklyVolumeTrend(sessions: StoredSession[], weeks = 8) {
  const series = weeklyVolumeSeries(sessions, weeks);
  const max = Math.max(...series.map((point) => point.value), 1);
  return series.map((point) => Math.round((point.value / max) * 100));
}

export type SeriesPoint = { label: string; value: number };

export function weeklyVolumeSeries(sessions: StoredSession[], weeks = 8): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = startOfWeek(new Date(now));
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const volume = sessions
      .filter((session) => {
        const date = new Date(sessionDate(session));
        return date >= weekStart && date < weekEnd;
      })
      .reduce((total, session) => total + sessionVolume(session), 0);
    points.push({
      label: i === 0 ? "Now" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekStart),
      value: Math.round(volume),
    });
  }
  return points;
}

export function weekdaySessionCounts(sessions: StoredSession[]): SeriesPoint[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekStart = startOfWeek(new Date());
  return labels.map((label, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const count = sessions.filter((session) => isSameDay(new Date(sessionDate(session)), day)).length;
    return { label, value: count };
  });
}

function dailyBuckets(
  sessions: StoredSession[],
  days: number,
  valueOf: (session: StoredSession) => number,
): SeriesPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const points: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const value = sessions.reduce((total, session) => (
      isSameDay(new Date(sessionDate(session)), day) ? total + valueOf(session) : total
    ), 0);
    const label = i === 0
      ? "Today"
      : day.getDate() === 1 || i === days - 1
        ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day)
        : String(day.getDate());
    points.push({ label, value });
  }
  return points;
}

export function dailySetsSeries(sessions: StoredSession[], days = 14): SeriesPoint[] {
  return dailyBuckets(sessions, days, sessionSetCount);
}

export function dailyDurationSeries(sessions: StoredSession[], days = 14): SeriesPoint[] {
  return dailyBuckets(sessions, days, (session) => sessionDurationSeconds(session) / 60)
    .map((point) => ({ ...point, value: Math.round(point.value) }));
}

function plannedExercise(
  session: StoredSession,
  exerciseSession: ExerciseSession,
  workouts: StoredWorkout[],
) {
  return workouts
    .find((item) => item.id === session.workoutDayId)
    ?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId);
}

export function weeklySetsSeries(sessions: StoredSession[], weeks = 8): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = startOfWeek(new Date(now));
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const sets = sessions
      .filter((session) => {
        const date = new Date(sessionDate(session));
        return date >= weekStart && date < weekEnd;
      })
      .reduce((total, session) => total + sessionSetCount(session), 0);
    points.push({
      label: i === 0 ? "Now" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekStart),
      value: sets,
    });
  }
  return points;
}

export function weeklyDurationSeries(sessions: StoredSession[], weeks = 8): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = startOfWeek(new Date(now));
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const minutes = sessions
      .filter((session) => {
        const date = new Date(sessionDate(session));
        return date >= weekStart && date < weekEnd;
      })
      .reduce((total, session) => total + sessionDurationSeconds(session), 0);
    points.push({
      label: i === 0 ? "Now" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekStart),
      value: Math.round(minutes / 60),
    });
  }
  return points;
}

function topSlices(by: Map<string, number>, limit = 6): SeriesPoint[] {
  const rows = [...by.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  if (rows.length <= limit) {
    return rows.map(([label, value]) => ({ label, value: Math.round(value) }));
  }
  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1).reduce((total, [, value]) => total + value, 0);
  return [
    ...head.map(([label, value]) => ({ label, value: Math.round(value) })),
    { label: "Other", value: Math.round(rest) },
  ];
}

export function setsByMuscle(sessions: StoredSession[], workouts: StoredWorkout[]): SeriesPoint[] {
  const by = new Map<string, number>();
  for (const session of sessions) {
    for (const exerciseSession of session.exerciseSessions) {
      const planned = plannedExercise(session, exerciseSession, workouts);
      const label = planned?.target?.trim() || "Other";
      const sets = exerciseSession.sets.filter(workingSet).length;
      if (!sets) continue;
      by.set(label, (by.get(label) ?? 0) + sets);
    }
  }
  return topSlices(by);
}

export function plannedSetsByMuscle(workout?: StoredWorkout | null): SeriesPoint[] {
  if (!workout) return [];
  const by = new Map<string, number>();
  for (const exercise of workout.exercises) {
    const label = exercise.target?.trim() || "Other";
    by.set(label, (by.get(label) ?? 0) + 1);
  }
  return topSlices(by);
}

export function setsByLoadKind(sessions: StoredSession[]): SeriesPoint[] {
  let weighted = 0;
  let bodyweight = 0;
  for (const session of sessions) {
    for (const exerciseSession of session.exerciseSessions) {
      for (const set of exerciseSession.sets) {
        if (!workingSet(set)) continue;
        if (isBodyweightLoad(set.weight)) bodyweight += 1;
        else weighted += 1;
      }
    }
  }
  return [
    { label: "Weighted", value: weighted },
    { label: "Bodyweight", value: bodyweight },
  ].filter((item) => item.value > 0);
}

export function currentStreak(sessions: StoredSession[]) {
  const days = new Set(
    sessions.map((session) => {
      const date = new Date(sessionDate(session));
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }),
  );
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.getTime())) return 0;
  }
  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function defaultSets(count = 3, restSeconds = 90): SetLog[] {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    setNumber: index + 1,
    kind: "working" as const,
    weight: 0,
    reps: 0,
    rir: 2,
    restSeconds,
    completed: false,
  }));
}

export function isToday(dateIso: string) {
  return isSameDay(new Date(dateIso), new Date());
}

export function workoutCompletedToday(
  sessions: StoredSession[],
  workout: Pick<StoredWorkout, "id" | "exercises"> | null | undefined,
) {
  if (!workout) return false;
  const planned = workout.exercises.map((item) => item.id);
  return sessions.some((session) => {
    if (session.workoutDayId !== workout.id) return false;
    if (session.id.startsWith("in-progress:")) return false;
    const when = session.completedAt ?? session.startedAt;
    if (!isToday(when)) return false;
    if (session.completedAt) return true;
    if (!planned.length) return false;
    const logged = new Set(
      session.exerciseSessions
        .filter((row) => row.sets.some((set) => workingSet(set)))
        .map((row) => row.workoutExerciseId),
    );
    return planned.every((id) => logged.has(id));
  });
}
