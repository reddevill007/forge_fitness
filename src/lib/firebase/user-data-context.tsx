"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/src/lib/firebase/auth-context";
import {
  addBodyPhoto,
  addCustomExercise,
  addMeasurement,
  addRecord,
  createProgram,
  createWorkout,
  deleteBodyPhotoDoc,
  deleteProgram,
  deleteWorkout,
  restoreProgram,
  restoreWorkout,
  trashProgram,
  trashWorkout,
  clearActiveSession,
  saveActiveSession,
  saveSession,
  setActiveProgram,
  setActiveWorkout,
  setExerciseMedia,
  subscribeActiveSession,
  subscribeBodyPhotos,
  subscribeCustomExercises,
  subscribeExerciseMedia,
  subscribeMeasurements,
  subscribeProfile,
  subscribePrograms,
  subscribeRecords,
  subscribeSessions,
  subscribeWorkouts,
  rememberedExerciseVideoUrl,
  updateCustomExercise,
  updateProfile,
  updateProgram,
  updateWorkout,
  workoutExerciseFromCatalog,
  type PendingSession,
} from "@/src/lib/firebase/firestore";
import type { ActiveSessionProgress, StoredProgram, StoredSession, StoredWorkout, UserProfile } from "@/src/lib/firebase/types";
import { isTrashed } from "@/src/lib/firebase/types";
import type { BodyMeasurement, BodyPhoto, CustomExerciseInput, Exercise, PersonalRecord, WorkoutDay, WorkoutProgram } from "@/src/types/fitness";
import { deleteStoredFile, uploadBodyPhoto, uploadCustomExerciseMedia } from "@/src/lib/firebase/storage";
import { newRecordsToSave, recordsFromTraining, stampExerciseSessions, elapsedSeconds } from "@/src/lib/firebase/stats";
import {
  enqueueOutbox,
  flushOutbox,
  isBrowserOnline,
  loadLocalSessionState,
  mergeSessionState,
  pendingOutboxForUser,
  saveLocalSessionState,
  type OfflineOutboxItem,
} from "@/src/lib/offline-sync";

function sessionSyncKey(session: StoredSession) {
  return [
    session.id,
    session.startedAt,
    session.completedAt ?? "",
    String(session.durationSeconds),
    session.workoutName,
    session.focus,
    session.notes ?? "",
    session.exerciseSessions.map((exercise) => [
      exercise.exerciseName ?? "",
      exercise.notes ?? "",
      exercise.sets.map((set) => `${set.kind}:${set.weight}:${set.reps}:${set.rir}`).join(","),
    ].join("|")).join(";"),
  ].join("::");
}

