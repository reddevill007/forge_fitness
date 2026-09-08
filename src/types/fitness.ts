export type Exercise = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  media_id: string;
  attribution: string;
  created_at: string;
  videoUrl?: string;
  customMedia?: ExerciseMedia;
};

export type CustomExerciseInput = Omit<Exercise, "id"> & {
  gifFile?: File | null;
  imageFile?: File | null;
};

export type ExerciseMedia = {
  id: string;
  exerciseId: string;
  kind: "dataset-gif" | "dataset-thumbnail" | "user-video";
  url: string;
  isDefault?: boolean;
  private?: boolean;
};

export type SetLog = {
  id: string;
  setNumber: number;
  kind: "warmup" | "working" | "drop";
  weight: number;
  reps: number;
  rir: number;
  rpe?: number;
  restSeconds: number;
  completed: boolean;
  notes?: string;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  target: string;
  secondary: string[];
  prescription: string;
  targetWeight?: number;
  restSeconds: number;
  optional?: boolean;
  supersetId?: string;
  mediaId?: string;
  videoUrl?: string;
  gifUrl?: string;
  imageUrl?: string;
  alternatives?: WorkoutExerciseAlternative[];
};

export type WorkoutExerciseAlternative = {
  exerciseId: string;
  name: string;
  target?: string;
  secondary?: string[];
  mediaId?: string;
  videoUrl?: string;
  gifUrl?: string;
  imageUrl?: string;
};

export type WorkoutDay = {
  id: string;
  name: string;
  focus: string;
  duration: number;
  exercises: WorkoutExercise[];
};

export type WorkoutProgram = {
  id: string;
  name: string;
  active: boolean;
  schedule: Array<{ day: string; workoutDayId?: string; label: string }>;
};

export type ExerciseSession = {
  id: string;
  workoutExerciseId: string;
  exerciseId?: string;
  exerciseName?: string;
  sets: SetLog[];
  notes?: string;
};

export type WorkoutSession = {
  id: string;
  workoutDayId: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  exerciseSessions: ExerciseSession[];
  notes?: string;
};

export type PersonalRecord = {
  id: string;
  exerciseId: string;
  exercise: string;
  type: "strength" | "reps" | "volume";
  value: string;
  achievedAt: string;
};

export type BodyPhotoPose = "front" | "side" | "back";

export type BodyPhoto = {
  id: string;
  url: string;
  path: string;
  pose: BodyPhotoPose;
  takenAt: string;
  createdAt: string;
  weight?: number;
};

export type BodyMeasurementSource = "manual" | "scan" | "chat";

export type BodySegmentMass = {
  muscleKg?: number;
  fatKg?: number;
};

export type BodyMeasurement = {
  id: string;
  measuredAt: string;
  source?: BodyMeasurementSource;
  weight?: number;
  bodyFat?: number;
  waist?: number;
  hips?: number;
  chest?: number;
  arms?: number;
  thighs?: number;
  calves?: number;
  moistureKg?: number;
  proteinKg?: number;
  mineralKg?: number;
  fatKg?: number;
  fatFreeMassKg?: number;
  skeletalMuscleKg?: number;
  bmi?: number;
  waistHipRatio?: number;
  subcutaneousFatKg?: number;
  visceralFatIndex?: number;
  obesityType?: string;
  targetWeightKg?: number;
  weightControlKg?: number;
  fatControlKg?: number;
  muscleControlKg?: number;
  basalMetabolismKcal?: number;
  healthScore?: number;
  bodyAge?: number;
  segmental?: {
    leftArm?: BodySegmentMass;
    rightArm?: BodySegmentMass;
    trunk?: BodySegmentMass;
    leftLeg?: BodySegmentMass;
    rightLeg?: BodySegmentMass;
  };
};
