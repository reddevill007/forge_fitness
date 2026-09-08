import { fetchExercise, fetchExercises } from "@/src/lib/exercises-client";
import { workoutExerciseFromCatalog } from "@/src/lib/firebase/firestore";
import type { UserDataContextValue } from "@/src/lib/firebase/user-data-context";
import type { CustomExerciseInput, Exercise, WorkoutDay, WorkoutExercise, WorkoutProgram } from "@/src/types/fitness";
import {
  compositionToMeasurement,
  compositionToProfilePatch,
  reportsFromCompositionArgs,
} from "@/src/lib/body-composition";
import {
  compactExercise,
  estimated1RM,
  exerciseHistorySnapshot,
  findWorkoutExercise,
  historySnapshot,
  measurementsSnapshot,
  muscleVolumeSnapshot,
  profileSnapshot,
  programSnapshot,
  progressSnapshot,
  recordsSnapshot,
  trainingVolumeSnapshot,
  workoutSnapshot,
} from "@/src/lib/coach/queries";
import type { PendingWrite, WorkoutPreviewExercise } from "@/src/lib/coach/types";
import { WRITE_TOOLS } from "@/src/lib/coach/types";

export type CoachToolResult = {
  data: Record<string, unknown>;
  pendingWrite?: PendingWrite;
  thinking?: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

async function resolveCatalogExercise(id?: string, name?: string, custom: Exercise[] = []) {
  const needle = (name ?? "").trim().toLowerCase();
  if (id) {
    const customHit = custom.find((item) => item.id === id);
    if (customHit) return customHit;
    const byId = await fetchExercise(id);
    if (byId) return byId;
  }
  if (needle) {
    const customHit = custom.find((item) => item.name.toLowerCase() === needle)
      ?? custom.find((item) => item.name.toLowerCase().includes(needle));
    if (customHit) return customHit;
    const results = await fetchExercises({ q: name, limit: 8 });
    return results.items.find((item) => item.name.toLowerCase() === needle) ?? results.items[0] ?? null;
  }
  return null;
}

async function previewExercises(
  items: unknown,
  custom: Exercise[],
): Promise<WorkoutPreviewExercise[]> {
  const list = Array.isArray(items) ? items : [];
  const resolved: WorkoutPreviewExercise[] = [];
  for (const item of list) {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const name = asString(record.name);
    if (!name) continue;
    const catalog = await resolveCatalogExercise(asString(record.exerciseId) || undefined, name, custom);
    resolved.push({
      name: catalog?.name ?? name,
      exerciseId: catalog?.id,
      prescription: asString(record.prescription) || "3 × 8–12",
      restSeconds: asNumber(record.restSeconds, 90) ?? 90,
      target: catalog?.target,
      found: Boolean(catalog),
    });
  }
  return resolved;
}

function confirmation(tool: PendingWrite["tool"], write: PendingWrite, preview: Record<string, unknown>): CoachToolResult {
  return {
    data: {
      status: "needs_confirmation",
      tool,
      preview,
      message: "Show a confirmation_card. Do not claim this was saved yet.",
      write,
    },
    pendingWrite: write,
  };
}

export async function executeCoachTool(
  name: string,
  rawArgs: Record<string, unknown> | undefined,
  data: UserDataContextValue,
): Promise<CoachToolResult> {
  const args = rawArgs ?? {};
  try {
    switch (name) {
      case "get_user_profile":
        return { data: profileSnapshot(data) };
      case "get_workout_history":
        return { data: historySnapshot(data, asNumber(args.limit, 12), asNumber(args.weeks)) };
      case "get_workout":
        return { data: workoutSnapshot(data, asString(args.id)) };
      case "get_current_program":
        return { data: programSnapshot(data) };
      case "get_exercise": {
        const exercise = await resolveCatalogExercise(asString(args.id) || undefined, asString(args.name) || undefined, data.customExercises);
        return { data: exercise ? compactExercise(exercise) : { error: "Exercise not found in the catalog." } };
      }
      case "search_exercises": {
        const results = await fetchExercises({
          q: asString(args.query) || asString(args.muscle),
          muscle: asString(args.muscle) || undefined,
          equipment: asString(args.equipment) || undefined,
          limit: 8,
        });
        return {
          data: {
            total: results.total,
            items: results.items.slice(0, 8).map(compactExercise),
          },
        };
      }
      case "show_body_map": {
        const muscles = asStringArray(args.muscles);
        const single = asString(args.muscle);
        const names = muscles.length ? muscles : (single ? [single] : []);
        if (!names.length) return { data: { error: "Name at least one muscle or body part." } };
        const related = await fetchExercises({ q: names[0], muscle: names[0], limit: 4 });
        return {
          data: {
            title: asString(args.title) || names.join(" · "),
            muscles: names,
            related: related.items.slice(0, 3).map(compactExercise),
          },
        };
      }
      case "get_exercise_history":
        return {
          data: exerciseHistorySnapshot(
            data,
            asString(args.exerciseId) || undefined,
            asString(args.name) || undefined,
            asNumber(args.limit, 12),
          ),
        };
      case "get_personal_records":
        return {
          data: recordsSnapshot(
            data,
            asString(args.exercise) || undefined,
            asString(args.month) || undefined,
            asNumber(args.limit, 8),
          ),
        };
      case "get_muscle_volume":
        return {
          data: muscleVolumeSnapshot(data, asString(args.muscle) || undefined, asNumber(args.weeks, 4)),
        };
      case "get_training_volume":
        return { data: trainingVolumeSnapshot(data, asNumber(args.weeks, 8)) };
      case "get_progress_data":
        return {
          data: progressSnapshot(
            data,
            asString(args.exerciseId) || undefined,
            asString(args.name) || undefined,
            asNumber(args.weeks, 8),
          ),
        };
      case "get_body_measurements":
        return { data: measurementsSnapshot(data, asNumber(args.limit, 24)) };
      case "get_recent_workouts":
        return { data: historySnapshot(data, asNumber(args.limit, 5)) };
      case "calculate_estimated_1rm": {
        const weight = asNumber(args.weight, 0) ?? 0;
        const reps = asNumber(args.reps, 0) ?? 0;
        return {
          data: {
            exercise: asString(args.exercise) || undefined,
            weight,
            reps,
            estimated1RM: estimated1RM(weight, reps),
            formula: "Epley: weight × (1 + reps / 30)",
          },
        };
      }
      case "create_workout": {
        const exercises = await previewExercises(args.exercises, data.customExercises);
        const payload = {
          name: asString(args.name) || "New workout",
          focus: asString(args.focus) || exercises.map((item) => item.target).filter(Boolean).slice(0, 3).join(" · ") || "Custom session",
          duration: asNumber(args.duration, 45) ?? 45,
          exercises,
        };
        return confirmation("create_workout", { tool: "create_workout", payload }, payload);
      }
      case "update_workout": {
        const workoutId = asString(args.workoutId);
        const workout = data.workouts.find((item) => item.id === workoutId);
        if (!workout) return { data: { error: "Workout not found." } };
        const exercises = args.exercises ? await previewExercises(args.exercises, data.customExercises) : undefined;
        const payload = {
          workoutId,
          name: asString(args.name) || undefined,
          focus: asString(args.focus) || undefined,
          duration: asNumber(args.duration),
          exercises,
        };
        return confirmation("update_workout", { tool: "update_workout", payload }, { current: workout.name, ...payload });
      }
      case "create_exercise": {
        const payload = {
          name: asString(args.name),
          target: asString(args.target) || "chest",
          secondaryMuscles: asStringArray(args.secondaryMuscles),
          equipment: asString(args.equipment) || "other",
          bodyPart: asString(args.bodyPart) || "other",
          instructions: asStringArray(args.instructions),
        };
        return confirmation("create_exercise", { tool: "create_exercise", payload }, payload);
      }
      case "update_exercise": {
        const exerciseId = asString(args.exerciseId);
        const custom = data.customExercises.find((item) => item.id === exerciseId);
        if (!custom) return { data: { error: "Only custom exercises can be updated." } };
        const payload = {
          exerciseId,
          name: asString(args.name) || undefined,
          target: asString(args.target) || undefined,
          secondaryMuscles: args.secondaryMuscles ? asStringArray(args.secondaryMuscles) : undefined,
          equipment: asString(args.equipment) || undefined,
          bodyPart: asString(args.bodyPart) || undefined,
          instructions: args.instructions ? asStringArray(args.instructions) : undefined,
        };
        return confirmation("update_exercise", { tool: "update_exercise", payload }, payload);
      }
      case "add_exercise_to_workout": {
        const workoutId = asString(args.workoutId);
        const workout = data.workouts.find((item) => item.id === workoutId);
        if (!workout) return { data: { error: "Workout not found." } };
        const payload = {
          workoutId,
          exerciseId: asString(args.exerciseId) || undefined,
          exerciseName: asString(args.exerciseName),
          prescription: asString(args.prescription) || "3 × 8–12",
          restSeconds: asNumber(args.restSeconds, 90) ?? 90,
        };
        return confirmation("add_exercise_to_workout", { tool: "add_exercise_to_workout", payload }, { workout: workout.name, ...payload });
      }
      case "delete_exercise_from_workout": {
        const workoutId = asString(args.workoutId);
        const { workout, exercise } = findWorkoutExercise(
          data,
          workoutId,
          asString(args.exerciseName),
          asString(args.workoutExerciseId) || undefined,
        );
        if (!workout) return { data: { error: "Workout not found." } };
        if (!exercise) return { data: { error: "Exercise not found on that workout." } };
        const payload = {
          workoutId,
          workoutExerciseId: exercise.id,
          exerciseName: exercise.name,
        };
        return confirmation("delete_exercise_from_workout", { tool: "delete_exercise_from_workout", payload }, payload);
      }
      case "create_program": {
        const payload = {
          name: asString(args.name) || "Training block",
          schedule: (Array.isArray(args.schedule) ? args.schedule : []).map((item) => {
            const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
            return {
              day: asString(record.day),
              workoutName: asString(record.workoutName) || undefined,
              label: asString(record.label) || asString(record.workoutName) || "Rest",
            };
          }),
        };
        return confirmation("create_program", { tool: "create_program", payload }, payload);
      }
      case "update_program": {
        const programId = asString(args.programId);
        const program = data.programs.find((item) => item.id === programId);
        if (!program) return { data: { error: "Program not found." } };
        const payload = {
          programId,
          name: asString(args.name) || undefined,
          schedule: args.schedule
            ? (Array.isArray(args.schedule) ? args.schedule : []).map((item) => {
                const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
                return {
                  day: asString(record.day),
                  workoutName: asString(record.workoutName) || undefined,
                  label: asString(record.label) || asString(record.workoutName) || "Rest",
                };
              })
            : undefined,
        };
        return confirmation("update_program", { tool: "update_program", payload }, payload);
      }
      case "save_body_composition": {
        const reports = reportsFromCompositionArgs(args);
        if (!reports.length) {
          return { data: { error: "No usable body composition numbers were found. Ask for the report photo or the key values." } };
        }
        const payload = { reports };
        return confirmation("save_body_composition", { tool: "save_body_composition", payload }, {
          count: reports.length,
          reports: reports.map((report) => ({
            measuredAt: report.measuredAt,
            weightKg: report.weightKg,
            bodyFatPercent: report.bodyFatPercent,
            skeletalMuscleKg: report.skeletalMuscleKg,
          })),
        });
      }
      default:
        return { data: { error: "Unknown tool." } };
    }
  } catch (error) {
    return {
      data: {
        error: error instanceof Error ? error.message : "Tool failed.",
      },
    };
  }
}

function placeholderExercise(preview: WorkoutPreviewExercise): WorkoutExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId: preview.exerciseId || crypto.randomUUID(),
    name: preview.name,
    target: preview.target || "other",
    secondary: [],
    prescription: preview.prescription,
    restSeconds: preview.restSeconds,
  };
}

