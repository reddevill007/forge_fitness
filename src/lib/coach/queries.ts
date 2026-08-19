import { computeBodyMetrics } from "@/src/lib/body-metrics";
import {
  catalogExerciseId,
  exerciseLabel,
  exerciseStats,
  exerciseWeightTrend,
  loggedSessions,
  mergeRecords,
  recordsFromTraining,
  sessionDate,
  sessionDurationSeconds,
  sessionSetCount,
  sessionVolume,
  weeklyStats,
  weeklyVolumeTrend,
  workingSet,
} from "@/src/lib/firebase/stats";
import type { StoredSession, StoredWorkout } from "@/src/lib/firebase/types";
import type { UserDataContextValue } from "@/src/lib/firebase/user-data-context";
import type { Exercise } from "@/src/types/fitness";

export function estimated1RM(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function parseSetValue(value: string) {
  const match = value.match(/([\d.]+)\s*kg?\s*[×x]\s*(\d+)/i);
  if (!match) {
    const weight = Number.parseFloat(value);
    return Number.isFinite(weight) ? { weight, reps: 1 } : null;
  }
  return { weight: Number(match[1]), reps: Number(match[2]) };
}

function weeksAgo(weeks: number) {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return date;
}

function summarizeSession(session: StoredSession, workouts: StoredWorkout[]) {
  return {
    id: session.id,
    date: sessionDate(session),
    name: session.workoutName,
    focus: session.focus,
    durationMinutes: Math.round(sessionDurationSeconds(session) / 60),
    volumeKg: Math.round(sessionVolume(session)),
    sets: sessionSetCount(session),
    inProgress: session.id.startsWith("in-progress:"),
    exercises: session.exerciseSessions
      .map((exerciseSession) => {
        const sets = exerciseSession.sets.filter(workingSet).map((set) => ({
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          rpe: set.rpe,
        }));
        if (sets.length === 0) return null;
        return {
          name: exerciseLabel(session, exerciseSession, workouts),
          exerciseId: catalogExerciseId(session, exerciseSession, workouts),
          sets,
        };
      })
      .filter(Boolean),
  };
}

export function trainingSessions(data: UserDataContextValue) {
  return loggedSessions(data.sessions, data.activeSession);
}

export function profileSnapshot(data: UserDataContextValue) {
  const training = trainingSessions(data);
  const week = weeklyStats(training);
  const latestWeight = data.measurements.find((item) => item.weight)?.weight;
  const metrics = computeBodyMetrics({
    weightKg: latestWeight,
    heightCm: data.profile?.heightCm,
    age: data.profile?.age,
    sex: data.profile?.sex,
    activityLevel: data.profile?.activityLevel,
    goal: data.profile?.goal,
  });
  return {
    displayName: data.profile?.displayName ?? null,
    goal: data.profile?.goal ?? "hypertrophy",
    weightUnit: data.profile?.weightUnit ?? "kg",
    defaultRest: data.profile?.defaultRest ?? 90,
    heightCm: data.profile?.heightCm ?? null,
    age: data.profile?.age ?? null,
    sex: data.profile?.sex ?? null,
    activityLevel: data.profile?.activityLevel ?? null,
    latestWeight: latestWeight ?? null,
    metrics: metrics
      ? {
          bmi: metrics.bmi,
          bmiLabel: metrics.bmiLabel,
          bmr: metrics.bmr,
          tdee: metrics.tdee,
          calories: metrics.calories,
          proteinG: metrics.proteinG,
          carbsG: metrics.carbsG,
          fatG: metrics.fatG,
        }
      : null,
    activeWorkout: data.activeWorkout
      ? { id: data.activeWorkout.id, name: data.activeWorkout.name, focus: data.activeWorkout.focus, exercises: data.activeWorkout.exercises.length }
      : null,
    activeProgram: data.activeProgram ? { id: data.activeProgram.id, name: data.activeProgram.name } : null,
    workoutsSaved: data.workouts.length,
    sessionsLogged: training.length,
    thisWeek: week,
    note: training.length === 0 ? "No logged training data yet." : undefined,
  };
}

export function historySnapshot(data: UserDataContextValue, limit = 12, weeks?: number) {
  let sessions = trainingSessions(data);
  if (weeks && weeks > 0) {
    const since = weeksAgo(weeks);
    sessions = sessions.filter((session) => new Date(sessionDate(session)) >= since);
  }
  const sliced = sessions.slice(0, Math.min(30, Math.max(1, limit)));
  if (sliced.length === 0) {
    return { sessions: [], note: "I don't have enough training data to determine that." };
  }
  return {
    count: sessions.length,
    sessions: sliced.map((session) => summarizeSession(session, data.workouts)),
  };
}

export function workoutSnapshot(data: UserDataContextValue, id: string) {
  const workout = data.workouts.find((item) => item.id === id);
  if (!workout) return { error: "Workout not found." };
  const sessions = trainingSessions(data)
    .filter((session) => session.workoutDayId === id)
    .slice(0, 3)
    .map((session) => summarizeSession(session, data.workouts));
  return {
    id: workout.id,
    name: workout.name,
    focus: workout.focus,
    duration: workout.duration,
    active: Boolean(workout.active),
    exercises: workout.exercises.map((exercise, index) => ({
      index: index + 1,
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      target: exercise.target,
      secondary: exercise.secondary,
      prescription: exercise.prescription,
      restSeconds: exercise.restSeconds,
    })),
    recentSessions: sessions,
  };
}

export function programSnapshot(data: UserDataContextValue) {
  const program = data.activeProgram ?? data.programs[0];
  if (!program) return { note: "No program saved yet." };
  return {
    id: program.id,
    name: program.name,
    active: Boolean(program.active),
    schedule: program.schedule.map((slot) => {
      const workout = data.workouts.find((item) => item.id === slot.workoutDayId);
      return {
        day: slot.day,
        label: slot.label,
        workoutId: slot.workoutDayId || null,
        workoutName: workout?.name ?? (slot.label || "Rest"),
        exercises: workout?.exercises.length ?? 0,
      };
    }),
  };
}

export function compactExercise(exercise: Exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    target: exercise.target,
    secondary: exercise.secondary_muscles,
    equipment: exercise.equipment,
    bodyPart: exercise.body_part,
    instructions: (exercise.instruction_steps.en ?? []).slice(0, 8),
    summary: exercise.instructions.en,
    custom: exercise.category === "custom",
    gifUrl: exercise.gif_url || undefined,
    imageUrl: exercise.image || undefined,
    videoUrl: exercise.videoUrl || undefined,
    hasGif: Boolean(exercise.gif_url),
    hasVideo: Boolean(exercise.videoUrl),
  };
}

