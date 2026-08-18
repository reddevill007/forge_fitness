import type { FunctionDeclaration } from "@google/genai";

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });

export const COACH_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_user_profile",
    description: "Get the athlete profile: name, goal, rest defaults, units.",
    parametersJsonSchema: object({}),
  },
  {
    name: "get_workout_history",
    description: "Get logged workout sessions with sets, reps, weight, and volume. Use for history, consistency, and recent training questions.",
    parametersJsonSchema: object({
      limit: num("Max sessions to return. Default 12, max 30."),
      weeks: num("Only include sessions from the last N weeks."),
    }),
  },
  {
    name: "get_workout",
    description: "Get one saved workout by id, including exercises and recent sessions of that workout.",
    parametersJsonSchema: object({ id: str("Workout id") }, ["id"]),
  },
  {
    name: "get_current_program",
    description: "Get the active training program and weekly schedule.",
    parametersJsonSchema: object({}),
  },
  {
    name: "get_exercise",
    description: "Get catalog or custom exercise details by id or name: muscles, equipment, instructions.",
    parametersJsonSchema: object({
      id: str("Exercise id if known"),
      name: str("Exercise name to look up if id is unknown"),
    }),
  },
  {
    name: "search_exercises",
    description: "Search the exercise catalog by name, muscle, or equipment.",
    parametersJsonSchema: object({
      query: str("Search text"),
      muscle: str("Optional muscle filter"),
      equipment: str("Optional equipment filter"),
    }),
  },
  {
    name: "get_exercise_history",
    description: "Get logged sets over time for one exercise, including best set and weight trend.",
    parametersJsonSchema: object({
      exerciseId: str("Catalog exercise id if known"),
      name: str("Exercise name if id is unknown"),
      limit: num("Max sessions, default 12"),
    }),
  },
  {
    name: "get_personal_records",
    description: "Get personal records derived from logged sets and any manual PRs.",
    parametersJsonSchema: object({
      exercise: str("Optional exercise name filter"),
      month: str("Optional YYYY-MM to filter PRs hit that month"),
      limit: num("Max PRs, default 8"),
    }),
  },
  {
    name: "get_muscle_volume",
    description: "Get weekly set volume by muscle from logged training, plus exercises used.",
    parametersJsonSchema: object({
      muscle: str("Optional muscle name to focus on"),
      weeks: num("Lookback weeks, default 4"),
    }),
  },
  {
    name: "get_training_volume",
    description: "Get weekly and monthly training volume, session count, and set count.",
    parametersJsonSchema: object({
      weeks: num("Lookback weeks, default 8"),
    }),
  },
  {
    name: "get_progress_data",
    description: "Get progress trends: weekly volume, optional exercise load over weeks, and PR changes.",
    parametersJsonSchema: object({
      exerciseId: str("Optional exercise id"),
      name: str("Optional exercise name"),
      weeks: num("Lookback weeks, default 8"),
    }),
  },
  {
    name: "get_body_measurements",
    description: "Get body-weight check-ins, tape measurements, and calculated BMI, calories, and protein when body specs exist.",
    parametersJsonSchema: object({
      limit: num("Max entries, default 12"),
    }),
  },
  {
    name: "get_recent_workouts",
    description: "Get the most recent logged sessions, condensed.",
    parametersJsonSchema: object({
      limit: num("Max sessions, default 5"),
    }),
  },
  {
    name: "calculate_estimated_1rm",
    description: "Estimate one-rep max with the Epley formula from a logged or proposed set.",
    parametersJsonSchema: object({
      weight: num("Weight in kilograms"),
      reps: num("Repetitions"),
      exercise: str("Optional exercise name for context"),
    }, ["weight", "reps"]),
  },
  {
    name: "create_workout",
    description: "Prepare a new workout. Does not save until the athlete confirms in the UI.",
    parametersJsonSchema: object({
      name: str("Workout name, e.g. Push A"),
      focus: str("Focus string, e.g. Chest · Shoulders · Triceps"),
      duration: num("Estimated minutes"),
      exercises: {
        type: "array",
        items: object({
          name: str("Exercise name from the catalog when possible"),
          prescription: str("e.g. 3 × 8–12"),
          restSeconds: num("Rest between sets"),
        }, ["name", "prescription"]),
      },
    }, ["name", "exercises"]),
  },
  {
    name: "update_workout",
    description: "Prepare updates to an existing workout. Does not save until confirmed.",
    parametersJsonSchema: object({
      workoutId: str("Workout id"),
      name: str("New name"),
      focus: str("New focus"),
      duration: num("New duration minutes"),
      exercises: {
        type: "array",
        description: "If provided, replaces the full exercise list",
        items: object({
          name: str("Exercise name"),
          prescription: str("Sets × reps"),
          restSeconds: num("Rest seconds"),
        }, ["name", "prescription"]),
      },
    }, ["workoutId"]),
  },
  {
    name: "create_exercise",
    description: "Prepare a custom exercise. Does not save until confirmed.",
    parametersJsonSchema: object({
      name: str("Exercise name"),
      target: str("Primary muscle"),
      secondaryMuscles: { type: "array", items: { type: "string" } },
      equipment: str("Equipment"),
      bodyPart: str("Body part"),
      instructions: { type: "array", items: { type: "string" } },
    }, ["name", "target"]),
  },
  {
    name: "update_exercise",
    description: "Prepare updates to a custom exercise. Catalog exercises cannot be overwritten. Does not save until confirmed.",
    parametersJsonSchema: object({
      exerciseId: str("Custom exercise id"),
      name: str("New name"),
      target: str("Primary muscle"),
      secondaryMuscles: { type: "array", items: { type: "string" } },
      equipment: str("Equipment"),
      bodyPart: str("Body part"),
      instructions: { type: "array", items: { type: "string" } },
    }, ["exerciseId"]),
  },
  {
    name: "add_exercise_to_workout",
    description: "Prepare adding one exercise to a workout. Does not save until confirmed.",
    parametersJsonSchema: object({
      workoutId: str("Workout id"),
      exerciseName: str("Exercise to add"),
      exerciseId: str("Catalog id if known"),
      prescription: str("Sets × reps"),
      restSeconds: num("Rest seconds"),
    }, ["workoutId", "exerciseName"]),
  },
  {
    name: "delete_exercise_from_workout",
    description: "Prepare removing an exercise from a workout. Does not save until confirmed.",
    parametersJsonSchema: object({
      workoutId: str("Workout id"),
      workoutExerciseId: str("Row id on the workout if known"),
      exerciseName: str("Exercise name to remove"),
    }, ["workoutId"]),
  },
  {
    name: "create_program",
    description: "Prepare a weekly program. Does not save until confirmed.",
    parametersJsonSchema: object({
      name: str("Program name"),
      schedule: {
        type: "array",
        items: object({
          day: str("Mon, Tue, Wed, Thu, Fri, Sat, or Sun"),
          workoutName: str("Existing workout name, or Rest"),
          label: str("Day label"),
        }, ["day"]),
      },
    }, ["name", "schedule"]),
  },
  {
    name: "update_program",
    description: "Prepare program updates. Does not save until confirmed.",
    parametersJsonSchema: object({
      programId: str("Program id"),
      name: str("New name"),
      schedule: {
        type: "array",
        items: object({
          day: str("Weekday"),
          workoutName: str("Workout name or Rest"),
          label: str("Label"),
        }, ["day"]),
      },
    },     ["programId"]),
  },
];
