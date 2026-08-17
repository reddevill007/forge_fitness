export type AnatomeWorkoutImageResponse = {
  ok: boolean;
  svg: string;
  muscles_hit: string[];
  per_muscle_count: Record<string, number>;
  exercises_resolved: Array<{
    input: string;
    exercise: string;
    matched: boolean;
    source: string;
  }>;
  gender: string;
  view: string;
  anatome_imageSrc: string;
  attribution: string;
  attribution_source: string;
  license: string;
};

export type AnatomeResolveExerciseResponse = {
  ok: boolean;
  exercise: string;
  matched: boolean;
  source: string;
  layers: Array<{
    color: string;
    muscles: string[];
  }>;
  image_src?: string;
  video_url?: string;
  video_exercise_specific?: boolean;
  ext_id?: string;
  equipment?: string;
  level?: string;
  category?: string;
  explanation?: string;
  alternatives?: Array<{
    ext_id: string;
    name: string;
    equipment?: string;
    primary?: string[];
  }>;
  anatome_imageSrc?: string;
  exercise_db_attribution?: string;
  license?: string;
};

import { cachedJson } from "@/src/lib/offline-cache";

const ANATOME_BASE_URL = "https://api.anatome.dev";

export async function anatomeResolveExercise(exercise: string): Promise<AnatomeResolveExerciseResponse> {
  const url = `${ANATOME_BASE_URL}/resolveExercise?exercise=${encodeURIComponent(exercise)}`;
  return cachedJson(`anatome:resolve:${exercise}`, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Anatome resolveExercise failed: ${res.status}`);
    return (await res.json()) as AnatomeResolveExerciseResponse;
  });
}

export type AnatomeLayer = {
  color: string;
  muscles: string[];
  opacity?: number;
};

export type AnatomeGenerateImageResponse = {
  ok: boolean;
  svg: string;
  format?: string;
  gender: string;
  view: string;
  muscles_rendered: string[];
  attribution?: string;
  attribution_source?: string;
  license?: string;
};

export async function anatomeWorkoutImage(params: {
  exercises: string[];
  gender?: "male" | "female";
  view?: "front" | "back" | "dual";
  output?: "json" | "raw";
}): Promise<AnatomeWorkoutImageResponse> {
  const body = {
    exercises: params.exercises,
    gender: params.gender ?? "male",
    view: params.view ?? "dual",
    output: params.output ?? "json",
  };

  return cachedJson(`anatome:workout:${JSON.stringify(body)}`, async () => {
    const res = await fetch(`${ANATOME_BASE_URL}/workoutImage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anatome workoutImage failed: ${res.status}`);
    return (await res.json()) as AnatomeWorkoutImageResponse;
  });
}

export async function anatomeGenerateImage(params: {
  layers: AnatomeLayer[];
  gender?: "male" | "female";
  view?: "front" | "back" | "dual";
}): Promise<AnatomeGenerateImageResponse> {
  const payload = {
    gender: params.gender ?? "male",
    view: params.view ?? "dual",
    layers: params.layers,
    background: "transparent",
    body_color: "#3a3d38",
    border_color: "#9aa096",
    output: "json",
  };

  return cachedJson(`anatome:generate:${JSON.stringify(payload)}`, async () => {
    const res = await fetch(`${ANATOME_BASE_URL}/generateImage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Anatome generateImage failed: ${res.status}`);
    return (await res.json()) as AnatomeGenerateImageResponse;
  });
}

export function anatomeMuscleImageUrl(params: {
  primary: string[];
  secondary?: string[];
  gender?: "male" | "female";
  view?: "front" | "back" | "dual";
}) {
  const parts: string[] = [];
  if (params.primary.length) parts.push(`C9F43D:${params.primary.join(",")}`);
  if (params.secondary?.length) parts.push(`F09A61:${params.secondary.join(",")}`);
  const search = new URLSearchParams({
    layers: parts.join("|"),
    gender: params.gender ?? "male",
    view: params.view ?? "dual",
    output: "raw",
    background: "transparent",
  });
  return `${ANATOME_BASE_URL}/generateImage?${search.toString()}`;
}