export type UserDataContextValue = {
  profile: UserProfile | null;
  workouts: StoredWorkout[];
  programs: StoredProgram[];
  trashedWorkouts: StoredWorkout[];
  trashedPrograms: StoredProgram[];
  sessions: StoredSession[];
  records: PersonalRecord[];
  measurements: BodyMeasurement[];
  bodyPhotos: BodyPhoto[];
  customExercises: Exercise[];
  activeWorkout: StoredWorkout | null;
  activeProgram: StoredProgram | null;
  todaysWorkout: StoredWorkout | null;
  activeSession: ActiveSessionProgress | null;
  activeSessionLoaded: boolean;
  activeSessionPendingSync: boolean;
  pendingSyncCount: number;
  syncing: boolean;
  loading: boolean;
  updateUserProfile: (patch: Partial<UserProfile>) => Promise<void>;
  saveActiveSessionProgress: (progress: Omit<ActiveSessionProgress, "updatedAt">) => Promise<void>;
  clearActiveSessionProgress: () => Promise<void>;
  saveWorkout: (input: Pick<WorkoutDay, "name" | "focus" | "duration" | "exercises">) => Promise<StoredWorkout>;
  patchWorkout: (workoutId: string, patch: Partial<WorkoutDay>) => Promise<void>;
  trashWorkout: (workoutId: string) => Promise<void>;
  restoreWorkout: (workoutId: string) => Promise<void>;
  purgeWorkout: (workoutId: string) => Promise<void>;
  activateWorkout: (workoutId: string) => Promise<void>;
  duplicateWorkout: (workoutId: string) => Promise<StoredWorkout | null>;
  saveProgram: (input: Pick<WorkoutProgram, "name" | "schedule">) => Promise<StoredProgram>;
  patchProgram: (programId: string, patch: Partial<WorkoutProgram>) => Promise<void>;
  trashProgram: (programId: string) => Promise<void>;
  restoreProgram: (programId: string) => Promise<void>;
  purgeProgram: (programId: string) => Promise<void>;
  activateProgram: (programId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  completeSession: (pending: PendingSession) => Promise<string>;
  patchSession: (session: StoredSession) => Promise<void>;
  saveRecord: (record: Omit<PersonalRecord, "id">) => Promise<string>;
  saveMeasurement: (measurement: Omit<BodyMeasurement, "id">) => Promise<string>;
  saveBodyPhoto: (input: { file: File; pose: BodyPhoto["pose"]; takenAt: string; weight?: number }) => Promise<string>;
  deleteBodyPhoto: (photoId: string) => Promise<void>;
  saveVideoUrl: (exerciseId: string, videoUrl: string) => Promise<void>;
  videoUrlForExercise: (exerciseId: string, name?: string) => string | undefined;
  addExerciseToCatalog: (exercise: CustomExerciseInput) => Promise<string>;
  patchCustomExercise: (exerciseId: string, patch: Partial<Exercise>) => Promise<void>;
  uploadExerciseMedia: (exerciseId: string, kind: "gif" | "image", file: File) => Promise<string>;
  addExerciseFromCatalog: (workoutId: string, exercise: Exercise, restSeconds?: number) => Promise<void>;
};

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<StoredWorkout[]>([]);
  const [programs, setPrograms] = useState<StoredProgram[]>([]);
  const [remoteSessions, setRemoteSessions] = useState<StoredSession[]>([]);
  const [pendingSessions, setPendingSessions] = useState<StoredSession[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [bodyPhotos, setBodyPhotos] = useState<BodyPhoto[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [exerciseMedia, setExerciseMediaMap] = useState<Record<string, string>>({});
  const [activeSession, setActiveSession] = useState<ActiveSessionProgress | null>(null);
  const [activeSessionLoaded, setActiveSessionLoaded] = useState(false);
  const [activeSessionPendingSync, setActiveSessionPendingSync] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;
  const workoutPersistChain = useRef(Promise.resolve());

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => {
        setProfile(null);
        setWorkouts([]);
        setPrograms([]);
        setRemoteSessions([]);
        setPendingSessions([]);
        setRecords([]);
        setMeasurements([]);
        setBodyPhotos([]);
        setCustomExercises([]);
        setExerciseMediaMap({});
        setActiveSession(null);
        setActiveSessionLoaded(false);
        setActiveSessionPendingSync(false);
        setPendingSyncCount(0);
        setSyncing(false);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    const unsubscribers = [
      subscribeProfile(uid, setProfile),
      subscribeWorkouts(uid, (remote) => {
        setWorkouts((current) => mergeOptimisticExercises(current, remote));
      }),
      subscribePrograms(uid, setPrograms),
      subscribeSessions(uid, setRemoteSessions),
      subscribeRecords(uid, setRecords),
      subscribeMeasurements(uid, setMeasurements),
      subscribeBodyPhotos(uid, setBodyPhotos),
      subscribeCustomExercises(uid, setCustomExercises),
      subscribeExerciseMedia(uid, setExerciseMediaMap),
      subscribeActiveSession(uid, (remote) => {
        void loadLocalSessionState(uid).then((local) => {
          if (cancelled) return;
          setActiveSession(mergeSessionState(local, remote));
        });
      }),
    ];

    void (async () => {
      try {
        const [local, pending] = await Promise.all([
          loadLocalSessionState(uid),
          pendingOutboxForUser(uid),
        ]);
        if (cancelled) return;
        setActiveSession((current) => mergeSessionState(local, current));
        setActiveSessionPendingSync(Boolean(local?.pendingSync));
        setPendingSessions(
          pending
            .filter((item): item is Extract<OfflineOutboxItem, { kind: "complete-session" }> => item.kind === "complete-session")
            .map((item) => item.session),
        );
        setPendingSyncCount(pending.length);
      } finally {
        if (!cancelled) {
          setActiveSessionLoaded(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [uid]);

  const processOutboxItem = useCallback(async (item: OfflineOutboxItem) => {
    if (item.kind === "active-session") {
      await saveActiveSession(item.uid, item.progress);
      const local = await loadLocalSessionState(item.uid);
      if (local?.progress?.updatedAt === item.progress.updatedAt) {
        await saveLocalSessionState(item.uid, { ...local, pendingSync: false });
        if (item.uid === uid) setActiveSessionPendingSync(false);
      }
      return;
    }
    if (item.kind === "clear-active-session") {
      await clearActiveSession(item.uid);
      return;
    }
    await saveSession(item.uid, item.session);
  }, [uid]);

  const refreshPending = useCallback(async (userId: string) => {
    const pending = await pendingOutboxForUser(userId);
    setPendingSyncCount(pending.length);
    setActiveSessionPendingSync(pending.some((item) => item.kind === "active-session"));
  }, []);

  const runFlush = useCallback(async () => {
    if (!uid || !isBrowserOnline()) return;
    setSyncing(true);
    try {
      await flushOutbox(processOutboxItem, uid);
      await refreshPending(uid);
    } finally {
      setSyncing(false);
    }
  }, [processOutboxItem, refreshPending, uid]);

  useEffect(() => {
    if (!uid) return;
    const sync = () => {
      void runFlush();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    sync();
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runFlush, uid]);

  const liveWorkouts = useMemo(() => workouts.filter((workout) => !isTrashed(workout)), [workouts]);
  const livePrograms = useMemo(() => programs.filter((program) => !isTrashed(program)), [programs]);
  const trashedWorkouts = useMemo(
    () => workouts.filter(isTrashed).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")),
    [workouts],
  );
  const trashedPrograms = useMemo(
    () => programs.filter(isTrashed).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")),
    [programs],
  );
  const activeWorkout = useMemo(() => liveWorkouts.find((workout) => workout.active) ?? null, [liveWorkouts]);
  const activeProgram = useMemo(() => livePrograms.find((program) => program.active) ?? null, [livePrograms]);
  const sessions = useMemo(() => {
    const byId = new Map(remoteSessions.map((session) => [session.id, session]));
    for (const session of pendingSessions) byId.set(session.id, session);
    return [...byId.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }, [pendingSessions, remoteSessions]);

  useEffect(() => {
    setPendingSessions((current) => {
      const next = current.filter((pending) => {
        const remote = remoteSessions.find((session) => session.id === pending.id);
        return !remote || sessionSyncKey(remote) !== sessionSyncKey(pending);
      });
      return next.length === current.length ? current : next;
    });
  }, [remoteSessions]);
  const todaysWorkout = useMemo(() => {
    const key = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
    const slot = activeProgram?.schedule.find((item) => item.day === key);
    if (slot?.workoutDayId) return liveWorkouts.find((workout) => workout.id === slot.workoutDayId) ?? activeWorkout;
    return activeWorkout;
  }, [activeProgram, liveWorkouts, activeWorkout]);

  const updateUserProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!uid) return;
      await updateProfile(uid, patch);
    },
    [uid],
  );

  const saveWorkout = useCallback(
    async (input: Pick<WorkoutDay, "name" | "focus" | "duration" | "exercises">) => {
      if (!uid) throw new Error("Not signed in");
      const workout = await createWorkout(uid, input);
      if (liveWorkouts.length === 0) await setActiveWorkout(uid, workout.id);
      return workout;
    },
    [uid, liveWorkouts.length],
  );

  const persistWorkout = useCallback(
    async (workoutId: string, patch: Partial<WorkoutDay>) => {
      if (!uid) return;
      const previous = workoutsRef.current.find((item) => item.id === workoutId);
      if (patch.exercises && patch.exercises.length === 0 && (previous?.exercises.length ?? 0) > 1) {
        return;
      }
      const nextWorkouts = workoutsRef.current.map((item) =>
        item.id === workoutId ? { ...item, ...patch } : item,
      );
      workoutsRef.current = nextWorkouts;
      setWorkouts(nextWorkouts);
      workoutPersistChain.current = workoutPersistChain.current
        .catch(() => undefined)
        .then(async () => {
          const latest = workoutsRef.current.find((item) => item.id === workoutId);
          if (!latest) return;
          await updateWorkout(uid, workoutId, {
            ...(patch.name !== undefined ? { name: latest.name } : {}),
            ...(patch.focus !== undefined ? { focus: latest.focus } : {}),
            ...(patch.duration !== undefined ? { duration: latest.duration } : {}),
            ...(patch.exercises !== undefined ? { exercises: latest.exercises } : {}),
          });
        });
      await workoutPersistChain.current;
    },
    [uid],
  );

  const patchWorkout = useCallback(
    async (workoutId: string, patch: Partial<WorkoutDay>) => {
      await persistWorkout(workoutId, patch);
    },
    [persistWorkout],
  );

  const trashWorkoutItem = useCallback(
    async (workoutId: string) => {
      if (!uid) return;
      const current = workoutsRef.current.find((item) => item.id === workoutId);
      const remaining = workoutsRef.current.filter((item) => item.id !== workoutId && !isTrashed(item));
      await trashWorkout(uid, workoutId);
      if (current?.active && remaining[0]) await setActiveWorkout(uid, remaining[0].id);
    },
    [uid],
  );

  const restoreWorkoutItem = useCallback(
    async (workoutId: string) => {
      if (!uid) return;
      const hasLive = workoutsRef.current.some((item) => item.id !== workoutId && !isTrashed(item));
      await restoreWorkout(uid, workoutId);
      if (!hasLive) await setActiveWorkout(uid, workoutId);
    },
    [uid],
  );

  const purgeWorkout = useCallback(
    async (workoutId: string) => {
      if (!uid) return;
      await deleteWorkout(uid, workoutId);
    },
    [uid],
  );

  const activateWorkout = useCallback(
    async (workoutId: string) => {
      if (!uid) return;
      await setActiveWorkout(uid, workoutId);
    },
    [uid],
  );

  const saveProgram = useCallback(
    async (input: Pick<WorkoutProgram, "name" | "schedule">) => {
      if (!uid) throw new Error("Not signed in");
      const program = await createProgram(uid, input);
      if (livePrograms.length === 0) await setActiveProgram(uid, program.id);
      return program;
    },
    [uid, livePrograms.length],
  );

  const patchProgram = useCallback(
    async (programId: string, patch: Partial<WorkoutProgram>) => {
      if (!uid) return;
      await updateProgram(uid, programId, patch);
    },
    [uid],
  );

  const trashProgramItem = useCallback(
    async (programId: string) => {
      if (!uid) return;
      const current = programs.find((item) => item.id === programId);
      const remaining = programs.filter((item) => item.id !== programId && !isTrashed(item));
      await trashProgram(uid, programId);
      if (current?.active && remaining[0]) await setActiveProgram(uid, remaining[0].id);
    },
    [uid, programs],
  );

  const restoreProgramItem = useCallback(
    async (programId: string) => {
      if (!uid) return;
      const hasLive = programs.some((item) => item.id !== programId && !isTrashed(item));
      await restoreProgram(uid, programId);
      if (!hasLive) await setActiveProgram(uid, programId);
    },
    [uid, programs],
  );

  const purgeProgram = useCallback(
    async (programId: string) => {
      if (!uid) return;
      await deleteProgram(uid, programId);
    },
    [uid],
  );

  const emptyTrash = useCallback(async () => {
    if (!uid) return;
    await Promise.all([
      ...workoutsRef.current.filter(isTrashed).map((item) => deleteWorkout(uid, item.id)),
      ...programs.filter(isTrashed).map((item) => deleteProgram(uid, item.id)),
    ]);
  }, [uid, programs]);

  const activateProgram = useCallback(
    async (programId: string) => {
      if (!uid) return;
      await setActiveProgram(uid, programId);
    },
    [uid],
  );

  const duplicateWorkout = useCallback(
    async (workoutId: string) => {
      if (!uid) return null;
      const workout = workouts.find((item) => item.id === workoutId);
      if (!workout) return null;
      return createWorkout(uid, {
        name: `${workout.name} copy`,
        focus: workout.focus,
        duration: workout.duration,
        exercises: workout.exercises.map((exercise) => ({ ...exercise, id: crypto.randomUUID() })),
      });
    },
    [uid, workouts],
  );

  const completeSession = useCallback(
    async (pending: PendingSession) => {
      if (!uid) throw new Error("Not signed in");
      const completedAt = new Date().toISOString();
      const session: StoredSession = {
        id: crypto.randomUUID(),
        workoutDayId: pending.workout.id,
        workoutName: pending.workout.name,
        focus: pending.workout.focus,
        startedAt: pending.startedAt,
        completedAt,
        durationSeconds: elapsedSeconds(pending.startedAt, completedAt) || pending.durationSeconds,
        exerciseSessions: stampExerciseSessions(pending.workout.exercises, pending.exerciseSessions),
      };
      await saveLocalSessionState(uid, { progress: null, pendingSync: true, clearedAt: completedAt });
      await enqueueOutbox({ id: `complete-session:${session.id}`, kind: "complete-session", uid, session });
      await enqueueOutbox({ id: `clear-active-session:${uid}`, kind: "clear-active-session", uid });
      setActiveSession(null);
      setActiveSessionPendingSync(false);
      setPendingSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      const prs = newRecordsToSave(records, recordsFromTraining([session], [pending.workout]));
      await Promise.all(prs.map((record) => addRecord(uid, record).catch(() => undefined)));
      await refreshPending(uid);
      await runFlush();
      return session.id;
    },
    [records, refreshPending, runFlush, uid],
  );

  const patchSession = useCallback(
    async (session: StoredSession) => {
      if (!uid) throw new Error("Not signed in");
      if (session.id.startsWith("in-progress:")) throw new Error("Finish this session before editing it.");
      setPendingSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      await enqueueOutbox({ id: `complete-session:${session.id}`, kind: "complete-session", uid, session });
      await refreshPending(uid);
      await runFlush();
    },
    [refreshPending, runFlush, uid],
  );

  const saveActiveSessionProgress = useCallback(
    async (progress: Omit<ActiveSessionProgress, "updatedAt">) => {
      if (!uid) return;
      const local = await loadLocalSessionState(uid);
      if (local?.clearedAt && progress.startedAt < local.clearedAt) return;
      const payload: ActiveSessionProgress = { ...progress, updatedAt: new Date().toISOString() };
      await saveLocalSessionState(uid, { progress: payload, pendingSync: true, clearedAt: null });
      await enqueueOutbox({
        id: `active-session:${uid}`,
        kind: "active-session",
        uid,
        progress: payload,
      });
      setActiveSession(payload);
      setActiveSessionPendingSync(true);
      await refreshPending(uid);
      void runFlush();
    },
    [refreshPending, runFlush, uid],
  );

  const clearActiveSessionProgress = useCallback(async () => {
    if (!uid) return;
    const clearedAt = new Date().toISOString();
    await saveLocalSessionState(uid, { progress: null, pendingSync: true, clearedAt });
    await enqueueOutbox({ id: `clear-active-session:${uid}`, kind: "clear-active-session", uid });
    setActiveSession(null);
    setActiveSessionPendingSync(false);
    await refreshPending(uid);
    void runFlush();
  }, [refreshPending, runFlush, uid]);

  const saveRecord = useCallback(
    async (record: Omit<PersonalRecord, "id">) => {
      if (!uid) throw new Error("Not signed in");
      return addRecord(uid, record);
    },
    [uid],
  );

  const saveMeasurement = useCallback(
    async (measurement: Omit<BodyMeasurement, "id">) => {
      if (!uid) throw new Error("Not signed in");
      return addMeasurement(uid, measurement);
    },
    [uid],
  );

  const saveBodyPhoto = useCallback(
    async (input: { file: File; pose: BodyPhoto["pose"]; takenAt: string; weight?: number }) => {
      if (!uid) throw new Error("Not signed in");
      const id = crypto.randomUUID();
      const stored = await uploadBodyPhoto(uid, id, input.file);
      await addBodyPhoto(uid, {
        id,
        url: stored.url,
        path: stored.path,
        pose: input.pose,
        takenAt: input.takenAt,
        createdAt: new Date().toISOString(),
        weight: input.weight,
      });
      return id;
    },
    [uid],
  );

  const removeBodyPhoto = useCallback(
    async (photoId: string) => {
      if (!uid) return;
      const photo = bodyPhotos.find((item) => item.id === photoId);
      await deleteBodyPhotoDoc(uid, photoId);
      if (photo?.path) await deleteStoredFile(photo.path);
    },
    [bodyPhotos, uid],
  );

  const saveVideoUrl = useCallback(
    async (exerciseId: string, videoUrl: string) => {
      if (!uid) return;
      await setExerciseMedia(uid, exerciseId, videoUrl);
    },
    [uid],
  );

  const videoUrlForExercise = useCallback((exerciseId: string, name?: string) => {
    return rememberedExerciseVideoUrl(exerciseId, name, workouts, {
      media: exerciseMedia,
      customExercises,
    });
  }, [customExercises, exerciseMedia, workouts]);

  const addExerciseToCatalog = useCallback(
    async (input: CustomExerciseInput) => {
      if (!uid) throw new Error("Not signed in");
      const { gifFile, imageFile, ...exercise } = input;
      const id = crypto.randomUUID();
      let gif_url = exercise.gif_url.trim();
      let image = exercise.image.trim();
      if (gifFile) gif_url = await uploadCustomExerciseMedia(uid, id, "gif", gifFile);
      if (imageFile) image = await uploadCustomExerciseMedia(uid, id, "image", imageFile);
      if (gif_url && !image) image = gif_url;
      if (image && !gif_url) gif_url = image;
      const createdId = await addCustomExercise(uid, { ...exercise, id, gif_url, image });
      const videoUrl = exercise.videoUrl?.trim();
      if (videoUrl) await setExerciseMedia(uid, createdId, videoUrl);
      return createdId;
    },
    [uid],
  );

  const patchCustomExercise = useCallback(
    async (exerciseId: string, patch: Partial<Exercise>) => {
      if (!uid) return;
      await updateCustomExercise(uid, exerciseId, patch);
      const videoUrl = patch.videoUrl?.trim();
      if (videoUrl) await setExerciseMedia(uid, exerciseId, videoUrl);
    },
    [uid],
  );

  const uploadExerciseMedia = useCallback(
    async (exerciseId: string, kind: "gif" | "image", file: File) => {
      if (!uid) throw new Error("Not signed in");
      const url = await uploadCustomExerciseMedia(uid, exerciseId, kind, file);
      const patch = kind === "gif" ? { gif_url: url } : { image: url };
      await updateCustomExercise(uid, exerciseId, patch);
      return url;
    },
    [uid],
  );

  const addExerciseFromCatalog = useCallback(
    async (workoutId: string, exercise: Exercise, restSeconds = 90) => {
      const workout = workoutsRef.current.find((item) => item.id === workoutId);
      if (!workout) return;
      const nextExercise = workoutExerciseFromCatalog(
        exercise,
        restSeconds,
        videoUrlForExercise(exercise.id, exercise.name),
      );
      await persistWorkout(workoutId, { exercises: [...workout.exercises, nextExercise] });
    },
    [persistWorkout, videoUrlForExercise],
  );

  const value = useMemo(
    () => ({
      profile,
      workouts: liveWorkouts,
      programs: livePrograms,
      trashedWorkouts,
      trashedPrograms,
      sessions,
      records,
      measurements,
      bodyPhotos,
      customExercises,
      activeWorkout,
      activeProgram,
      todaysWorkout,
      activeSession,
      activeSessionLoaded,
      activeSessionPendingSync,
      pendingSyncCount,
      syncing,
      loading,
      updateUserProfile,
      saveActiveSessionProgress,
      clearActiveSessionProgress,
      saveWorkout,
      patchWorkout,
      trashWorkout: trashWorkoutItem,
      restoreWorkout: restoreWorkoutItem,
      purgeWorkout,
      activateWorkout,
      duplicateWorkout,
      saveProgram,
      patchProgram,
      trashProgram: trashProgramItem,
      restoreProgram: restoreProgramItem,
      purgeProgram,
      activateProgram,
      emptyTrash,
      completeSession,
      patchSession,
      saveRecord,
      saveMeasurement,
      saveBodyPhoto,
      deleteBodyPhoto: removeBodyPhoto,
      saveVideoUrl,
      videoUrlForExercise,
      addExerciseToCatalog,
      patchCustomExercise,
      uploadExerciseMedia,
      addExerciseFromCatalog,
    }),
    [
      profile,
      liveWorkouts,
      livePrograms,
      trashedWorkouts,
      trashedPrograms,
      sessions,
      records,
      measurements,
      bodyPhotos,
      customExercises,
      activeWorkout,
      activeProgram,
      todaysWorkout,
      activeSession,
      activeSessionLoaded,
      activeSessionPendingSync,
      pendingSyncCount,
      syncing,
      loading,
      updateUserProfile,
      saveActiveSessionProgress,
      clearActiveSessionProgress,
      saveWorkout,
      patchWorkout,
      trashWorkoutItem,
      restoreWorkoutItem,
      purgeWorkout,
      activateWorkout,
      duplicateWorkout,
      saveProgram,
      patchProgram,
      trashProgramItem,
      restoreProgramItem,
      purgeProgram,
      activateProgram,
      emptyTrash,
      completeSession,
      patchSession,
      saveRecord,
      saveMeasurement,
      saveBodyPhoto,
      removeBodyPhoto,
      saveVideoUrl,
      videoUrlForExercise,
      addExerciseToCatalog,
      patchCustomExercise,
      uploadExerciseMedia,
      addExerciseFromCatalog,
      exerciseMedia,
    ],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (!context) throw new Error("useUserData must be used within UserDataProvider");
  return context;
}

function mergeOptimisticExercises(local: StoredWorkout[], remote: StoredWorkout[]) {
  return remote.map((remoteWorkout) => {
    const current = local.find((item) => item.id === remoteWorkout.id);
    if (!current || current.exercises.length <= remoteWorkout.exercises.length) return remoteWorkout;
    const remoteIds = new Set(remoteWorkout.exercises.map((item) => item.id));
    const extras = current.exercises.filter((item) => !remoteIds.has(item.id));
    return extras.length ? { ...remoteWorkout, exercises: [...remoteWorkout.exercises, ...extras] } : remoteWorkout;
  });
}