async function exercisesFromPreview(
  previews: WorkoutPreviewExercise[],
  data: UserDataContextValue,
): Promise<WorkoutExercise[]> {
  const exercises: WorkoutExercise[] = [];
  for (const preview of previews) {
    const catalog = await resolveCatalogExercise(preview.exerciseId, preview.name, data.customExercises);
    if (catalog) {
      exercises.push({
        ...workoutExerciseFromCatalog(catalog, preview.restSeconds, data.videoUrlForExercise(catalog.id, catalog.name)),
        prescription: preview.prescription,
      });
    } else {
      exercises.push(placeholderExercise(preview));
    }
  }
  return exercises;
}

function emptyWeek() {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, label: "Rest" }));
}

function scheduleFromPayload(
  data: UserDataContextValue,
  schedule: Array<{ day: string; workoutName?: string; label: string }>,
): WorkoutProgram["schedule"] {
  const base = emptyWeek();
  return base.map((slot) => {
    const next = schedule.find((item) => item.day.toLowerCase().startsWith(slot.day.toLowerCase().slice(0, 3)));
    if (!next) return slot;
    const workoutName = (next.workoutName ?? next.label).trim();
    if (!workoutName || /^rest$/i.test(workoutName)) return { day: slot.day, label: "Rest" };
    const workout = data.workouts.find((item) => item.name.toLowerCase() === workoutName.toLowerCase())
      ?? data.workouts.find((item) => item.name.toLowerCase().includes(workoutName.toLowerCase()));
    return {
      day: slot.day,
      workoutDayId: workout?.id ?? "",
      label: workout?.name ?? next.label ?? workoutName,
    };
  });
}

