import type { StoredProgram, StoredSession, StoredWorkout } from "@/src/lib/firebase/types";

export const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type CalendarDayKind = "trained" | "skipped" | "rest" | "planned" | "open";

export function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function weekdayKey(date: Date = new Date()): WeekdayKey {
  return WEEKDAY_KEYS[date.getDay()];
}

export function formatWeekdayLong(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

export function programSlotForDate(program: StoredProgram | null | undefined, date: Date) {
  if (!program) return undefined;
  const key = weekdayKey(date);
  return program.schedule.find((item) => item.day === key);
}

export function workoutForDate(
  program: StoredProgram | null | undefined,
  workouts: StoredWorkout[],
  date: Date,
) {
  const slot = programSlotForDate(program, date);
  if (!slot?.workoutDayId) return null;
  return workouts.find((workout) => workout.id === slot.workoutDayId) ?? null;
}

export function resolveTodaysWorkout(
  program: StoredProgram | null | undefined,
  workouts: StoredWorkout[],
  fallback: StoredWorkout | null,
  date: Date = new Date(),
) {
  if (!program) return fallback;
  return workoutForDate(program, workouts, date);
}

export function nextScheduledWorkout(
  program: StoredProgram | null | undefined,
  workouts: StoredWorkout[],
  from: Date = new Date(),
) {
  if (!program) return null;
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(from);
    date.setDate(from.getDate() + offset);
    const workout = workoutForDate(program, workouts, date);
    if (workout) return { date, workout };
  }
  return null;
}

export function sessionsOnLocalDay(sessions: StoredSession[], date: Date) {
  return sessions.filter((session) => isSameLocalDay(new Date(session.startedAt), date));
}

export function calendarDayKind(input: {
  date: Date;
  today?: Date;
  program: StoredProgram | null | undefined;
  trained: boolean;
}): CalendarDayKind {
  const today = startOfLocalDay(input.today ?? new Date());
  const day = startOfLocalDay(input.date);
  if (input.trained) return "trained";
  if (!input.program) return "open";

  const slot = programSlotForDate(input.program, input.date);
  const scheduled = Boolean(slot?.workoutDayId);
  if (!scheduled) return "rest";
  if (day < today) return "skipped";
  return "planned";
}