export function exerciseHistorySnapshot(
  data: UserDataContextValue,
  exerciseId?: string,
  name?: string,
  limit = 12,
) {
  const training = trainingSessions(data);
  const needle = (name ?? "").trim().toLowerCase();
  const points: Array<{ at: string; workout: string; weight: number; reps: number; volume: number }> = [];

  for (const session of training) {
    for (const exerciseSession of session.exerciseSessions) {
      const id = catalogExerciseId(session, exerciseSession, data.workouts);
      const label = exerciseLabel(session, exerciseSession, data.workouts);
      const matches = exerciseId
        ? id === exerciseId
        : needle
          ? label.toLowerCase().includes(needle) || id.toLowerCase() === needle
          : false;
      if (!matches) continue;
      let bestWeight = 0;
      let bestReps = 0;
      let volume = 0;
      for (const set of exerciseSession.sets) {
        if (!workingSet(set) || set.weight <= 0) continue;
        volume += set.weight * set.reps;
        if (set.weight > bestWeight || (set.weight === bestWeight && set.reps > bestReps)) {
          bestWeight = set.weight;
          bestReps = set.reps;
        }
      }
      if (bestWeight > 0) {
        points.push({
          at: sessionDate(session),
          workout: session.workoutName,
          weight: bestWeight,
          reps: bestReps,
          volume: Math.round(volume),
        });
      }
    }
  }

  if (points.length === 0) {
    return { note: "I don't have enough training data to determine that.", exerciseId, name };
  }

  points.sort((a, b) => (a.at < b.at ? 1 : -1));
  const latest = points[0];
  const first = points[points.length - 1];
  const trendId = exerciseId || catalogIdFromPoints(data, exerciseId, name);
  const trend = trendId ? exerciseWeightTrend(training, data.workouts, trendId, limit) : { values: [], latest: 0, count: 0 };

  return {
    name: name || exerciseLabelFromId(data, exerciseId),
    sessions: points.slice(0, Math.min(20, limit)),
    best: latest,
    first,
    estimated1RM: estimated1RM(latest.weight, latest.reps),
    trend: trend.values,
  };
}

