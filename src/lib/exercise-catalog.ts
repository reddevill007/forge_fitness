import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Exercise } from "@/src/types/fitness";
import { resolveDatasetMedia } from "@/src/lib/dataset-media";

export { resolveDatasetMedia };

let exerciseCache: Exercise[] | undefined;

export function withResolvedMedia(exercise: Exercise): Exercise {
  return {
    ...exercise,
    image: resolveDatasetMedia(exercise.image),
    gif_url: resolveDatasetMedia(exercise.gif_url),
  };
}

export async function getExercises() {
  if (!exerciseCache) {
    const file = await readFile(path.join(process.cwd(), "data", "exercises.json"), "utf8");
    exerciseCache = JSON.parse(file) as Exercise[];
  }
  return exerciseCache;
}

export async function getExerciseById(id: string) {
  const exercises = await getExercises();
  const exercise = exercises.find((item) => item.id === id);
  return exercise ? withResolvedMedia(exercise) : null;
}

export function matchesExerciseGroup(exercise: Exercise, group: string) {
  if (!group || group === "all") return true;
  const category = exercise.category.toLowerCase();
  const bodyPart = exercise.body_part.toLowerCase();
  const target = exercise.target.toLowerCase();
  const haystack = `${category} ${bodyPart} ${target} ${exercise.muscle_group}`.toLowerCase();

  if (group === "legs") return haystack.includes("leg") || haystack.includes("glute") || haystack.includes("quad");
  if (group === "arms") return haystack.includes("arm") || haystack.includes("bicep") || haystack.includes("tricep");
  return category === group || bodyPart === group || target.includes(group);
}
