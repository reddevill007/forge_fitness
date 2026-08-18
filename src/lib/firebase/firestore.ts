import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
  deleteField,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/src/lib/firebase/client";
import { resolveDatasetMedia } from "@/src/lib/dataset-media";
import type {
  BodyMeasurement,
  Exercise,
  PersonalRecord,
  WorkoutDay,
  WorkoutExercise,
  WorkoutExerciseAlternative,
  WorkoutProgram,
  WorkoutSession,
} from "@/src/types/fitness";
import type {
  ActiveSessionProgress,
  ExerciseMediaDoc,
  StoredProgram,
  StoredSession,
  StoredWorkout,
  UserProfile,
} from "@/src/lib/firebase/types";

function db() {
  const firestore = getFirebaseDb();
  if (!firestore) throw new Error("Firebase is not configured");
  return firestore;
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => omitUndefined(item)) as T;
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      next[key] = omitUndefined(item);
    }
    return next as T;
  }
  return value;
}

function userRef(uid: string) {
  return doc(db(), "users", uid);
}

function workoutsRef(uid: string) {
  return collection(db(), "users", uid, "workouts");
}

function sessionsRef(uid: string) {
  return collection(db(), "users", uid, "sessions");
}

function recordsRef(uid: string) {
  return collection(db(), "users", uid, "records");
}

function measurementsRef(uid: string) {
  return collection(db(), "users", uid, "measurements");
}

function programsRef(uid: string) {
  return collection(db(), "users", uid, "programs");
}

function exerciseMediaRef(uid: string, exerciseId: string) {
  return doc(db(), "users", uid, "exerciseMedia", exerciseId);
}

function customExercisesRef(uid: string) {
  return collection(db(), "users", uid, "customExercises");
}

function activeSessionRef(uid: string) {
  return doc(db(), "users", uid, "state", "activeSession");
}

function nowIso() {
  return new Date().toISOString();
}

function defaultProfile(email: string, displayName: string): UserProfile {
  return {
    displayName: displayName || email.split("@")[0] || "Athlete",
    email,
    goal: "hypertrophy",
    weightUnit: "kg",
    defaultRest: 90,
    autoStartRest: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export async function ensureUserProfile(uid: string, email: string, displayName: string) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;
  const profile = defaultProfile(email, displayName);
  await setDoc(ref, profile);
  return profile;
}

export function subscribeProfile(uid: string, onChange: (profile: UserProfile | null) => void): Unsubscribe {
  return onSnapshot(userRef(uid), (snap) => {
    onChange(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

export async function updateProfile(uid: string, patch: Partial<UserProfile>) {
  await updateDoc(userRef(uid), { ...patch, updatedAt: nowIso() });
}

export function subscribeWorkouts(uid: string, onChange: (workouts: StoredWorkout[]) => void): Unsubscribe {
  const q = query(workoutsRef(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredWorkout, "id">) })));
  });
}

export async function createWorkout(uid: string, input: Pick<WorkoutDay, "name" | "focus" | "duration" | "exercises">) {
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const workout: StoredWorkout = {
    id,
    ...input,
    active: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(workoutsRef(uid), id), omitUndefined(workout));
  return workout;
}

export async function updateWorkout(uid: string, workoutId: string, patch: Partial<WorkoutDay>) {
  await updateDoc(doc(workoutsRef(uid), workoutId), omitUndefined({ ...patch, updatedAt: nowIso() }));
}

export async function trashWorkout(uid: string, workoutId: string) {
  await updateDoc(doc(workoutsRef(uid), workoutId), {
    deletedAt: nowIso(),
    active: false,
    updatedAt: nowIso(),
  });
}

export async function restoreWorkout(uid: string, workoutId: string) {
  await updateDoc(doc(workoutsRef(uid), workoutId), {
    deletedAt: deleteField(),
    updatedAt: nowIso(),
  });
}

export async function deleteWorkout(uid: string, workoutId: string) {
  await deleteDoc(doc(workoutsRef(uid), workoutId));
}

export async function setActiveWorkout(uid: string, workoutId: string) {
  const batch = writeBatch(db());
  const workoutsSnap = await getDocs(workoutsRef(uid));
  workoutsSnap.docs.forEach((d) => {
    batch.update(d.ref, { active: d.id === workoutId, updatedAt: nowIso() });
  });
  await batch.commit();
}

export function subscribePrograms(uid: string, onChange: (programs: StoredProgram[]) => void): Unsubscribe {
  const q = query(programsRef(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredProgram, "id">) })));
  });
}

