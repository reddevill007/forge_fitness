const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/\\n/g, "\n");
  }
  return env;
}

function matchesPushA(name) {
  const value = String(name || "").toLowerCase();
  return value.includes("push a") || (value.includes("day 1") && value.includes("push"));
}

function restFromSets(sets) {
  const values = (sets || []).map((set) => Number(set.restSeconds)).filter((n) => Number.isFinite(n) && n > 0);
  return values.at(-1) ?? 90;
}

function prescriptionFromSets(sets) {
  const working = (sets || []).filter((set) => set.completed || set.reps > 0);
  if (!working.length) return "3 × 8–12";
  const reps = working.map((set) => set.reps).filter(Boolean);
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return `${working.length} × ${min === max ? min : `${min}–${max}`}`;
}

function resolveMedia(src) {
  if (!src || typeof src !== "string") return undefined;
  const value = src.trim();
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/exercise-media/${value.replace(/^\.\//, "")}`;
}

function loadCatalog() {
  const file = path.join(__dirname, "..", "data", "exercises.json");
  const items = JSON.parse(fs.readFileSync(file, "utf8"));
  const byId = new Map(items.map((item) => [item.id, item]));
  const byName = new Map();
  for (const item of items) {
    const key = String(item.name || "").trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, item);
  }
  return { byId, byName };
}

function findCatalog(exercise, catalog) {
  return catalog.byId.get(exercise.exerciseId)
    || catalog.byName.get(String(exercise.name || "").trim().toLowerCase())
    || null;
}

function withMedia(exercise, catalogItem, videoUrl) {
  const gifUrl = resolveMedia(exercise.gifUrl) || resolveMedia(catalogItem?.gif_url);
  const imageUrl = resolveMedia(exercise.imageUrl) || resolveMedia(catalogItem?.image);
  const mediaId = exercise.mediaId || catalogItem?.media_id;
  const next = { ...exercise };
  if (mediaId) next.mediaId = mediaId;
  if (gifUrl) next.gifUrl = gifUrl;
  if (imageUrl) next.imageUrl = imageUrl;
  if (videoUrl || exercise.videoUrl) next.videoUrl = videoUrl || exercise.videoUrl;
  return next;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  const db = admin.firestore();
  const catalog = loadCatalog();
  const uid = "Uqgb0LRrSbXr10R0pcmf3pQFubq2";
  const userRef = db.collection("users").doc(uid);
  const workoutsRef = userRef.collection("workouts");
  const sessionsRef = userRef.collection("sessions");
  const mediaRef = userRef.collection("exerciseMedia");
  const customRef = userRef.collection("customExercises");

  const [workoutsSnap, sessionsSnap, mediaSnap, customSnap] = await Promise.all([
    workoutsRef.get(),
    sessionsRef.get(),
    mediaRef.get(),
    customRef.get(),
  ]);

  const mediaById = new Map(mediaSnap.docs.map((doc) => [doc.id, doc.data()?.videoUrl]));
  const customById = new Map(customSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));

  const pushWorkout = workoutsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .find((item) => matchesPushA(item.name));

  if (pushWorkout && !(pushWorkout.exercises || []).length) {
    const sessions = sessionsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.workoutDayId === pushWorkout.id || matchesPushA(item.workoutName));
    const richest = sessions.reduce((lead, item) => {
      const count = item.exerciseSessions?.length || 0;
      const leadCount = lead?.exerciseSessions?.length || 0;
      return count > leadCount ? item : lead;
    }, sessions[0]);

    if (!richest) {
      console.log("Push A is empty and no session exists to rebuild from");
    } else {
      const exercises = [];
      for (const row of richest.exerciseSessions || []) {
        const exerciseId = row.exerciseId || row.workoutExerciseId;
        const catalogItem = catalog.byId.get(exerciseId) || customById.get(exerciseId) || catalog.byName.get(String(row.exerciseName || "").trim().toLowerCase());
        exercises.push(withMedia({
          id: row.workoutExerciseId || crypto.randomUUID(),
          exerciseId: catalogItem?.id || exerciseId || crypto.randomUUID(),
          name: row.exerciseName || catalogItem?.name || "Exercise",
          target: catalogItem?.target || catalogItem?.muscle_group || "other",
          secondary: catalogItem?.secondary_muscles || catalogItem?.secondary || [],
          prescription: prescriptionFromSets(row.sets),
          restSeconds: restFromSets(row.sets),
        }, catalogItem, mediaById.get(catalogItem?.id || exerciseId) || catalogItem?.videoUrl));
      }
      await workoutsRef.doc(pushWorkout.id).update({
        exercises,
        updatedAt: new Date().toISOString(),
      });
      console.log(`restored Push A exercises=${exercises.length}`);
    }
  }

  let patched = 0;
  const latestWorkouts = await workoutsRef.get();
  for (const doc of latestWorkouts.docs) {
    const workout = { id: doc.id, ...doc.data() };
    const exercises = workout.exercises || [];
    if (!exercises.length) continue;
    let changed = false;
    const next = exercises.map((exercise) => {
      const catalogItem = findCatalog(exercise, catalog) || customById.get(exercise.exerciseId);
      const videoUrl = mediaById.get(exercise.exerciseId) || mediaById.get(catalogItem?.id) || exercise.videoUrl;
      const hydrated = withMedia(exercise, catalogItem, videoUrl);
      if (
        hydrated.gifUrl !== exercise.gifUrl
        || hydrated.imageUrl !== exercise.imageUrl
        || hydrated.videoUrl !== exercise.videoUrl
        || hydrated.mediaId !== exercise.mediaId
        || hydrated.exerciseId !== exercise.exerciseId
      ) {
        changed = true;
      }
      return hydrated;
    });
    if (!changed) continue;
    await doc.ref.update({ exercises: next, updatedAt: new Date().toISOString() });
    patched += 1;
    console.log(`backfilled media on ${workout.name}`);
  }

  console.log(`patched ${patched} workout(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
