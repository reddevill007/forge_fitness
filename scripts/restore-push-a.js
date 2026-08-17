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
  return value.includes("push a") || value.includes("day 1") && value.includes("push");
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

let catalogById = null;
function loadCatalog() {
  const file = path.join(__dirname, "..", "data", "exercises.json");
  const items = JSON.parse(fs.readFileSync(file, "utf8"));
  catalogById = new Map(items.map((item) => [item.id, item]));
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
  loadCatalog();

  const usersSnap = await db.collection("users").get();
  console.log(`users: ${usersSnap.size}`);

  let restored = 0;
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const workoutsRef = db.collection("users").doc(uid).collection("workouts");
    const sessionsRef = db.collection("users").doc(uid).collection("sessions");
    const programsRef = db.collection("users").doc(uid).collection("programs");
    const mediaRef = db.collection("users").doc(uid).collection("exerciseMedia");
    const customRef = db.collection("users").doc(uid).collection("customExercises");

    const [workoutsSnap, sessionsSnap, programsSnap] = await Promise.all([
      workoutsRef.get(),
      sessionsRef.get(),
      programsRef.get(),
    ]);

    const existing = workoutsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => matchesPushA(item.name));
    const sessions = sessionsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => matchesPushA(item.workoutName) || matchesPushA(item.focus));

    if (!existing.length && !sessions.length) continue;

    console.log(`\nuser ${uid}`);
    console.log(`  workouts matching: ${existing.map((item) => `${item.name} (${item.id})`).join(", ") || "none"}`);
    console.log(`  sessions matching: ${sessions.length}`);

    if (existing.length && existing.some((item) => (item.exercises || []).length > 0)) {
      console.log("  already present — leaving as-is");
      continue;
    }

    sessions.sort((a, b) => String(b.completedAt || b.startedAt).localeCompare(String(a.completedAt || a.startedAt)));
    const richest = sessions.reduce((lead, item) => {
      const count = item.exerciseSessions?.length || 0;
      const leadCount = lead?.exerciseSessions?.length || 0;
      return count > leadCount ? item : lead;
    }, sessions[0]);

    if (!richest) {
      console.log("  no session payload to rebuild from");
      continue;
    }

    const workoutId = richest.workoutDayId;
    const customSnap = await customRef.get();
    const customById = new Map(customSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));

    const exercises = [];
    for (const row of richest.exerciseSessions || []) {
      const exerciseId = row.exerciseId || row.workoutExerciseId;
      const catalog = catalogById.get(exerciseId) || customById.get(exerciseId) || null;
      let videoUrl;
      try {
        const media = await mediaRef.doc(exerciseId).get();
        videoUrl = media.exists ? media.data()?.videoUrl : undefined;
      } catch {
        videoUrl = undefined;
      }
      exercises.push({
        id: row.workoutExerciseId || crypto.randomUUID(),
        exerciseId: exerciseId || crypto.randomUUID(),
        name: row.exerciseName || catalog?.name || "Exercise",
        target: catalog?.target || catalog?.muscle_group || "other",
        secondary: catalog?.secondary_muscles || catalog?.secondary || [],
        prescription: prescriptionFromSets(row.sets),
        restSeconds: restFromSets(row.sets),
        ...(catalog?.media_id ? { mediaId: catalog.media_id } : {}),
        ...(videoUrl || catalog?.videoUrl ? { videoUrl: videoUrl || catalog.videoUrl } : {}),
        ...(resolveMedia(catalog?.gif_url) ? { gifUrl: resolveMedia(catalog.gif_url) } : {}),
        ...(resolveMedia(catalog?.image) ? { imageUrl: resolveMedia(catalog.image) } : {}),
      });
    }

    const now = new Date().toISOString();
    const workout = {
      id: workoutId,
      name: richest.workoutName || "Day 1 - Push A",
      focus: richest.focus || "Chest · Front Delts · Triceps",
      duration: Math.max(1, Math.round((richest.durationSeconds || 2700) / 60)),
      exercises,
      active: workoutsSnap.empty,
      createdAt: richest.startedAt || now,
      updatedAt: now,
    };

    await workoutsRef.doc(workoutId).set(workout);
    restored += 1;
    console.log(`  restored "${workout.name}" id=${workoutId} exercises=${exercises.length}`);
    console.log(`  exercises: ${exercises.map((item) => item.name).join(" · ")}`);

    for (const programDoc of programsSnap.docs) {
      const program = programDoc.data();
      const schedule = program.schedule || [];
      const missing = schedule.some((slot) => slot.workoutDayId === workoutId);
      if (missing) console.log(`  still referenced by program ${program.name || programDoc.id}`);
    }
  }

  console.log(`\nrestored ${restored} workout(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
