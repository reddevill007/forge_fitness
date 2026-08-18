import type {
  BodyMeasurement,
  PersonalRecord,
  WorkoutDay,
  WorkoutProgram,
  WorkoutSession,
} from "@/src/types/fitness";

export type BodySex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type UserProfile = {
  displayName: string;
  email: string;
  goal: "hypertrophy" | "strength" | "general";
  weightUnit: "kg" | "lb";
  defaultRest: number;
  autoStartRest: boolean;
  heightCm?: number;
  age?: number;
  sex?: BodySex;
  activityLevel?: ActivityLevel;
  createdAt: string;
  updatedAt: string;
};

export type StoredWorkout = WorkoutDay & {
  active?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredProgram = WorkoutProgram & {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export function isTrashed(item: { deletedAt?: string }) {
  return Boolean(item.deletedAt);
}

export type StoredSession = WorkoutSession & {
  workoutName: string;
  focus: string;
};

export type ActiveSessionProgress = {
  workoutId: string;
  workoutName: string;
  focus: string;
  startedAt: string;
  durationSeconds: number;
  exerciseIndex: number;
  exerciseSessions: WorkoutSession["exerciseSessions"];
  updatedAt: string;
};

export type ExerciseMediaDoc = {
  videoUrl: string;
  updatedAt: string;
};

export type UserData = {
  profile: UserProfile | null;
  workouts: StoredWorkout[];
  programs: StoredProgram[];
  sessions: StoredSession[];
  records: PersonalRecord[];
  measurements: BodyMeasurement[];
  loading: boolean;
};
