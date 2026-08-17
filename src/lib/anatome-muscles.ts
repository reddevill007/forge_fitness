const DATASET_TO_SLUG: Record<string, string> = {
  abs: "abs",
  adductors: "adductors",
  abductors: "gluteal",
  ankles: "ankles",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  pectorals: "chest",
  pectoralis: "chest",
  delts: "deltoids",
  deltoids: "deltoids",
  shoulders: "deltoids",
  feet: "feet",
  forearm: "forearm",
  forearms: "forearm",
  glutes: "gluteal",
  gluteal: "gluteal",
  hamstring: "hamstring",
  hamstrings: "hamstring",
  hands: "hands",
  lats: "upper-back",
  "upper back": "upper-back",
  "upper-back": "upper-back",
  "lower back": "lower-back",
  "lower-back": "lower-back",
  spine: "lower-back",
  neck: "neck",
  obliques: "obliques",
  quads: "quadriceps",
  quadriceps: "quadriceps",
  tibialis: "tibialis",
  traps: "trapezius",
  trapezius: "trapezius",
  triceps: "triceps",
};

const ANATOME_SLUGS = new Set(Object.values(DATASET_TO_SLUG));

export const PRIMARY_MUSCLE_COLOR = "#c9f43d";
export const SECONDARY_MUSCLE_COLOR = "#f09a61";

export function toAnatomeSlug(name: string | undefined | null): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (DATASET_TO_SLUG[key]) return DATASET_TO_SLUG[key];
  if (ANATOME_SLUGS.has(key)) return key;
  return null;
}

export function uniqueSlugs(names: Array<string | undefined | null>) {
  const slugs: string[] = [];
  for (const name of names) {
    const slug = toAnatomeSlug(name);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

export function slugLabel(slug: string) {
  return slug.replace(/-/g, " ");
}