export async function createProgram(uid: string, input: Pick<WorkoutProgram, "name" | "schedule">) {
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const program: StoredProgram = {
    id,
    name: input.name,
    active: false,
    schedule: input.schedule,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(doc(programsRef(uid), id), program);
  return program;
}

export async function updateProgram(uid: string, programId: string, patch: Partial<WorkoutProgram>) {
  await updateDoc(doc(programsRef(uid), programId), { ...patch, updatedAt: nowIso() });
}

export async function trashProgram(uid: string, programId: string) {
  await updateDoc(doc(programsRef(uid), programId), {
    deletedAt: nowIso(),
    active: false,
    updatedAt: nowIso(),
  });
}

export async function restoreProgram(uid: string, programId: string) {
  await updateDoc(doc(programsRef(uid), programId), {
    deletedAt: deleteField(),
    updatedAt: nowIso(),
  });
}

export async function deleteProgram(uid: string, programId: string) {
  await deleteDoc(doc(programsRef(uid), programId));
}

export async function setActiveProgram(uid: string, programId: string) {
  const batch = writeBatch(db());
  const programsSnap = await getDocs(programsRef(uid));
  programsSnap.docs.forEach((d) => {
    batch.update(d.ref, { active: d.id === programId, updatedAt: nowIso() });
  });
  await batch.commit();
}

export function subscribeSessions(uid: string, onChange: (sessions: StoredSession[]) => void): Unsubscribe {
  const q = query(sessionsRef(uid), orderBy("startedAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredSession, "id">) })));
  });
}

export async function saveSession(uid: string, session: Omit<StoredSession, "id"> & { id?: string }) {
  const id = session.id ?? crypto.randomUUID();
  await setDoc(doc(sessionsRef(uid), id), { ...session, id });
  return id;
}

export function subscribeRecords(uid: string, onChange: (records: PersonalRecord[]) => void): Unsubscribe {
  const q = query(recordsRef(uid), orderBy("achievedAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PersonalRecord, "id">) })));
  });
}

export async function addRecord(uid: string, record: Omit<PersonalRecord, "id">) {
  const id = crypto.randomUUID();
  await setDoc(doc(recordsRef(uid), id), { ...record, id });
  return id;
}

export function subscribeMeasurements(uid: string, onChange: (items: BodyMeasurement[]) => void): Unsubscribe {
  const q = query(measurementsRef(uid), orderBy("measuredAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BodyMeasurement, "id">) })));
  });
}

export async function addMeasurement(uid: string, measurement: Omit<BodyMeasurement, "id">) {
  const id = crypto.randomUUID();
  await setDoc(doc(measurementsRef(uid), id), { ...measurement, id });
  return id;
}

export async function getExerciseMedia(uid: string, exerciseId: string) {
  const snap = await getDoc(exerciseMediaRef(uid, exerciseId));
  return snap.exists() ? (snap.data() as ExerciseMediaDoc) : null;
}

export async function setExerciseMedia(uid: string, exerciseId: string, videoUrl: string) {
  const doc: ExerciseMediaDoc = { videoUrl, updatedAt: nowIso() };
  await setDoc(exerciseMediaRef(uid, exerciseId), doc);
  return doc;
}

export function subscribeCustomExercises(uid: string, onChange: (items: Exercise[]) => void): Unsubscribe {
  return onSnapshot(customExercisesRef(uid), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, "id">) })));
  });
}

export async function addCustomExercise(uid: string, exercise: Omit<Exercise, "id"> & { id?: string }) {
  const id = exercise.id ?? crypto.randomUUID();
  await setDoc(doc(customExercisesRef(uid), id), { ...exercise, id, created_at: nowIso() });
  return id;
}

export async function updateCustomExercise(uid: string, exerciseId: string, patch: Partial<Exercise>) {
  await updateDoc(doc(customExercisesRef(uid), exerciseId), patch);
}

function exerciseMediaCollection(uid: string) {
  return collection(db(), "users", uid, "exerciseMedia");
}

export function subscribeExerciseMedia(uid: string, onChange: (media: Record<string, string>) => void): Unsubscribe {
  return onSnapshot(exerciseMediaCollection(uid), (snap) => {
    const media: Record<string, string> = {};
    snap.docs.forEach((item) => {
      const url = (item.data() as ExerciseMediaDoc).videoUrl?.trim();
      if (url) media[item.id] = url;
    });
    onChange(media);
  });
}