function catalogIdFromPoints(data: UserDataContextValue, exerciseId?: string, name?: string) {
  if (exerciseId) return exerciseId;
  const needle = (name ?? "").trim().toLowerCase();
  if (!needle) return "";
  for (const workout of data.workouts) {
    const match = workout.exercises.find((item) => item.name.toLowerCase().includes(needle));
    if (match) return match.exerciseId;
  }
  return needle;
}

function exerciseLabelFromId(data: UserDataContextValue, exerciseId?: string) {
  if (!exerciseId) return "Exercise";
  for (const workout of data.workouts) {
    const match = workout.exercises.find((item) => item.exerciseId === exerciseId);
    if (match) return match.name;
  }
  return exerciseId;
}

export function recordsSnapshot(data: UserDataContextValue, exercise?: string, month?: string, limit = 8) {
  const training = trainingSessions(data);
  const derived = recordsFromTraining(training, data.workouts);
  let records = mergeRecords(data.records, derived);
  const needle = (exercise ?? "").trim().toLowerCase();
  if (needle) {
    records = records.filter((record) => record.exercise.toLowerCase().includes(needle));
  }
  if (month) {
    records = records.filter((record) => record.achievedAt.startsWith(month));
  }
  if (records.length === 0) {
    return { records: [], note: "I don't have enough training data to determine that." };
  }
  const sliced = records.slice(0, Math.min(20, Math.max(1, limit)));
  return {
    records: sliced.map((record) => {
      const parsed = parseSetValue(record.value);
      return {
        exercise: record.exercise,
        exerciseId: record.exerciseId,
        value: record.value,
        type: record.type,
        achievedAt: record.achievedAt,
        weight: parsed?.weight,
        reps: parsed?.reps,
        estimated1RM: parsed ? estimated1RM(parsed.weight, parsed.reps) : undefined,
      };
    }),
  };
}

type MuscleBucket = {
  muscle: string;
  sets: number;
  sessions: Set<string>;
  exercises: Set<string>;
};

function addMuscle(map: Map<string, MuscleBucket>, muscle: string, sets: number, day: string, exercise: string, weight: number) {
  const key = muscle.trim().toLowerCase();
  if (!key) return;
  const current = map.get(key) ?? { muscle: muscle.trim(), sets: 0, sessions: new Set<string>(), exercises: new Set<string>() };
  current.sets += sets * weight;
  current.sessions.add(day);
  current.exercises.add(exercise);
  map.set(key, current);
}

function muscleMapFromSessions(sessions: StoredSession[], workouts: StoredWorkout[]) {
  const map = new Map<string, MuscleBucket>();
  for (const session of sessions) {
    const day = sessionDate(session).slice(0, 10);
    const workout = workouts.find((item) => item.id === session.workoutDayId);
    for (const exerciseSession of session.exerciseSessions) {
      const sets = exerciseSession.sets.filter(workingSet).length;
      if (sets === 0) continue;
      const name = exerciseLabel(session, exerciseSession, workouts);
      const planned = workout?.exercises.find((item) => item.id === exerciseSession.workoutExerciseId);
      const target = planned?.target || "unknown";
      const secondary = planned?.secondary ?? [];
      addMuscle(map, target, sets, day, name, 1);
      for (const muscle of secondary) addMuscle(map, muscle, sets, day, name, 0.5);
    }
  }
  return [...map.values()]
    .map((item) => ({
      muscle: item.muscle,
      sets: Math.round(item.sets * 10) / 10,
      frequency: item.sessions.size,
      exercises: [...item.exercises],
    }))
    .sort((a, b) => b.sets - a.sets);
}

