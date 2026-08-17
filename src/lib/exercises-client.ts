import type { Exercise } from "@/src/types/fitness";
import { cachedJson, matchCached, cacheResponse } from "@/src/lib/offline-cache";

export type ExerciseListResponse = {
  items: Exercise[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

async function fetchWithCache(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to load exercises");
    await cacheResponse(new Request(url), response).catch(() => undefined);
    return response.json();
  } catch (error) {
    const cached = await matchCached(url);
    if (cached) return cached.json();
    throw error;
  }
}

export async function fetchExercises(params: {
  q?: string;
  group?: string;
  page?: number;
  limit?: number;
} = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.group && params.group !== "All") search.set("group", params.group.toLowerCase());
  search.set("page", String(params.page ?? 1));
  search.set("limit", String(params.limit ?? 24));
  const url = `/api/exercises?${search.toString()}`;

  return cachedJson<ExerciseListResponse>(`exercises:${url}`, () => fetchWithCache(url));
}

export async function fetchExercise(id: string) {
  const url = `/api/exercises/${id}`;
  try {
    const data = await cachedJson<{ item: Exercise }>(`exercise:${id}`, () => fetchWithCache(url));
    return data.item;
  } catch {
    return null;
  }
}