function customInputFromWrite(payload: Extract<PendingWrite, { tool: "create_exercise" }>["payload"]): CustomExerciseInput {
  const steps = payload.instructions.length ? payload.instructions : [`Perform ${payload.name} with control.`];
  return {
    name: payload.name,
    category: "custom",
    body_part: payload.bodyPart,
    equipment: payload.equipment,
    instructions: { en: steps[0] },
    instruction_steps: { en: steps },
    muscle_group: payload.target,
    secondary_muscles: payload.secondaryMuscles,
    target: payload.target,
    image: "",
    gif_url: "",
    media_id: "",
    attribution: "Custom exercise",
    created_at: new Date().toISOString(),
  };
}

export async function applyPendingWrite(write: PendingWrite, data: UserDataContextValue) {
  switch (write.tool) {
    case "create_workout": {
      const exercises = await exercisesFromPreview(write.payload.exercises, data);
      const workout = await data.saveWorkout({
        name: write.payload.name,
        focus: write.payload.focus,
        duration: write.payload.duration,
        exercises,
      });
      return { ok: true, workoutId: workout.id, name: workout.name };
    }
    case "update_workout": {
      const patch: Partial<WorkoutDay> = {};
      if (write.payload.name) patch.name = write.payload.name;
      if (write.payload.focus) patch.focus = write.payload.focus;
      if (write.payload.duration) patch.duration = write.payload.duration;
      if (write.payload.exercises) patch.exercises = await exercisesFromPreview(write.payload.exercises, data);
      await data.patchWorkout(write.payload.workoutId, patch);
      return { ok: true, workoutId: write.payload.workoutId };
    }
    case "create_exercise": {
      const id = await data.addExerciseToCatalog(customInputFromWrite(write.payload));
      return { ok: true, exerciseId: id };
    }
    case "update_exercise": {
      const patch: Partial<Exercise> = {};
      if (write.payload.name) patch.name = write.payload.name;
      if (write.payload.target) {
        patch.target = write.payload.target;
        patch.muscle_group = write.payload.target;
      }
      if (write.payload.secondaryMuscles) patch.secondary_muscles = write.payload.secondaryMuscles;
      if (write.payload.equipment) patch.equipment = write.payload.equipment;
      if (write.payload.bodyPart) patch.body_part = write.payload.bodyPart;
      if (write.payload.instructions) {
        patch.instruction_steps = { en: write.payload.instructions };
        patch.instructions = { en: write.payload.instructions[0] ?? write.payload.name };
      }
      await data.patchCustomExercise(write.payload.exerciseId, patch);
      return { ok: true, exerciseId: write.payload.exerciseId };
    }
    case "add_exercise_to_workout": {
      const catalog = await resolveCatalogExercise(
        write.payload.exerciseId,
        write.payload.exerciseName,
        data.customExercises,
      );
      if (catalog) {
        await data.addExerciseFromCatalog(write.payload.workoutId, catalog, write.payload.restSeconds);
        return { ok: true, exercise: catalog.name };
      }
      const workout = data.workouts.find((item) => item.id === write.payload.workoutId);
      if (!workout) return { ok: false, error: "Workout not found." };
      await data.patchWorkout(write.payload.workoutId, {
        exercises: [
          ...workout.exercises,
          placeholderExercise({
            name: write.payload.exerciseName,
            prescription: write.payload.prescription || "3 × 8–12",
            restSeconds: write.payload.restSeconds ?? 90,
            found: false,
          }),
        ],
      });
      return { ok: true, exercise: write.payload.exerciseName };
    }
    case "delete_exercise_from_workout": {
      const workout = data.workouts.find((item) => item.id === write.payload.workoutId);
      if (!workout) return { ok: false, error: "Workout not found." };
      await data.patchWorkout(write.payload.workoutId, {
        exercises: workout.exercises.filter((item) => item.id !== write.payload.workoutExerciseId),
      });
      return { ok: true, removed: write.payload.exerciseName };
    }
    case "create_program": {
      const program = await data.saveProgram({
        name: write.payload.name,
        schedule: scheduleFromPayload(data, write.payload.schedule),
      });
      return { ok: true, programId: program.id };
    }
    case "update_program": {
      await data.patchProgram(write.payload.programId, {
        name: write.payload.name,
        schedule: write.payload.schedule ? scheduleFromPayload(data, write.payload.schedule) : undefined,
      });
      return { ok: true, programId: write.payload.programId };
    }
    case "save_body_composition": {
      const reports = write.payload.reports;
      const ids: string[] = [];
      for (const report of reports) {
        ids.push(await data.saveMeasurement(compositionToMeasurement(report)));
      }
      const newest = [...reports].reverse().find((report) => report.heightCm || report.age || report.sex) ?? reports.at(-1);
      if (newest) {
        const profilePatch = compositionToProfilePatch(newest);
        if (Object.keys(profilePatch).length) await data.updateUserProfile(profilePatch);
      }
      return { ok: true, count: ids.length, measurementIds: ids };
    }
    default:
      return { ok: false, error: "Unknown write." };
  }
}

export function isWriteTool(name: string) {
  return WRITE_TOOLS.has(name);
}