export function muscleVolumeSnapshot(data: UserDataContextValue, muscle?: string, weeks = 4) {
  const training = trainingSessions(data);
  const since = weeksAgo(Math.max(1, weeks));
  const window = training.filter((session) => new Date(sessionDate(session)) >= since);
  const lastWeekStart = weeksAgo(1);
  const prevWeekStart = weeksAgo(2);
  const thisWeek = training.filter((session) => new Date(sessionDate(session)) >= lastWeekStart);
  const lastWeek = training.filter((session) => {
    const date = new Date(sessionDate(session));
    return date >= prevWeekStart && date < lastWeekStart;
  });

  const overall = muscleMapFromSessions(window, data.workouts);
  const thisWeekMuscles = muscleMapFromSessions(thisWeek, data.workouts);
  const lastWeekMuscles = muscleMapFromSessions(lastWeek, data.workouts);

  if (overall.length === 0) {
    return { muscles: [], note: "I don't have enough training data to determine that." };
  }

  const needle = (muscle ?? "").trim().toLowerCase();
  const focused = needle
    ? overall.filter((item) => item.muscle.toLowerCase().includes(needle))
    : overall;

  return {
    weeks,
    thisWeekSets: thisWeekMuscles.reduce((sum, item) => sum + item.sets, 0),
    muscles: focused.map((item) => ({
      ...item,
      thisWeek: thisWeekMuscles.find((row) => row.muscle.toLowerCase() === item.muscle.toLowerCase())?.sets ?? 0,
      lastWeek: lastWeekMuscles.find((row) => row.muscle.toLowerCase() === item.muscle.toLowerCase())?.sets ?? 0,
      status: item.sets / Math.max(1, weeks) >= 10 ? "Healthy training volume" : item.sets / Math.max(1, weeks) >= 6 ? "Moderate volume" : "Low volume",
    })),
    lowest: overall.slice(-3).reverse(),
    highest: overall.slice(0, 3),
  };
}

export function trainingVolumeSnapshot(data: UserDataContextValue, weeks = 8) {
  const training = trainingSessions(data);
  if (training.length === 0) {
    return { note: "I don't have enough training data to determine that." };
  }
  const since = weeksAgo(Math.max(1, weeks));
  const window = training.filter((session) => new Date(sessionDate(session)) >= since);
  const week = weeklyStats(training);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = training.filter((session) => new Date(sessionDate(session)) >= monthStart);
  return {
    sessionsAllTime: training.length,
    sessionsInWindow: window.length,
    weekly: week,
    monthly: {
      sessions: month.length,
      volume: Math.round(month.reduce((sum, session) => sum + sessionVolume(session), 0)),
      sets: month.reduce((sum, session) => sum + sessionSetCount(session), 0),
    },
    weeklyVolumeTrend: weeklyVolumeTrend(training, weeks),
    topExercises: exerciseStats(training, data.workouts).slice(0, 8),
  };
}

export function progressSnapshot(data: UserDataContextValue, exerciseId?: string, name?: string, weeks = 8) {
  const volume = trainingVolumeSnapshot(data, weeks);
  const history = (exerciseId || name)
    ? exerciseHistorySnapshot(data, exerciseId, name, weeks)
    : null;
  const records = recordsSnapshot(data, name, undefined, 5);
  return {
    volume,
    exercise: history,
    recentRecords: records,
  };
}

export function measurementsSnapshot(data: UserDataContextValue, limit = 12) {
  const items = data.measurements.slice(0, Math.min(20, Math.max(1, limit))).map((item) => ({
    measuredAt: item.measuredAt,
    weight: item.weight,
    waist: item.waist,
    hips: item.hips,
    chest: item.chest,
    arms: item.arms,
    thighs: item.thighs,
    calves: item.calves,
    bodyFat: item.bodyFat,
  }));
  const latestWeight = items.find((item) => item.weight)?.weight;
  const metrics = computeBodyMetrics({
    weightKg: latestWeight,
    heightCm: data.profile?.heightCm,
    age: data.profile?.age,
    sex: data.profile?.sex,
    activityLevel: data.profile?.activityLevel,
    goal: data.profile?.goal,
  });
  if (items.length === 0) {
    return { measurements: [], metrics, note: "No body check-ins logged yet." };
  }
  return { measurements: items, latest: items[0], metrics };
}

export function findWorkoutExercise(data: UserDataContextValue, workoutId: string, name: string, rowId?: string) {
  const workout = data.workouts.find((item) => item.id === workoutId);
  if (!workout) return { workout: null, exercise: null };
  if (rowId) {
    return { workout, exercise: workout.exercises.find((item) => item.id === rowId) ?? null };
  }
  const needle = name.trim().toLowerCase();
  return {
    workout,
    exercise: workout.exercises.find((item) => item.name.toLowerCase() === needle)
      ?? workout.exercises.find((item) => item.name.toLowerCase().includes(needle))
      ?? null,
  };
}
