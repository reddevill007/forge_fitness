const DATASET_TO_SLUG: Record<string, string> = {
  abs: "abs",
  "lower abs": "abs",
  abdominals: "abs",
  "deep core": "abs",
  core: "abs",
  adductors: "adductors",
  "inner thighs": "adductors",
  groin: "adductors",
  abductors: "gluteal",
  ankles: "ankles",
  "ankle stabilizers": "ankles",
  biceps: "biceps",
  brachialis: "biceps",
  calves: "calves",
  soleus: "calves",
  chest: "chest",
  pectorals: "chest",
  pectoralis: "chest",
  "upper chest": "chest",
  "lower chest": "chest",
  serratus: "chest",
  "serratus anterior": "chest",
  delts: "deltoids",
  deltoids: "deltoids",
  shoulders: "deltoids",
  "front delts": "deltoids",
  "front deltoids": "deltoids",
  "anterior delts": "deltoids",
  "side delts": "deltoids",
  "lateral delts": "deltoids",
  "rear delts": "deltoids",
  "rear deltoids": "deltoids",
  "rotator cuff": "deltoids",
  feet: "feet",
  forearm: "forearm",
  forearms: "forearm",
  wrists: "forearm",
  grip: "forearm",
  "grip muscles": "forearm",
  "wrist flexors": "forearm",
  "wrist extensors": "forearm",
  glutes: "gluteal",
  gluteal: "gluteal",
  hamstring: "hamstring",
  hamstrings: "hamstring",
  hands: "hands",
  lats: "upper-back",
  "latissimus dorsi": "upper-back",
  "upper back": "upper-back",
  "upper-back": "upper-back",
  rhomboids: "upper-back",
  "lower back": "lower-back",
  "lower-back": "lower-back",
  spine: "lower-back",
  neck: "neck",
  "levator scapulae": "neck",
  obliques: "obliques",
  quads: "quadriceps",
  quadriceps: "quadriceps",
  "hip flexors": "quadriceps",
  tibialis: "tibialis",
  shins: "tibialis",
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
