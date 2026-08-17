export type CoachPageContext = {
  currentPage: string;
  currentExercise?: { id: string; name: string } | null;
  currentWorkout?: { id: string; name: string; focus?: string } | null;
  selectedMuscle?: string | null;
  selectedProgram?: { id: string; name: string } | null;
  hasFormVideo?: boolean;
};

export type CoachPart =
  | { text: string }
  | { functionCall: { id?: string; name: string; args: Record<string, unknown> } }
  | { functionResponse: { id?: string; name: string; response: Record<string, unknown> } };

export type CoachContent = {
  role: "user" | "model";
  parts: CoachPart[];
};

export type CoachAction = {
  id: string;
  label: string;
  kind: "prompt" | "navigate" | "confirm" | "dismiss";
  prompt?: string;
  href?: string;
};

export type WorkoutPreviewExercise = {
  name: string;
  exerciseId?: string;
  prescription: string;
  restSeconds: number;
  target?: string;
  found?: boolean;
};

export type PendingWrite =
  | {
      tool: "create_workout";
      payload: {
        name: string;
        focus: string;
        duration: number;
        exercises: WorkoutPreviewExercise[];
      };
    }
  | {
      tool: "update_workout";
      payload: {
        workoutId: string;
        name?: string;
        focus?: string;
        duration?: number;
        exercises?: WorkoutPreviewExercise[];
      };
    }
  | {
      tool: "create_exercise";
      payload: {
        name: string;
        target: string;
        secondaryMuscles: string[];
        equipment: string;
        bodyPart: string;
        instructions: string[];
      };
    }
  | {
      tool: "update_exercise";
      payload: {
        exerciseId: string;
        name?: string;
        target?: string;
        secondaryMuscles?: string[];
        equipment?: string;
        bodyPart?: string;
        instructions?: string[];
      };
    }
  | {
      tool: "add_exercise_to_workout";
      payload: {
        workoutId: string;
        exerciseId?: string;
        exerciseName: string;
        prescription?: string;
        restSeconds?: number;
      };
    }
  | {
      tool: "delete_exercise_from_workout";
      payload: {
        workoutId: string;
        workoutExerciseId?: string;
        exerciseName: string;
      };
    }
  | {
      tool: "create_program";
      payload: {
        name: string;
        schedule: Array<{ day: string; workoutName?: string; label: string }>;
      };
    }
  | {
      tool: "update_program";
      payload: {
        programId: string;
        name?: string;
        schedule?: Array<{ day: string; workoutName?: string; label: string }>;
      };
    };

export type CoachBlock =
  | { type: "text"; text: string }
  | {
      type: "pr_card";
      exercise: string;
      exerciseId?: string;
      weight?: number;
      reps?: number;
      value: string;
      estimated1RM?: number;
      delta?: string;
      achievedAt?: string;
    }
  | {
      type: "workout_preview";
      name: string;
      focus?: string;
      duration?: number;
      score?: number;
      exercises: WorkoutPreviewExercise[];
    }
  | {
      type: "workout_card";
      name: string;
      focus?: string;
      duration?: number;
      exerciseCount?: number;
      workoutId?: string;
    }
  | {
      type: "exercise_card";
      name: string;
      exerciseId?: string;
      target?: string;
      secondary?: string[];
      equipment?: string;
      prescription?: string;
    }
  | {
      type: "muscle_map";
      title?: string;
      exerciseNames: string[];
      muscles?: Array<{ name: string; sets: number; status?: string }>;
    }
  | {
      type: "progress_chart";
      title: string;
      unit?: string;
      points: Array<{ label: string; value: number }>;
      summary?: string;
    }
  | {
      type: "volume_chart";
      title: string;
      points: Array<{ label: string; value: number }>;
      summary?: string;
    }
  | {
      type: "recommendation_card";
      title: string;
      score?: number;
      good?: string[];
      improve?: string[];
      suggestion?: string;
    }
  | {
      type: "confirmation_card";
      title: string;
      summary: string;
      write: PendingWrite;
    }
  | {
      type: "exercise_preview";
      name: string;
      target: string;
      secondaryMuscles: string[];
      equipment: string;
      bodyPart: string;
      instructions: string[];
    }
  | { type: "actions"; items: CoachAction[] };

export type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  blocks: CoachBlock[];
};

export type CoachChatRequest = {
  contents: CoachContent[];
  pageContext: CoachPageContext;
};

export type CoachChatResponse = {
  text?: string;
  functionCalls?: Array<{ id?: string; name: string; args: Record<string, unknown> }>;
  modelContent?: CoachContent;
  error?: string;
};

export const WRITE_TOOLS = new Set([
  "create_workout",
  "update_workout",
  "create_exercise",
  "update_exercise",
  "add_exercise_to_workout",
  "delete_exercise_from_workout",
  "create_program",
  "update_program",
]);

export const TOOL_THINKING: Record<string, string> = {
  get_user_profile: "Checking your training profile…",
  get_workout_history: "Reading your training history…",
  get_workout: "Opening this workout…",
  get_current_program: "Checking your current program…",
  get_exercise: "Looking up this exercise…",
  search_exercises: "Searching the exercise library…",
  get_exercise_history: "Reviewing this lift’s history…",
  get_personal_records: "Checking your personal records…",
  get_muscle_volume: "Comparing your muscle volume…",
  get_training_volume: "Checking your training volume…",
  get_progress_data: "Analyzing your last 8 weeks…",
  get_body_measurements: "Reading your body check-ins…",
  get_recent_workouts: "Reviewing recent sessions…",
  calculate_estimated_1rm: "Estimating your 1RM…",
  create_workout: "Drafting a workout…",
  update_workout: "Preparing workout changes…",
  create_exercise: "Drafting exercise details…",
  update_exercise: "Preparing exercise updates…",
  add_exercise_to_workout: "Finding a movement to add…",
  delete_exercise_from_workout: "Preparing to remove an exercise…",
  create_program: "Drafting a program…",
  update_program: "Preparing program changes…",
};