export function rememberedExerciseVideoUrl(
  exerciseId: string,
  name: string | undefined,
  workouts: Array<{ exercises: WorkoutExercise[] }>,
  options: {
    media?: Record<string, string>;
    customExercises?: Array<{ id: string; name: string; videoUrl?: string }>;
  } = {},
) {
  const needle = name?.trim().toLowerCase();
  const relatedIds = new Set<string>([exerciseId]);
  const rows = workouts.flatMap((workout) => workout.exercises);
  if (needle) {
    for (const item of rows) {
      if (item.name.trim().toLowerCase() === needle) relatedIds.add(item.exerciseId);
    }
    for (const custom of options.customExercises ?? []) {
      if (custom.name.trim().toLowerCase() === needle) relatedIds.add(custom.id);
    }
  }

  for (const id of relatedIds) {
    const fromMedia = options.media?.[id]?.trim();
    if (fromMedia) return fromMedia;
  }

  const fromRow = rows.find((item) => {
    if (!item.videoUrl?.trim()) return false;
    return item.exerciseId === exerciseId || (Boolean(needle) && item.name.trim().toLowerCase() === needle);
  });
  if (fromRow?.videoUrl?.trim()) return fromRow.videoUrl.trim();

  return options.customExercises?.find((item) => {
    if (!item.videoUrl?.trim()) return false;
    return item.id === exerciseId || (Boolean(needle) && item.name.trim().toLowerCase() === needle);
  })?.videoUrl?.trim() || undefined;
}

export function workoutExerciseFromCatalog(
  exercise: Exercise,
  restSeconds = 90,
  rememberedVideo?: string,
): WorkoutExercise {
  const row: WorkoutExercise = {
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    name: exercise.name,
    target: exercise.target,
    secondary: exercise.secondary_muscles ?? [],
    prescription: "3 × 8–12",
    restSeconds,
  };
  const mediaId = exercise.media_id?.trim();
  const videoUrl = rememberedVideo?.trim() || exercise.videoUrl?.trim();
  const gifUrl = resolveDatasetMedia(exercise.gif_url);
  const imageUrl = resolveDatasetMedia(exercise.image);
  if (mediaId) row.mediaId = mediaId;
  if (videoUrl) row.videoUrl = videoUrl;
  if (gifUrl) row.gifUrl = gifUrl;
  if (imageUrl) row.imageUrl = imageUrl;
  return row;
}

export function workoutAlternativeFromCatalog(
  exercise: Exercise,
  rememberedVideo?: string,
): WorkoutExerciseAlternative {
  const alt: WorkoutExerciseAlternative = {
    exerciseId: exercise.id,
    name: exercise.name,
    target: exercise.target,
    secondary: exercise.secondary_muscles ?? [],
  };
  const mediaId = exercise.media_id?.trim();
  const videoUrl = rememberedVideo?.trim() || exercise.videoUrl?.trim();
  const gifUrl = resolveDatasetMedia(exercise.gif_url);
  const imageUrl = resolveDatasetMedia(exercise.image);
  if (mediaId) alt.mediaId = mediaId;
  if (videoUrl) alt.videoUrl = videoUrl;
  if (gifUrl) alt.gifUrl = gifUrl;
  if (imageUrl) alt.imageUrl = imageUrl;
  return alt;
}

export type PendingSession = {
  workout: StoredWorkout;
  startedAt: string;
  durationSeconds: number;
  exerciseSessions: WorkoutSession["exerciseSessions"];
};

export function subscribeActiveSession(uid: string, onChange: (session: ActiveSessionProgress | null) => void): Unsubscribe {
  return onSnapshot(
    activeSessionRef(uid),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as ActiveSessionProgress) : null);
    },
    () => {
      // Keep local drafts if Firestore is unreachable.
    },
  );
}

export async function saveActiveSession(uid: string, progress: ActiveSessionProgress | Omit<ActiveSessionProgress, "updatedAt">) {
  const payload: ActiveSessionProgress = {
    ...progress,
    updatedAt: "updatedAt" in progress && progress.updatedAt ? progress.updatedAt : nowIso(),
  };
  await setDoc(activeSessionRef(uid), payload);
  return payload;
}

export async function clearActiveSession(uid: string) {
  await deleteDoc(activeSessionRef(uid)).catch(() => undefined);
}

export async function finalizeWorkoutSession(uid: string, pending: PendingSession) {
  const session: Omit<StoredSession, "id"> = {
    workoutDayId: pending.workout.id,
    workoutName: pending.workout.name,
    focus: pending.workout.focus,
    startedAt: pending.startedAt,
    completedAt: nowIso(),
    durationSeconds: pending.durationSeconds,
    exerciseSessions: pending.exerciseSessions,
  };
  const id = await saveSession(uid, session);
  await clearActiveSession(uid);
  return id;
}
